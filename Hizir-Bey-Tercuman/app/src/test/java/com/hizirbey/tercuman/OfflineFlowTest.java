package com.hizirbey.tercuman;

import android.Manifest;
import android.content.*;
import android.view.*;
import android.widget.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk={28,33})
public class OfflineFlowTest {
    @Before public void setup(){
        RuntimeEnvironment.getApplication().getSharedPreferences("tercuman",0).edit().clear()
            .putBoolean("setupOfferV2",true).putBoolean("autoSpeak",false).commit();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.RECORD_AUDIO);
    }
    private SpeechRepairTest.FakeSpeech inject(MainActivity a){
        ((EmbeddedSpeech)ReflectionHelpers.getField(a,"embeddedSpeech")).close();
        SpeechRepairTest.FakeSpeech local=new SpeechRepairTest.FakeSpeech(a);ReflectionHelpers.setField(a,"embeddedSpeech",local);
        ((TranslationEngine)ReflectionHelpers.getField(a,"engine")).close();ReflectionHelpers.setField(a,"engine",new AppBehaviorTest.FakeEngine());return local;
    }
    @Test public void changingLanguageRestartsCaptureAndRejectsPreviousLanguageResult(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();
        SpeechRepairTest.FakeSpeech local=inject(a);
        ReflectionHelpers.callInstanceMethod(a,"startVoice",ReflectionHelpers.ClassParameter.from(int.class,0));
        assertEquals("tr",local.language);EmbeddedSpeech.Listener previous=local.listener;
        ReflectionHelpers.callInstanceMethod(a,"changeLanguages",ReflectionHelpers.ClassParameter.from(String.class,"en"),ReflectionHelpers.ClassParameter.from(String.class,"tr"));
        assertEquals("en",local.language);assertTrue((boolean)ReflectionHelpers.getField(a,"sessionActive"));
        previous.result("ESKİ TÜRKÇE");assertEquals("",ReflectionHelpers.getField(a,"draft"));
        local.listener.result("Hello");assertEquals("Hello",ReflectionHelpers.getField(a,"draft"));
        c.pause().stop().destroy();
    }
    @Test public void oldDetachedSpinnerCannotChangeTheNewLanguageOrStopListening(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();
        SpeechRepairTest.FakeSpeech local=inject(a);Spinner old=findSpinner(ReflectionHelpers.getField(a,"root"));assertNotNull(old);
        ReflectionHelpers.callInstanceMethod(a,"startVoice",ReflectionHelpers.ClassParameter.from(int.class,0));
        ReflectionHelpers.callInstanceMethod(a,"changeLanguages",ReflectionHelpers.ClassParameter.from(String.class,"en"),ReflectionHelpers.ClassParameter.from(String.class,"tr"));
        java.util.List<String> languages=ReflectionHelpers.getField(a,"languages");
        old.getOnItemSelectedListener().onItemSelected(old,null,languages.indexOf("mk"),0);
        assertEquals("en",ReflectionHelpers.getField(a,"source"));assertEquals("en",local.language);
        assertTrue((boolean)ReflectionHelpers.getField(a,"sessionActive"));c.pause().stop().destroy();
    }
    @Test public void allReportedLanguagesUseBundledRecognitionRegardlessOfOldPreferences(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();SpeechRepairTest.FakeSpeech local=inject(a);
        a.getSharedPreferences("tercuman",0).edit().putBoolean("preferEmbedded",false).putBoolean("strictOffline",false).commit();
        for(String code:new String[]{"tr","en","mk","de","fr"}){
            ReflectionHelpers.callInstanceMethod(a,"changeLanguages",ReflectionHelpers.ClassParameter.from(String.class,code),ReflectionHelpers.ClassParameter.from(String.class,code.equals("tr")?"en":"tr"));
            ReflectionHelpers.callInstanceMethod(a,"startVoice",ReflectionHelpers.ClassParameter.from(int.class,0));assertEquals(code,local.language);
        }
        ReflectionHelpers.callInstanceMethod(a,"stopSession");assertFalse((boolean)ReflectionHelpers.getField(a,"microphoneActive"));
        assertFalse(((Button)ReflectionHelpers.getField(a,"firstTalk")).getText().toString().startsWith("●"));c.pause().stop().destroy();
    }
    @Test public void finishButtonKeepsTheSessionSoTheCapturedWordsCanReachTranslation(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();SpeechRepairTest.FakeSpeech local=inject(a);
        ReflectionHelpers.callInstanceMethod(a,"startVoice",ReflectionHelpers.ClassParameter.from(int.class,0));
        SessionGate gate=ReflectionHelpers.getField(a,"gate");long token=gate.current();
        local.listener.recording(true);Button button=ReflectionHelpers.getField(a,"stopButton");assertEquals("Bitir ve çevir",button.getText().toString());
        button.performClick();assertEquals(1,local.finishes);assertEquals(token,gate.current());assertTrue((boolean)ReflectionHelpers.getField(a,"sessionActive"));
        assertEquals("İptal",button.getText().toString());local.listener.result("Merhaba");
        AppBehaviorTest.FakeEngine engine=ReflectionHelpers.getField(a,"engine");assertNotNull(engine.ready);engine.ready.success(null);assertEquals("Merhaba",engine.input);
        c.pause().stop().destroy();
    }
    @Test public void partialWordsAppearWithoutTriggeringTranslationOrStoppingCapture(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();SpeechRepairTest.FakeSpeech local=inject(a);
        ReflectionHelpers.callInstanceMethod(a,"startVoice",ReflectionHelpers.ClassParameter.from(int.class,0));local.listener.recording(true);local.listener.partial("Merhaba arkadaşım");
        assertEquals("Merhaba arkadaşım",ReflectionHelpers.getField(a,"draft"));assertTrue((boolean)ReflectionHelpers.getField(a,"microphoneActive"));
        AppBehaviorTest.FakeEngine engine=ReflectionHelpers.getField(a,"engine");assertNull(engine.ready);assertNull(engine.result);
        c.pause().stop().destroy();
    }
    private Spinner findSpinner(View view){if(view instanceof Spinner)return (Spinner)view;if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++){Spinner result=findSpinner(group.getChildAt(i));if(result!=null)return result;}}return null;}
}
