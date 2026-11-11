package com.hizirbey.tercuman;
import android.content.*;
import android.graphics.*;
import android.media.*;
import android.os.*;
import android.provider.Settings;
import android.speech.tts.*;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class PhotoAudioDeviceTest {
    Context app;
    @Before public void setup(){app=InstrumentationRegistry.getInstrumentation().getTargetContext();assertEquals(1,Settings.Global.getInt(app.getContentResolver(),Settings.Global.AIRPLANE_MODE_ON,0));}
    @Test public void shoppingLabelIsCyrillicAndHasImageCoordinatesOffline()throws Exception{
        Bitmap image=Bitmap.createBitmap(850,160,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(image);canvas.drawColor(0xFFE1E1DF);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);paint.setColor(0xFF333333);paint.setTextSize(65);paint.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));canvas.drawText("кошничка за пазарење",30,105,paint);
        try{OfflinePhotoOcr.Result result=OfflinePhotoOcr.readDetailed(app,image);android.util.Log.i("PhotoAudioDeviceTest","MK OCR="+result.text+" confidence="+result.confidence+" regions="+result.regions.size());
            assertEquals("кошничка за пазарење",result.text.trim());assertFalse(result.regions.isEmpty());for(PhotoPage.Region area:result.regions){assertTrue(area.bounds.left>=0);assertTrue(area.bounds.right<=image.getWidth());assertTrue(area.bounds.bottom<=image.getHeight());}
        }finally{image.recycle();}
    }
    @Test public void privateScreenshotLabelCanBeCheckedWithoutBundlingUserImage()throws Exception{
        String path=InstrumentationRegistry.getArguments().getString("labelPath");Assume.assumeNotNull(path);
        Bitmap image=BitmapFactory.decodeFile(path);assertNotNull(image);
        try{OfflinePhotoOcr.Result result=OfflinePhotoOcr.readDetailed(app,image);android.util.Log.i("PhotoAudioDeviceTest","PRIVATE MK OCR="+result.text+" confidence="+result.confidence);assertTrue(result.text,result.text.contains("кошничка за пазарење"));assertFalse(result.regions.isEmpty());}finally{image.recycle();}
    }
    @Test public void audioTrackRoutesSynthesizedOfflineTurkishToSpeaker()throws Exception{
        CountDownLatch initialized=new CountDownLatch(1);AtomicInteger status=new AtomicInteger(-1);TextToSpeech tts=new TextToSpeech(app,s->{status.set(s);initialized.countDown();},"com.reecedunn.espeak");RoutedAudio audio=new RoutedAudio(app);File wave=new File(app.getCacheDir(),"route-smoke.wav");
        try{assertTrue(initialized.await(25,TimeUnit.SECONDS));assertEquals(TextToSpeech.SUCCESS,status.get());assertTrue(tts.setLanguage(java.util.Locale.forLanguageTag("tr"))>=0);
            CountDownLatch generated=new CountDownLatch(1);AtomicBoolean synthError=new AtomicBoolean();tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){public void onStart(String id){}public void onDone(String id){generated.countDown();}public void onError(String id){synthError.set(true);generated.countDown();}});
            assertEquals(TextToSpeech.SUCCESS,tts.synthesizeToFile("Alışveriş sepeti",new Bundle(),wave,"route"));assertTrue(generated.await(30,TimeUnit.SECONDS));assertFalse(synthError.get());
            CountDownLatch done=new CountDownLatch(1);AtomicReference<String> error=new AtomicReference<>();audio.play(wave,false,new RoutedAudio.Callback(){public void done(){done.countDown();}public void error(String value){error.set(value);done.countDown();}});
            assertTrue(done.await(20,TimeUnit.SECONDS));assertNull(error.get());
        }finally{tts.shutdown();audio.close();wave.delete();}
    }
    @Test public void absentHeadphonesNeverFallsBackToSpeaker()throws Exception{
        RoutedAudio audio=new RoutedAudio(app);try{Assume.assumeTrue(audio.output(true)==null);File wave=new File(app.getCacheDir(),"not-played.wav");try(FileOutputStream out=new FileOutputStream(wave)){out.write(1);}AtomicReference<String> error=new AtomicReference<>();audio.play(wave,true,new RoutedAudio.Callback(){public void done(){fail("Missing headphones played");}public void error(String value){error.set(value);}});assertNotNull(error.get());assertFalse(wave.exists());}finally{audio.close();}
    }
}
