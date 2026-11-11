package com.hizirbey.tercuman;

import android.content.*;
import android.graphics.*;
import android.os.*;
import android.speech.tts.*;
import android.provider.Settings;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.*;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import com.google.android.gms.tasks.Tasks;
import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class OfflineDeviceTest {
    private Context app;
    @Before public void setup()throws Exception{
        app=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("Test must run in airplane mode",1,Settings.Global.getInt(app.getContentResolver(),Settings.Global.AIRPLANE_MODE_ON,0));
        app.getSharedPreferences("tercuman",0).edit().putBoolean("setupOfferV2",true).putInt("offlineFlowVersion",3)
            .putBoolean("repeat",false).putBoolean("autoSpeak",false).putBoolean("allPacksPending",false).commit();
    }
    @Test public void platformMicrophoneProducesPcmWithoutRecognitionService()throws Exception{
        EmbeddedSpeech speech=new EmbeddedSpeech(app);Method open=EmbeddedSpeech.class.getDeclaredMethod("openPlatformCapture");open.setAccessible(true);
        EmbeddedSpeech.Capture capture=(EmbeddedSpeech.Capture)open.invoke(speech);
        try{
            short[] buffer=new short[1024];int total=0;long until=SystemClock.elapsedRealtime()+4000;
            while(total==0&&SystemClock.elapsedRealtime()<until){int count=capture.read(buffer,0,buffer.length);assertTrue("AudioRecord read error",count>=0);total+=count;if(count==0)SystemClock.sleep(20);}
            assertTrue("No PCM from Android microphone",total>0);
        }finally{capture.close();speech.close();}
    }
    @Test public void bundledEnglishRecognizerTranscribesWavThroughCapturePipeline()throws Exception{
        short[] pcm=readWav();AtomicInteger position=new AtomicInteger();
        EmbeddedSpeech speech=new EmbeddedSpeech(app,()->new EmbeddedSpeech.Capture(){
            public int sampleRate(){return 16000;}
            public int read(short[] buffer,int offset,int count){
                int start=position.getAndAdd(count);for(int i=0;i<count;i++)buffer[offset+i]=start+i<pcm.length?pcm[start+i]:0;SystemClock.sleep(1);return count;
            }
            public void close(){}
        });
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>(),error=new AtomicReference<>();
        speech.listen("en",new EmbeddedSpeech.Listener(){
            public void state(String value){android.util.Log.i("OfflineDeviceTest",value);}
            public void result(String value){result.set(value);done.countDown();}
            public void error(String value){error.set(value);done.countDown();}
        });
        try{long until=SystemClock.elapsedRealtime()+15000;while(position.get()<pcm.length+16000&&SystemClock.elapsedRealtime()<until)SystemClock.sleep(10);speech.finishCapture();assertTrue("Native inference did not finish",done.await(210,TimeUnit.SECONDS));assertNull(error.get());assertNotNull(result.get());assertTrue(result.get(),result.get().toLowerCase(Locale.ROOT).contains("fellow americans"));}
        finally{speech.close();}
    }
    @Test public void macedonianPhotoIsReadByBundledNativeOcr()throws Exception{
        Bitmap image=fixture("Здраво пријателе");
        try{String value=OfflinePhotoOcr.read(app,image);assertTrue(value,value.toLowerCase(Locale.ROOT).contains("здраво"));}finally{image.recycle();}
    }
    @Test public void englishPhotoIsReadByBundledMlKit()throws Exception{
        Bitmap image=fixture("HELLO FRIEND");TextRecognizer reader=TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        try{String value=Tasks.await(reader.process(InputImage.fromBitmap(image,0)),40,TimeUnit.SECONDS).getText();assertTrue(value,value.contains("HELLO"));}
        finally{reader.close();image.recycle();}
    }
    @Test public void languageChangeRestartsTheRealMicrophone()throws Exception{
        android.app.Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
        MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(app,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try{
            instrumentation.runOnMainSync(()->{
                try{call(activity,"changeLanguages",new Class[]{String.class,String.class},"en","tr");call(activity,"startVoice",new Class[]{int.class},0);}catch(Exception e){throw new RuntimeException(e);}
            });
            waitForMicrophone(activity);SystemClock.sleep(7500);assertTrue("Capture stopped without Finish",(boolean)field(activity,"microphoneActive"));
            instrumentation.runOnMainSync(()->{try{call(activity,"changeLanguages",new Class[]{String.class,String.class},"mk","tr");}catch(Exception e){throw new RuntimeException(e);}});
            waitForMicrophone(activity);assertEquals("mk",field(activity,"source"));
        }finally{instrumentation.runOnMainSync(activity::finish);instrumentation.waitForIdleSync();}
    }
    @Test public void espeakSynthesizesEnglishMacedonianAndTurkishOffline()throws Exception{
        CountDownLatch initialized=new CountDownLatch(1);AtomicInteger status=new AtomicInteger(-1);
        TextToSpeech voice=new TextToSpeech(app,value->{status.set(value);initialized.countDown();},"com.reecedunn.espeak");
        try{
            assertTrue(initialized.await(25,TimeUnit.SECONDS));assertEquals(TextToSpeech.SUCCESS,status.get());
            for(String code:new String[]{"en","mk","tr"}){
                Locale locale=Locale.forLanguageTag(LanguageCatalog.speechTag(code));Voice selected=VoiceSelector.choose(voice.getVoices(),locale,true);
                int supported=selected==null?voice.setLanguage(locale):voice.setVoice(selected);assertTrue("No offline voice: "+code,supported>=0);
                CountDownLatch done=new CountDownLatch(1);AtomicBoolean failed=new AtomicBoolean();
                voice.setOnUtteranceProgressListener(new UtteranceProgressListener(){public void onStart(String id){}public void onDone(String id){done.countDown();}public void onError(String id){failed.set(true);done.countDown();}});
                File output=new File(app.getCacheDir(),"voice-test-"+code+".wav");
                assertEquals(TextToSpeech.SUCCESS,voice.synthesizeToFile(code.equals("mk")?"Здраво пријателе":code.equals("tr")?"Merhaba arkadaşım":"Hello my friend",new Bundle(),output,code));
                assertTrue("Voice timeout: "+code,done.await(30,TimeUnit.SECONDS));assertFalse("Voice error: "+code,failed.get());assertTrue(output.length()>100);output.delete();
            }
        }finally{voice.shutdown();}
    }
    private void waitForMicrophone(MainActivity activity)throws Exception{
        long until=SystemClock.elapsedRealtime()+6000;
        while(SystemClock.elapsedRealtime()<until){if((boolean)field(activity,"microphoneActive"))return;SystemClock.sleep(50);}
        fail("Microphone never became active");
    }
    private static Object field(Object target,String name)throws Exception{Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
    private static Object call(Object target,String name,Class[] types,Object... values)throws Exception{Method method=target.getClass().getDeclaredMethod(name,types);method.setAccessible(true);return method.invoke(target,values);}
    private Bitmap fixture(String text){Bitmap b=Bitmap.createBitmap(1100,240,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(b);c.drawColor(Color.WHITE);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);paint.setColor(Color.BLACK);paint.setTextSize(76);paint.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));c.drawText(text,35,145,paint);return b;}
    private short[] readWav()throws Exception{
        byte[] bytes;try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("jfk.wav");ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);bytes=out.toByteArray();}
        ByteBuffer data=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);int at=12;
        while(at+8<=bytes.length){int length=data.getInt(at+4);if(new String(bytes,at,4,java.nio.charset.StandardCharsets.US_ASCII).equals("data")){short[] pcm=new short[length/2];for(int i=0;i<pcm.length;i++)pcm[i]=data.getShort(at+8+i*2);return pcm;}at+=8+length+(length%2);}
        throw new IOException("No WAV data");
    }
}
