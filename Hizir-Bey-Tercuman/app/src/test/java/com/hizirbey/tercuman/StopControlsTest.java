package com.hizirbey.tercuman;

import android.Manifest;
import android.widget.*;
import android.speech.tts.TextToSpeech;
import java.time.Duration;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk={28,33})
public class StopControlsTest {
    @Before public void setup(){
        RuntimeEnvironment.getApplication().getSharedPreferences("tercuman",0).edit().clear().putBoolean("setupOfferV2",true).putBoolean("repeat",true).putBoolean("autoSpeak",false).commit();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.RECORD_AUDIO);
    }
    private SpeechRepairTest.FakeSpeech inject(MainActivity a){
        ((EmbeddedSpeech)ReflectionHelpers.getField(a,"embeddedSpeech")).close();SpeechRepairTest.FakeSpeech voice=new SpeechRepairTest.FakeSpeech(a);ReflectionHelpers.setField(a,"embeddedSpeech",voice);
        ((TranslationEngine)ReflectionHelpers.getField(a,"engine")).close();ReflectionHelpers.setField(a,"engine",new AppBehaviorTest.FakeEngine());return voice;
    }
    private void start(MainActivity a){ReflectionHelpers.callInstanceMethod(a,"startVoice",ReflectionHelpers.ClassParameter.from(int.class,0));}
    private Button stop(MainActivity a){return ReflectionHelpers.getField(a,"stopButton");}
    @Test public void stopIsSeparateFromFinishAndRejectsLateWords(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();SpeechRepairTest.FakeSpeech voice=inject(a);start(a);voice.listener.recording(true);
        Button finish=ReflectionHelpers.getField(a,"finishButton");assertEquals("Bitir ve çevir",finish.getText().toString());assertEquals("Durdur",stop(a).getText().toString());assertTrue(finish.isEnabled());
        voice.listener.partial("hello");stop(a).performClick();assertFalse((boolean)ReflectionHelpers.getField(a,"microphoneActive"));assertFalse((boolean)ReflectionHelpers.getField(a,"sessionActive"));assertFalse(finish.isEnabled());
        voice.listener.partial("STALE");voice.listener.result("STALE");assertEquals("hello",ReflectionHelpers.getField(a,"draft"));assertEquals(0,voice.finishes);
        c.pause().stop().destroy();
    }
    @Test public void stopRejectsLateTranslationAndStopsSpeechPlayback(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();SpeechRepairTest.FakeSpeech voice=inject(a);start(a);voice.listener.result("Hello");
        AppBehaviorTest.FakeEngine engine=ReflectionHelpers.getField(a,"engine");engine.ready.success(null);assertNotNull(engine.result);
        TextToSpeech tts=ReflectionHelpers.getField(a,"tts");tts.speak("Merhaba",TextToSpeech.QUEUE_FLUSH,null,"test-playback");assertFalse(Shadows.shadowOf(tts).isStopped());
        stop(a).performClick();assertTrue(Shadows.shadowOf(tts).isStopped());engine.result.success("GEÇ GELEN SONUÇ");assertEquals("",ReflectionHelpers.getField(a,"translation"));
        c.pause().stop().destroy();
    }
    @Test public void stopBlocksAnAlreadyScheduledAutomaticRestart(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();SpeechRepairTest.FakeSpeech voice=inject(a);start(a);voice.listener.result("Hello");
        AppBehaviorTest.FakeEngine engine=ReflectionHelpers.getField(a,"engine");engine.ready.success(null);engine.result.success("Merhaba");int calls=voice.calls;stop(a).performClick();
        Shadows.shadowOf(android.os.Looper.getMainLooper()).idleFor(Duration.ofSeconds(2));assertEquals(calls,voice.calls);assertFalse((boolean)ReflectionHelpers.getField(a,"sessionActive"));
        assertEquals("Durdur",stop(a).getText().toString());c.pause().stop().destroy();
    }
    @Test public void legitimateYouIsPreservedInTheSpeechAndTranslationFlow(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();SpeechRepairTest.FakeSpeech voice=inject(a);start(a);voice.listener.partial("you");voice.listener.result("you");
        AppBehaviorTest.FakeEngine engine=ReflectionHelpers.getField(a,"engine");engine.ready.success(null);assertEquals("you",engine.input);assertEquals("you",ReflectionHelpers.getField(a,"draft"));
        c.pause().stop().destroy();
    }
}
