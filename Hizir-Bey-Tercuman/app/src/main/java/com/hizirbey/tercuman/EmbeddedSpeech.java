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
        default void partial(String text) {}
    }
    interface Capture extends AutoCloseable {
        int sampleRate(); int read(short[] buffer,int offset,int count); void close();
    }
    interface CaptureFactory { Capture open() throws Exception; }
    interface Decoder { String decode(float[] samples,String language) throws Exception; }
    private final Context app;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final ExecutorService decodingWorker=Executors.newSingleThreadExecutor();
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
                if(app.getSharedPreferences("tercuman",0).getBoolean("splitAudio",false)&&app.getSharedPreferences("tercuman",0).getBoolean("phoneMic",true)){
                    AudioManager manager=(AudioManager)app.getSystemService(Context.AUDIO_SERVICE);AudioDeviceInfo builtin=null;
                    for(AudioDeviceInfo device:manager.getDevices(AudioManager.GET_DEVICES_INPUTS))if(device.getType()==AudioDeviceInfo.TYPE_BUILTIN_MIC){builtin=device;break;}
                    if(builtin==null||!record.setPreferredDevice(builtin))throw new IllegalStateException("Telefon mikrofonu seçilemedi. Kulaklık modunun mikrofon ayarını kontrol et.");
                }
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
    private static final class Turn {
        final long job;final String language;final Listener listener;
        final StringBuilder text=new StringBuilder(); // Decoding worker owns this.
        volatile boolean captureDone,heardSpeech;
        volatile Throwable decodingFailure;
        Turn(long job,String language,Listener listener){this.job=job;this.language=language;this.listener=listener;}
    }
    private boolean current(Turn turn){return !closed.get()&&generation.get()==turn.job;}
    void listen(String language,Listener listener){
        if(closed.get())return;
        cancel();Turn turn=new Turn(generation.get(),language,listener);
        worker.execute(()->capture(turn));
    }
    private void capture(Turn turn){
        Capture record=null;int packets=0;float peak=0;
        try{
            if(app.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)throw new IllegalStateException("Mikrofon izni gerekli.");
            post(turn.job,()->turn.listener.state("Mikrofon hazırlanıyor…"));if(!current(turn))return;
            record=captureFactory.open();recorder=record;if(!current(turn))return;
            int rate=record.sampleRate();if(rate<16000||rate%50!=0)throw new IllegalStateException("Mikrofon örnek hızı desteklenmiyor: "+rate);
            post(turn.job,()->{turn.listener.recording(true);turn.listener.state("● Dinleniyor · "+LanguageCatalog.name(turn.language)+" · Bitir ve çevir'e dokunana kadar");});
            SpeechBoundary boundary=new SpeechBoundary();short[] audio=new short[SpeechBoundary.MAX_SAMPLES],source=new short[rate/50];int used=0,filled=0;
            long started=SystemClock.elapsedRealtime(),lastData=started,lastLevel=0,lastSecond=-1;
            diagnostics="Mikrofon açık · "+rate+" Hz";
            // Silence and internal chunk boundaries never close the microphone.
            while(current(turn)&&finishRequested.get()!=turn.job){
                long now=SystemClock.elapsedRealtime();
                int count=record.read(source,filled,source.length-filled);if(!current(turn))return;
                if(count<0)throw new IllegalStateException("Mikrofondan ses alınamadı ("+count+"). Diğer sesli uygulamaları kapatıp tekrar dene.");
                if(count==0){if(now-lastData>3000)throw new IllegalStateException("Mikrofon açıldı fakat ses verisi gelmedi. Mikrofon gizlilik anahtarını ve uygulama iznini kontrol et.");Thread.sleep(10);continue;}
                lastData=now;filled+=count;if(filled<source.length)continue;filled=0;packets++;
                short[] frame=rate==16000?source:resample(source,rate);double energy=0;
                for(int i=0;i<320;i++){audio[used+i]=frame[i];float value=frame[i]/32768f;energy+=value*value;}
                float rms=(float)Math.sqrt(energy/320);peak=Math.max(peak,rms);used+=320;boundary.accept(frame,320);
                long seconds=(now-started)/1000;
                if(seconds!=lastSecond){lastSecond=seconds;final long elapsed=seconds;post(turn.job,()->{if(!turn.captureDone)turn.listener.state(turn.decodingFailure==null?"● Dinleniyor · "+LanguageCatalog.name(turn.language)+" · "+elapsed+" sn · Bitir ve çevir":"● Mikrofon açık · Ses çözümleme hatası · Bitir ve çevir ile tamamla");});}
                if(now-lastLevel>=150){lastLevel=now;final float level=Math.min(1,rms*12);post(turn.job,()->{if(!turn.captureDone)turn.listener.level(level);});}
                if(boundary.finished()){
                    submitAudio(turn,audio,boundary,used);
                    boundary=boundary.nextChunk();audio=new short[SpeechBoundary.MAX_SAMPLES];used=0;
                }
            }
            if(!current(turn))return;
            if(filled>0){
                Arrays.fill(source,filled,source.length,(short)0);short[] frame=rate==16000?source:resample(source,rate);
                System.arraycopy(frame,0,audio,used,320);used+=320;boundary.accept(frame,320);
            }
            record.close();if(recorder==record)recorder=null;record=null;turn.captureDone=true;
            diagnostics="Kayıt bitti · paket="+packets+" · tepe="+String.format(java.util.Locale.ROOT,"%.4f",peak);
            post(turn.job,()->{turn.listener.recording(false);turn.listener.level(0);turn.listener.state("Metin tamamlanıyor · "+LanguageCatalog.name(turn.language));});
            submitAudio(turn,audio,boundary,used);
            decodingWorker.execute(()->{
                if(!current(turn))return;
                if(turn.decodingFailure!=null){post(turn.job,()->turn.listener.error(turn.decodingFailure.getMessage()==null?"Ses çözümlenemedi.":turn.decodingFailure.getMessage()));return;}
                String text=turn.text.toString().trim();
                post(turn.job,()->{if(text.isEmpty())turn.listener.error(turn.heardSpeech?"Konuşma çözümlenemedi. Daha net bir cümleyle tekrar dene.":"Konuşma duyulmadı. Mikrofona yakın konuşup Bitir ve çevir'e dokun.");else turn.listener.result(text);});
            });
        }catch(Exception|LinkageError|OutOfMemoryError e){failTurn(turn,e);}
        finally{if(record!=null){record.close();if(recorder==record)recorder=null;}}
    }
    private void submitAudio(Turn turn,short[] audio,SpeechBoundary boundary,int used){
        if(!current(turn)||turn.decodingFailure!=null||!boundary.hasSpeech()||used==0)return;turn.heardSpeech=true;
        short[] pcm=Arrays.copyOfRange(audio,boundary.startSample(),boundary.endSample(used));
        decodingWorker.execute(()->decodeChunk(turn,pcm));
    }
    private void decodeChunk(Turn turn,short[] pcm){
        if(!current(turn)||turn.decodingFailure!=null||turn.text.length()>=4000)return;
        final AtomicBoolean decoding=new AtomicBoolean(true);final long started=SystemClock.elapsedRealtime();
        Runnable heartbeat=new Runnable(){public void run(){
            if(!current(turn)||!decoding.get())return;
            if(turn.captureDone)turn.listener.state("Metin tamamlanıyor · "+LanguageCatalog.name(turn.language)+" · "+((SystemClock.elapsedRealtime()-started)/1000)+" sn");
            main.postDelayed(this,1000);
        }};
        Runnable deadline=()->{if(current(turn)&&decoding.get())decodeFailed(turn,new java.util.concurrent.TimeoutException("Ses çözümleme 45 saniyede tamamlanmadı. Daha kısa ve net bir cümleyle yeniden dene."));};
        main.post(heartbeat);main.postDelayed(deadline,45000);
        try{
            float[] samples=new float[pcm.length];for(int i=0;i<pcm.length;i++)samples[i]=pcm[i]/32768f;
            String text=decoder==null?decodeNative(samples,turn.language,turn.job):decoder.decode(samples,turn.language);
            if(!current(turn)||turn.decodingFailure!=null||text==null)return;text=text.trim();
            if(!text.isEmpty()){
                if(turn.text.length()>0)turn.text.append(' ');turn.text.append(text);
                if(turn.text.length()>4000)turn.text.setLength(4000);
                String partial=turn.text.toString();post(turn.job,()->turn.listener.partial(partial));
            }
        }catch(Exception|LinkageError|OutOfMemoryError e){decodeFailed(turn,e);}
        finally{decoding.set(false);main.removeCallbacks(heartbeat);main.removeCallbacks(deadline);}
    }
    private void decodeFailed(Turn turn,Throwable error){
        if(!current(turn))return;turn.decodingFailure=error;
        synchronized(nativeLock){if(context!=0)NativeWhisper.cancel(context);}
        if(turn.captureDone)failTurn(turn,error);
        else post(turn.job,()->turn.listener.state("● Mikrofon açık · Ses çözümleme hatası · Bitir ve çevir ile tamamla"));
    }
    private void failTurn(Turn turn,Throwable error){
        post(turn.job,()->{
            diagnostics="Ses hatası · "+error.getClass().getSimpleName()+": "+error.getMessage();
            cancel();turn.listener.recording(false);turn.listener.level(0);
            turn.listener.error(error.getMessage()==null?"Yerel ses motoru çalıştırılamadı.":error.getMessage());
        });
    }
    private String decodeNative(float[] spoken,String language,long job)throws IOException{
        String model=language.equals("en")?"ggml-tiny.en-q5_1.bin":"ggml-base-q5_1.bin";
        if(context!=0&&!loadedModel.equals(model)){synchronized(nativeLock){NativeWhisper.destroy(context);context=0;}}
        if(context==0){long loaded=NativeWhisper.create(modelFile(model).getAbsolutePath());synchronized(nativeLock){context=loaded;loadedModel=model;}}
        synchronized(nativeLock){NativeWhisper.reset(context);}
        if(generation.get()!=job)return "";
        NativeWhisper.configureVad(context,modelFile("ggml-silero-v5.1.2.bin").getAbsolutePath());
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
        worker.shutdown();
        decodingWorker.execute(()->{synchronized(nativeLock){if(context!=0){NativeWhisper.destroy(context);context=0;}}});decodingWorker.shutdown();
    }
}
