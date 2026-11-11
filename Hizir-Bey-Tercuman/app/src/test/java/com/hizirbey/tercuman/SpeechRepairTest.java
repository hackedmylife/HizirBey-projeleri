package com.hizirbey.tercuman;
import android.content.*;
import android.speech.tts.*;
import android.widget.*;
import java.util.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import org.robolectric.shadows.ShadowLooper;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=33)
public class SpeechRepairTest {
    @Before public void prepare(){RuntimeEnvironment.getApplication().getSharedPreferences("tercuman",Context.MODE_PRIVATE).edit().clear().putBoolean("setupOfferV2",true).putBoolean("autoSpeak",false).commit();}
    @Test public void macedonianHasCountryLocale(){assertEquals("mk-MK",LanguageCatalog.speechTag("mk"));}
    @Test public void allPacksSkipEnglishAndPrioritizeReportedLanguages(){
        List<String> queue=PackSetup.downloadableLanguages(com.google.mlkit.nl.translate.TranslateLanguage.getAllLanguages());
        assertEquals(58,queue.size());assertFalse(queue.contains("en"));assertEquals("tr",queue.get(0));assertEquals("mk",queue.get(1));assertEquals(queue.size(),new HashSet<>(queue).size());
    }
    @Test public void voiceChoiceKeepsCorrectLanguageAndOfflineRequirement(){
        Voice english=new Voice("en",Locale.US,Voice.QUALITY_NORMAL,Voice.LATENCY_NORMAL,false,Collections.emptySet());
        Voice macedonian=new Voice("mk",Locale.forLanguageTag("mk-MK"),Voice.QUALITY_NORMAL,Voice.LATENCY_NORMAL,false,Collections.emptySet());
        Voice network=new Voice("mk-net",Locale.forLanguageTag("mk-MK"),Voice.QUALITY_HIGH,Voice.LATENCY_NORMAL,true,Collections.emptySet());
        Set<Voice> voices=new HashSet<>(Arrays.asList(english,macedonian,network));
        assertEquals(macedonian,VoiceSelector.choose(voices,Locale.forLanguageTag("mk-MK"),true));
        assertNull(VoiceSelector.choose(Collections.singleton(english),Locale.forLanguageTag("mk-MK"),false));
        assertNull(VoiceSelector.choose(Collections.singleton(network),Locale.forLanguageTag("mk-MK"),true));
    }
    @Test public void bothReportedLanguagesCanReachTurkishTranslationWithoutAndroidVoicePacks(){
        for(String language:Arrays.asList("en","mk")){
            ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();
            EmbeddedSpeech old=ReflectionHelpers.getField(a,"embeddedSpeech");old.close();FakeSpeech local=new FakeSpeech(a);ReflectionHelpers.setField(a,"embeddedSpeech",local);
            AppBehaviorTest.FakeEngine engine=new AppBehaviorTest.FakeEngine();((TranslationEngine)ReflectionHelpers.getField(a,"engine")).close();ReflectionHelpers.setField(a,"engine",engine);
            ReflectionHelpers.setField(a,"source","tr");ReflectionHelpers.setField(a,"target",language);ReflectionHelpers.setField(a,"activeSide",1);ReflectionHelpers.setField(a,"sessionActive",true);
            a.getSharedPreferences("tercuman",0).edit().putBoolean("preferEmbedded",true).commit();SessionGate gate=ReflectionHelpers.getField(a,"gate");
            ReflectionHelpers.callInstanceMethod(a,"beginListening",ReflectionHelpers.ClassParameter.from(long.class,gate.current()));
            assertEquals(language,local.language);local.listener.result(language.equals("en")?"Hello":"Здраво");
            assertEquals(language,engine.from);assertEquals("tr",engine.to);engine.result.success("Merhaba");
            assertEquals("Merhaba",((TextView)ReflectionHelpers.getField(a,"output")).getText().toString());
            c.pause().stop().destroy();
        }
    }
    @Test public void stopRejectsLateEmbeddedTranscription(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();
        ((EmbeddedSpeech)ReflectionHelpers.getField(a,"embeddedSpeech")).close();FakeSpeech local=new FakeSpeech(a);ReflectionHelpers.setField(a,"embeddedSpeech",local);
        ReflectionHelpers.setField(a,"target","mk");ReflectionHelpers.setField(a,"activeSide",1);ReflectionHelpers.setField(a,"sessionActive",true);
        SessionGate gate=ReflectionHelpers.getField(a,"gate");ReflectionHelpers.callInstanceMethod(a,"beginListening",ReflectionHelpers.ClassParameter.from(long.class,gate.current()));
        ReflectionHelpers.callInstanceMethod(a,"stopSession");local.listener.result("STALE");assertEquals("",ReflectionHelpers.getField(a,"draft"));c.pause().stop().destroy();
    }
    @Test public void firstOpenAsksBeforeDownloadingEverything(){
        RuntimeEnvironment.getApplication().getSharedPreferences("tercuman",0).edit().putBoolean("setupOfferV2",false).commit();
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();ShadowLooper.idleMainLooper();
        android.app.AlertDialog d=ShadowAlertDialog.getLatestAlertDialog();assertNotNull(d);assertTrue(d.isShowing());
        assertFalse(c.get().getSharedPreferences("tercuman",0).getBoolean("allPacksPending",false));
        d.getButton(android.content.DialogInterface.BUTTON_NEGATIVE).performClick();c.pause().stop().destroy();
    }
    static class FakeSpeech extends EmbeddedSpeech {String language;Listener listener;FakeSpeech(Context c){super(c);} @Override void listen(String language,Listener listener){this.language=language;this.listener=listener;}}
}
