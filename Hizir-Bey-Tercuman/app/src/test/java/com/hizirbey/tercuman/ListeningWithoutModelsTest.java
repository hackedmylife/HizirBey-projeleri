package com.hizirbey.tercuman;
import android.Manifest;
import android.content.*;
import android.widget.*;
import java.time.Duration;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.*;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk={28,33})
public class ListeningWithoutModelsTest {
    @Before public void prefs(){RuntimeEnvironment.getApplication().getSharedPreferences("tercuman",0).edit().clear().putBoolean("setupOfferV2",true).putBoolean("preferEmbedded",true).putBoolean("autoSpeak",false).commit();}
    @Test public void talkButtonListensBeforeAnyTranslationModelRequest(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.RECORD_AUDIO);
        SpeechRepairTest.FakeSpeech speech=injectSpeech(a);AppBehaviorTest.FakeEngine engine=injectEngine(a);
        ReflectionHelpers.callInstanceMethod(a,"startVoice",ReflectionHelpers.ClassParameter.from(int.class,0));
        assertEquals("tr",speech.language);assertNull(engine.ready);
        speech.listener.result("Merhaba");assertNotNull(engine.ready);assertNull(engine.result);
        assertEquals("Merhaba",((EditText)ReflectionHelpers.getField(a,"input")).getText().toString());
        engine.ready.success(null);assertEquals("Merhaba",engine.input);engine.result.success("Hello");
        assertEquals("Hello",((TextView)ReflectionHelpers.getField(a,"output")).getText().toString());c.pause().stop().destroy();
    }
    @Test public void stuckModelTimesOutAndCannotOverwriteAfterTheDeadline(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();AppBehaviorTest.FakeEngine engine=injectEngine(a);
        ReflectionHelpers.callInstanceMethod(a,"changeMode",ReflectionHelpers.ClassParameter.from(int.class,1));
        ((EditText)ReflectionHelpers.getField(a,"input")).setText("Merhaba");ReflectionHelpers.callInstanceMethod(a,"submitText");
        TranslationEngine.Callback<Void> late=engine.ready;Shadows.shadowOf(android.os.Looper.getMainLooper()).idleFor(Duration.ofSeconds(91));
        assertFalse((boolean)ReflectionHelpers.getField(a,"preparationActive"));assertNotNull(ShadowAlertDialog.getLatestAlertDialog());
        assertEquals("Merhaba",((EditText)ReflectionHelpers.getField(a,"input")).getText().toString());late.success(null);assertNull(engine.result);
        ShadowAlertDialog.getLatestAlertDialog().getButton(DialogInterface.BUTTON_NEGATIVE).performClick();c.pause().stop().destroy();
    }
    @Test public void microphonePermissionGrantedBeforeResumeIsDeferredUntilVisible(){
        ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=c.get();SpeechRepairTest.FakeSpeech speech=injectSpeech(a);injectEngine(a);
        c.pause();ReflectionHelpers.setField(a,"permissionSide",0);
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.RECORD_AUDIO);
        a.onRequestPermissionsResult(10,new String[]{Manifest.permission.RECORD_AUDIO},new int[]{android.content.pm.PackageManager.PERMISSION_GRANTED});
        assertNull(speech.language);c.resume();ShadowLooper.idleMainLooper();assertEquals("tr",speech.language);c.pause().stop().destroy();
    }
    private SpeechRepairTest.FakeSpeech injectSpeech(MainActivity a){((EmbeddedSpeech)ReflectionHelpers.getField(a,"embeddedSpeech")).close();SpeechRepairTest.FakeSpeech f=new SpeechRepairTest.FakeSpeech(a);ReflectionHelpers.setField(a,"embeddedSpeech",f);return f;}
    private AppBehaviorTest.FakeEngine injectEngine(MainActivity a){((TranslationEngine)ReflectionHelpers.getField(a,"engine")).close();AppBehaviorTest.FakeEngine f=new AppBehaviorTest.FakeEngine();ReflectionHelpers.setField(a,"engine",f);return f;}
}
