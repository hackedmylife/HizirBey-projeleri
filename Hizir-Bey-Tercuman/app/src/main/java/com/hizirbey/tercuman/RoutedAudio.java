package com.hizirbey.tercuman;
import android.content.Context;
import android.media.*;
import android.os.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Owns only this application's playback. It never changes the global speakerphone mode. */
final class RoutedAudio implements AutoCloseable {
    interface Callback {void done();void error(String message);}
    private final AudioManager manager;private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService worker=Executors.newSingleThreadExecutor();private final AtomicInteger generation=new AtomicInteger();
    private volatile AudioTrack current;private volatile int chosenId=-1;private volatile Callback callback;
    private final AudioDeviceCallback devices=new AudioDeviceCallback(){@Override public void onAudioDevicesRemoved(AudioDeviceInfo[] removed){for(AudioDeviceInfo d:removed)if(d.getId()==chosenId){Callback cb=callback;stop();if(cb!=null)cb.error("Ses çıkışının bağlantısı kesildi. Seslendirme durduruldu.");break;}}};
    RoutedAudio(Context context){manager=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);manager.registerAudioDeviceCallback(devices,main);}
    static boolean headphones(int type){return type==AudioDeviceInfo.TYPE_WIRED_HEADSET||type==AudioDeviceInfo.TYPE_WIRED_HEADPHONES||type==AudioDeviceInfo.TYPE_BLUETOOTH_A2DP||type==AudioDeviceInfo.TYPE_BLUETOOTH_SCO||type==AudioDeviceInfo.TYPE_USB_HEADSET||type==AudioDeviceInfo.TYPE_BLE_HEADSET||type==AudioDeviceInfo.TYPE_HEARING_AID;}
    AudioDeviceInfo output(boolean privateAudio){for(AudioDeviceInfo d:manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS))if(privateAudio?headphones(d.getType()):d.getType()==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER)return d;return null;}
    String outputs(){StringBuilder s=new StringBuilder();for(AudioDeviceInfo d:manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS))s.append(d.getProductName()).append(" · ").append(d.getType()==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER?"Telefon hoparlörü":headphones(d.getType())?"Kulaklık":"Diğer çıkış").append('\n');return s.toString();}
    void play(File file,boolean privateAudio,Callback cb){
        stop();int request=generation.get();callback=cb;
        AudioDeviceInfo target=output(privateAudio);if(target==null){file.delete();callback=null;cb.error(privateAudio?"Kulaklık bağlı değil. Türkçe çeviri seslendirilmedi.":"Telefon hoparlörü bulunamadı.");return;}chosenId=target.getId();
        worker.execute(()->{AudioTrack track=null;String failure=null;
            try(Wave wave=new Wave(file)){
                if(request!=generation.get())return;
                int channel=wave.channels==1?AudioFormat.CHANNEL_OUT_MONO:AudioFormat.CHANNEL_OUT_STEREO;
                int encoding=wave.bits==8?AudioFormat.ENCODING_PCM_8BIT:wave.format==3?AudioFormat.ENCODING_PCM_FLOAT:AudioFormat.ENCODING_PCM_16BIT;
                int min=AudioTrack.getMinBufferSize(wave.rate,channel,encoding);if(min<0)throw new IOException("Ses biçimi desteklenmiyor.");
                track=new AudioTrack.Builder().setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                    .setAudioFormat(new AudioFormat.Builder().setSampleRate(wave.rate).setChannelMask(channel).setEncoding(encoding).build()).setBufferSizeInBytes(Math.max(min,4096)).setTransferMode(AudioTrack.MODE_STREAM).build();
                if(request!=generation.get())return;current=track;
                if(!track.setPreferredDevice(target))throw new IOException("Telefon seçilen ses çıkışına izin vermedi.");
                // Verify the real route while muted, before putting speech in the buffer.
                track.setVolume(0);track.play();byte[] silence=new byte[Math.max(128,wave.rate*wave.channels*(wave.bits/8)/10)];if(wave.bits==8)java.util.Arrays.fill(silence,(byte)128);
                track.write(silence,0,silence.length,AudioTrack.WRITE_BLOCKING);
                long until=SystemClock.elapsedRealtime()+1500;AudioDeviceInfo routed;
                do{if(request!=generation.get())return;routed=track.getRoutedDevice();if(routed!=null&&routed.getId()==target.getId())break;SystemClock.sleep(20);}while(SystemClock.elapsedRealtime()<until);
                if(routed==null||routed.getId()!=target.getId())throw new IOException("Android bu çıkışı kullanmadı. Seslendirme güvenli biçimde durduruldu; başka kulaklık veya normal ses modu dene.");
                track.setVolume(1f);int frame=wave.channels*(wave.bits/8);int block=Math.max(frame,wave.rate*frame/50);byte[] bytes=new byte[block];long left=wave.length,written=silence.length;
                while(left>0&&request==generation.get()){
                    AudioDeviceInfo actual=track.getRoutedDevice();if(actual==null||actual.getId()!=target.getId())throw new IOException("Ses çıkışı değişti. Seslendirme durduruldu.");
                    int n=wave.input.read(bytes,0,(int)Math.min(bytes.length,left));if(n<0)throw new EOFException("Eksik ses verisi.");
                    int offset=0;while(offset<n&&request==generation.get()){int sent=track.write(bytes,offset,n-offset,AudioTrack.WRITE_BLOCKING);if(sent<0)throw new IOException("Ses çıkışı kapandı.");if(sent==0){SystemClock.sleep(5);continue;}offset+=sent;written+=sent;}left-=n;
                }
                long frames=written/frame;long deadline=SystemClock.elapsedRealtime()+5000;
                while(request==generation.get()&&Integer.toUnsignedLong(track.getPlaybackHeadPosition())<frames&&SystemClock.elapsedRealtime()<deadline){AudioDeviceInfo actual=track.getRoutedDevice();if(actual==null||actual.getId()!=target.getId())throw new IOException("Ses çıkışı değişti. Seslendirme durduruldu.");SystemClock.sleep(20);}
            }catch(Exception e){failure=e.getMessage()==null?"Ses çıkışına erişilemedi.":e.getMessage();}
            finally{if(current==track)current=null;if(track!=null){try{track.pause();track.flush();}catch(RuntimeException ignored){}track.release();}file.delete();}
            if(request==generation.get()){String error=failure;callback=null;chosenId=-1;main.post(()->{if(request==generation.get()){if(error==null)cb.done();else cb.error(error);}});}
        });
    }
    void stop(){generation.incrementAndGet();chosenId=-1;callback=null;AudioTrack track=current;if(track!=null){try{track.pause();track.flush();}catch(RuntimeException ignored){}}}
    @Override public void close(){stop();manager.unregisterAudioDeviceCallback(devices);worker.shutdownNow();}
    static final class Wave implements AutoCloseable {
        final RandomAccessFile input;int rate,channels,bits,format;long length;
        Wave(File file)throws IOException{input=new RandomAccessFile(file,"r");try{
            if(!tag(input).equals("RIFF")){throw new IOException("WAV sesi bekleniyordu.");}u32(input);if(!tag(input).equals("WAVE"))throw new IOException("Geçersiz ses dosyası.");
            boolean fmt=false,data=false;
            while(input.getFilePointer()+8<=input.length()){String kind=tag(input);long size=u32(input),start=input.getFilePointer(),end=start+size;
                if(end>input.length()||end<start)throw new IOException("Eksik ses dosyası.");
                if(kind.equals("fmt ")){if(size<16)throw new IOException("Geçersiz ses biçimi.");format=u16(input);channels=u16(input);rate=(int)u32(input);u32(input);u16(input);bits=u16(input);fmt=true;}
                if(kind.equals("data")){if(!fmt)throw new IOException("Ses biçimi eksik.");length=size;data=true;break;}
                input.seek(end+(size&1));
            }
            if(!data||length<=0||length>32000000||rate<8000||rate>192000||channels<1||channels>2||!((format==1&&(bits==8||bits==16))||(format==3&&bits==32))||length%(channels*(bits/8))!=0)throw new IOException("Ses motorunun WAV biçimi desteklenmiyor.");
        }catch(IOException e){input.close();throw e;}}
        private static String tag(RandomAccessFile in)throws IOException{byte[] b=new byte[4];in.readFully(b);return new String(b,StandardCharsets.US_ASCII);}
        private static int u16(RandomAccessFile in)throws IOException{return in.readUnsignedByte()|in.readUnsignedByte()<<8;}
        private static long u32(RandomAccessFile in)throws IOException{return Integer.toUnsignedLong(Integer.reverseBytes(in.readInt()));}
        public void close()throws IOException{input.close();}
    }
}
