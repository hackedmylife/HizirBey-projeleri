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
import java.util.concurrent.atomic.AtomicLong;

/** CPU-only multilingual recognizer; no Android speech pack, API or network required. */
class EmbeddedSpeech implements AutoCloseable {
    interface Listener {void state(String value);void result(String text);void error(String message);}
    private final Context app;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicLong generation=new AtomicLong();
    private final Object nativeLock=new Object();
    private volatile AudioRecord recorder;
    private long context;
    EmbeddedSpeech(Context app){this.app=app.getApplicationContext();}
    private void post(long job,Runnable task){main.post(()->{if(generation.get()==job)task.run();});}
    void listen(String language,Listener listener){
        cancel();long job=generation.get();
        worker.execute(()->{
            AudioRecord record=null;
            try{
                if(app.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)
                    throw new IllegalStateException("Mikrofon izni gerekli.");
                post(job,()->listener.state("Yerel ses motoru hazırlanıyor…"));
                if(context==0){File model=modelFile();long loaded=NativeWhisper.create(model.getAbsolutePath());synchronized(nativeLock){context=loaded;}}
                synchronized(nativeLock){NativeWhisper.reset(context);}
                if(generation.get()!=job)return;
                int minimum=AudioRecord.getMinBufferSize(16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
                if(minimum<0)throw new IllegalStateException("Mikrofon 16 kHz ses kaydını desteklemiyor.");
                record=new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(minimum,6400));
                if(record.getState()!=AudioRecord.STATE_INITIALIZED)throw new IllegalStateException("Mikrofon açılamadı.");
                recorder=record;record.startRecording();post(job,()->listener.state("● Yerel dinleme · "+LanguageCatalog.name(language)));
                SpeechBoundary boundary=new SpeechBoundary();float[] audio=new float[320000];short[] frame=new short[320];int used=0;
                while(generation.get()==job&&used+frame.length<=audio.length&&!boundary.finished()){
                    int count=record.read(frame,0,frame.length,AudioRecord.READ_BLOCKING);
                    if(count<=0)throw new IllegalStateException("Mikrofondan ses alınamadı.");
                    for(int i=0;i<count;i++)audio[used+i]=frame[i]/32768f;
                    used+=count;boundary.accept(frame,count);
                }
                recorder=null;record.stop();record.release();record=null;
                if(generation.get()!=job)return;
                if(!boundary.hasSpeech()){post(job,()->listener.error("Konuşma duyulmadı. Dil düğmesine dokunup tekrar konuş."));return;}
                float[] spoken=Arrays.copyOfRange(audio,boundary.startSample(),boundary.endSample(used));
                post(job,()->listener.state("Konuşma telefonda çözümleniyor · "+LanguageCatalog.name(language)));
                byte[] bytes=NativeWhisper.transcribe(context,spoken,language,Math.min(4,Runtime.getRuntime().availableProcessors()));
                String text=new String(bytes==null?new byte[0]:bytes,StandardCharsets.UTF_8).trim();
                post(job,()->{if(text.isEmpty())listener.error("Konuşma çözümlenemedi. Daha net ve kısa bir cümleyle tekrar dene.");else listener.result(text);});
            }catch(Exception|LinkageError|OutOfMemoryError e){
                post(job,()->listener.error(e.getMessage()==null?"Yerel ses motoru çalıştırılamadı.":e.getMessage()));
            }finally{
                if(record!=null){try{record.stop();}catch(RuntimeException ignored){}record.release();}
                recorder=null;
            }
        });
    }
    private File modelFile()throws IOException{
        File dir=new File(app.getNoBackupFilesDir(),"speech");if(!dir.exists()&&!dir.mkdirs())throw new IOException("Ses modeli klasörü açılamadı.");
        File file=new File(dir,"ggml-base-q5_1.bin");
        try(android.content.res.AssetFileDescriptor asset=app.getAssets().openFd("models/ggml-base-q5_1.bin")){
            if(file.exists()&&file.length()==asset.getLength())return file;
        }
        File temp=new File(dir,"model.tmp");
        try(InputStream in=app.getAssets().open("models/ggml-base-q5_1.bin");OutputStream out=new FileOutputStream(temp)){
            byte[] buffer=new byte[65536];int count;while((count=in.read(buffer))!=-1)out.write(buffer,0,count);
        }
        if(!temp.renameTo(file))throw new IOException("Ses modeli hazırlanamadı.");return file;
    }
    void cancel(){
        generation.incrementAndGet();
        AudioRecord active=recorder;if(active!=null)try{active.stop();}catch(RuntimeException ignored){}
        synchronized(nativeLock){if(context!=0)NativeWhisper.cancel(context);}
    }
    @Override public void close(){cancel();worker.execute(()->{synchronized(nativeLock){if(context!=0){NativeWhisper.destroy(context);context=0;}}});worker.shutdown();}
}
