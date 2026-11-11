package com.hizirbey.tercuman;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.*;
import android.os.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** AudioRecord + bundled CPU models. No RecognitionService, API key or network. */
class EmbeddedSpeech implements AutoCloseable {
    interface Listener {
        void state(String value); void result(String text); void error(String message);
        default void level(float value) {} default void recording(boolean active) {}
    }
    interface Capture extends AutoCloseable {
        int sampleRate(); int read(short[] buffer,int offset,int count); void close();
    }
    interface CaptureFactory { Capture open() throws Exception; }
    interface Decoder { String decode(float[] samples,String language) throws Exception; }
    private final Context app;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicLong generation=new AtomicLong();
    private final AtomicLong finishRequested=new AtomicLong(-1);
    private final AtomicBoolean closed=new AtomicBoolean();
    private final Object nativeLock=new Object();
    private final CaptureFactory captureFactory;
    private final Decoder decoder;
    private volatile Capture recorder;
    private volatile String diagnostics="Henüz dinleme başlatılmadı.";
    private long context;
    private String loadedModel="";
    EmbeddedSpeech(Context app){this(app,null);}
    EmbeddedSpeech(Context app,CaptureFactory factory){this(app,factory,null);}
    EmbeddedSpeech(Context app,CaptureFactory factory,Decoder decoder){
        this.app=app.getApplicationContext();captureFactory=factory==null?this::openPlatformCapture:factory;this.decoder=decoder;
    }
    String diagnostics(){return diagnostics;}
    private void post(long job,Runnable task){main.post(()->{if(!closed.get()&&generation.get()==job)task.run();});}
    private Capture openPlatformCapture(){
        if(app.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)
            throw new SecurityException("Mikrofon izni gerekli.");
        String last="Mikrofon açılamadı.";
        for(int rate:new int[]{16000,48000,44100})for(int source:new int[]{MediaRecorder.AudioSource.VOICE_RECOGNITION,MediaRecorder.AudioSource.MIC}){
            AudioRecord record=null;
            try{
                int minimum=AudioRecord.getMinBufferSize(rate,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
                if(minimum<=0)continue;
                record=new AudioRecord(source,rate,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(minimum,rate/5));
                if(record.getState()!=AudioRecord.STATE_INITIALIZED)throw new IllegalStateException("Mikrofon başlatılamadı.");
                record.startRecording();
                if(record.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING)throw new IllegalStateException("Telefon mikrofon kaydını başlatmadı.");
                AudioRecord active=record;
                return new Capture(){
                    private boolean released;
                    public int sampleRate(){return active.getSampleRate();}
                    public synchronized int read(short[] b,int offset,int count){return released?AudioRecord.ERROR_INVALID_OPERATION:active.read(b,offset,count,AudioRecord.READ_NON_BLOCKING);}
                    public synchronized void close(){if(released)return;released=true;try{active.stop();}catch(RuntimeException ignored){}active.release();}
                };
            }catch(RuntimeException e){last=e.getMessage();if(record!=null){try{record.stop();}catch(RuntimeException ignored){}record.release();}}
        }
        throw new IllegalStateException(last);
    }
    /** Each complete 20 ms input frame becomes exactly 320 samples at 16 kHz. */
    static short[] resample(short[] input,int rate){
        short[] out=new short[320];
        for(int i=0;i<320;i++){
            double at=i*rate/16000.0;int first=Math.min(input.length-1,(int)at),next=Math.min(input.length-1,first+1);
            out[i]=(short)Math.round(input[first]+(input[next]-input[first])*(at-first));
        }
        return out;
    }
    void listen(String language,Listener listener){
        if(closed.get())return;
        cancel();long job=generation.get();
        worker.execute(()->{
            Capture record=null;Runnable deadline=null,heartbeat=null;int packets=0;float peak=0;final AtomicBoolean decoding=new AtomicBoolean();
            try{
                if(app.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)throw new IllegalStateException("Mikrofon izni gerekli.");
                post(job,()->listener.state("Mikrofon hazırlanıyor…"));
                if(generation.get()!=job)return;
                record=captureFactory.open();recorder=record;
                if(generation.get()!=job)return;
                int rate=record.sampleRate();if(rate<16000||rate%50!=0)throw new IllegalStateException("Mikrofon örnek hızı desteklenmiyor: "+rate);
                post(job,()->{listener.recording(true);listener.state("● Çevrimdışı dinleme · "+LanguageCatalog.name(language));});
                SpeechBoundary boundary=new SpeechBoundary();float[] audio=new float[SpeechBoundary.MAX_SAMPLES];short[] source=new short[rate/50];int used=0,filled=0;
                long started=SystemClock.elapsedRealtime(),lastData=started,lastLevel=0,lastSecond=-1;
                diagnostics="Mikrofon açık · "+rate+" Hz";
                while(generation.get()==job&&finishRequested.get()!=job&&used+320<=audio.length&&!boundary.finished()){
                    long now=SystemClock.elapsedRealtime();
                    if(now-started>6500)break;
                    int count=record.read(source,filled,source.length-filled);
                    if(generation.get()!=job)return;
                    if(count<0)throw new IllegalStateException("Mikrofondan ses alınamadı ("+count+"). Diğer sesli uygulamaları kapatıp tekrar dene.");
                    if(count==0){if(now-lastData>3000)throw new IllegalStateException("Mikrofon açıldı fakat ses verisi gelmedi. Mikrofon gizlilik anahtarını ve uygulama iznini kontrol et.");Thread.sleep(10);continue;}
                    lastData=now;filled+=count;if(filled<source.length)continue;filled=0;packets++;
                    short[] frame=rate==16000?source:resample(source,rate);double energy=0;
                    for(int i=0;i<320;i++){float value=frame[i]/32768f;audio[used+i]=value;energy+=value*value;}
                    float rms=(float)Math.sqrt(energy/320);peak=Math.max(peak,rms);used+=320;boundary.accept(frame,320);
                    long seconds=used/16000;
                    if(seconds!=lastSecond){lastSecond=seconds;final long elapsed=seconds;post(job,()->listener.state("● Ses alınıyor · "+LanguageCatalog.name(language)+" · "+elapsed+" / 6 sn"));}
                    if(now-lastLevel>=150){lastLevel=now;final float level=Math.min(1,rms*12);post(job,()->listener.level(level));}
                }
                record.close();if(recorder==record)recorder=null;record=null;
                diagnostics="Ses alındı · paket="+packets+" · tepe="+String.format(java.util.Locale.ROOT,"%.4f",peak);
                post(job,()->{listener.recording(false);listener.level(0);});
                if(generation.get()!=job)return;
                if(!boundary.hasSpeech()){post(job,()->listener.error("Konuşma duyulmadı. Dil düğmesine dokunup mikrofona yakın konuş."));return;}
                float[] spoken=Arrays.copyOfRange(audio,boundary.startSample(),boundary.endSample(used));
                decoding.set(true);final long decodingStarted=SystemClock.elapsedRealtime();
                heartbeat=new Runnable(){public void run(){
                    if(generation.get()!=job||closed.get()||!decoding.get())return;
                    listener.state("Ses metne çevriliyor · "+LanguageCatalog.name(language)+" · "+((SystemClock.elapsedRealtime()-decodingStarted)/1000)+" sn");
                    main.postDelayed(this,1000);
                }};
                main.post(heartbeat);
                deadline=()->{if(generation.get()==job&&!closed.get()){cancel();listener.error("Yerel ses çözümleme zaman aşımına uğradı. Daha kısa bir cümleyle tekrar dene.");}};
                main.postDelayed(deadline,45000);
                String text;
                if(decoder!=null)text=decoder.decode(spoken,language);
                else text=decodeNative(spoken,language,job);
                if(generation.get()!=job)return;
                diagnostics+=" · çözümleme tamamlandı";
                post(job,()->{if(text.isEmpty())listener.error("Konuşma çözümlenemedi. Daha net ve kısa bir cümleyle tekrar dene.");else listener.result(text);});
            }catch(Exception|LinkageError|OutOfMemoryError e){
                diagnostics="Ses hatası · "+e.getClass().getSimpleName()+": "+e.getMessage();
                post(job,()->{listener.recording(false);listener.level(0);listener.error(e.getMessage()==null?"Yerel ses motoru çalıştırılamadı.":e.getMessage());});
            }finally{
                decoding.set(false);
                if(deadline!=null)main.removeCallbacks(deadline);
                if(heartbeat!=null)main.removeCallbacks(heartbeat);
                if(record!=null){record.close();if(recorder==record)recorder=null;}
            }
        });
    }
    private String decodeNative(float[] spoken,String language,long job)throws IOException{
        String model=language.equals("en")?"ggml-tiny.en-q5_1.bin":"ggml-base-q5_1.bin";
        if(context!=0&&!loadedModel.equals(model)){synchronized(nativeLock){NativeWhisper.destroy(context);context=0;}}
        if(context==0){long loaded=NativeWhisper.create(modelFile(model).getAbsolutePath());synchronized(nativeLock){context=loaded;loadedModel=model;}}
        synchronized(nativeLock){NativeWhisper.reset(context);}
        if(generation.get()!=job)return "";
        byte[] bytes=NativeWhisper.transcribe(context,spoken,language,Math.min(4,Runtime.getRuntime().availableProcessors()));
        return new String(bytes==null?new byte[0]:bytes,StandardCharsets.UTF_8).trim();
    }
    /** Finish the current utterance without cancelling its recognition or translation. */
    void finishCapture(){finishRequested.set(generation.get());}
    private File modelFile(String name)throws IOException{
        File dir=new File(app.getNoBackupFilesDir(),"speech");if(!dir.exists()&&!dir.mkdirs())throw new IOException("Ses modeli klasörü açılamadı.");
        File file=new File(dir,name);
        try(android.content.res.AssetFileDescriptor asset=app.getAssets().openFd("models/"+name)){if(file.exists()&&file.length()==asset.getLength())return file;}
        File temp=new File(dir,name+".tmp");
        try(InputStream in=app.getAssets().open("models/"+name);OutputStream out=new FileOutputStream(temp)){
            byte[] buffer=new byte[65536];int count;while((count=in.read(buffer))!=-1)out.write(buffer,0,count);
        }
        if(!temp.renameTo(file))throw new IOException("Ses modeli hazırlanamadı.");return file;
    }
    void cancel(){
        generation.incrementAndGet();Capture active=recorder;if(active!=null)active.close();
        synchronized(nativeLock){if(context!=0)NativeWhisper.cancel(context);}
    }
    @Override public void close(){
        if(!closed.compareAndSet(false,true))return;cancel();
        worker.execute(()->{synchronized(nativeLock){if(context!=0){NativeWhisper.destroy(context);context=0;}}});worker.shutdown();
    }
}
