package com.hizirbey.tercuman;

import android.content.*;
import android.widget.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk={28,33})
public class AppBehaviorTest {
    @Before public void cleanPrefs(){
        RuntimeEnvironment.getApplication().getSharedPreferences("tercuman",Context.MODE_PRIVATE).edit().clear().putBoolean("setupOfferV2",true).commit();
    }
    @Test public void historySurvivesRestartAndPreservesFavoriteOnOverflow(){
        SharedPreferences prefs=RuntimeEnvironment.getApplication().getSharedPreferences("history-test",Context.MODE_PRIVATE);
        prefs.edit().clear().commit();HistoryStore store=new HistoryStore(prefs);
        HistoryStore.Entry favorite=store.add("ilk","first","tr","en");store.toggle(favorite);
        for(int i=0;i<205;i++)store.add("metin"+i,"text"+i,"tr","en");
        assertEquals(200,store.all(false).size());
        HistoryStore restarted=new HistoryStore(prefs);assertEquals(200,restarted.all(false).size());
        assertEquals(1,restarted.all(true).size());assertEquals("ilk",restarted.all(true).get(0).original);
        restarted.clear();assertTrue(new HistoryStore(prefs).all(false).isEmpty());
    }
    @Test public void corruptHistoryDoesNotCrashStartup(){
        SharedPreferences prefs=RuntimeEnvironment.getApplication().getSharedPreferences("history-corrupt",Context.MODE_PRIVATE);
        prefs.edit().putString("history","not json").commit();assertTrue(new HistoryStore(prefs).all(false).isEmpty());
    }
    @Test public void lateTranslationAfterTabChangeDoesNotOverwriteScreen(){
        ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();
        MainActivity activity=controller.get();FakeEngine fake=new FakeEngine();
        ((TranslationEngine)ReflectionHelpers.getField(activity,"engine")).close();ReflectionHelpers.setField(activity,"engine",fake);
        ReflectionHelpers.callInstanceMethod(activity,"changeMode",ReflectionHelpers.ClassParameter.from(int.class,1));
        EditText input=ReflectionHelpers.getField(activity,"input");input.setText("Merhaba");
        ReflectionHelpers.callInstanceMethod(activity,"submitText");fake.ready.success(null);assertNotNull(fake.result);
        ReflectionHelpers.callInstanceMethod(activity,"changeMode",ReflectionHelpers.ClassParameter.from(int.class,0));
        fake.result.success("STALE");assertEquals("",ReflectionHelpers.getField(activity,"translation"));
        assertTrue(new HistoryStore(activity.getSharedPreferences("tercuman",Context.MODE_PRIVATE)).all(false).isEmpty());
        controller.pause().stop().destroy();
    }
    @Test public void textTranslationUsesInjectedEngineAndRespectsHistoryPreference(){
        ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();
        MainActivity activity=controller.get();FakeEngine fake=new FakeEngine();
        activity.getSharedPreferences("tercuman",Context.MODE_PRIVATE).edit().putBoolean("autoSpeak",false).putBoolean("saveHistory",false).commit();
        ((TranslationEngine)ReflectionHelpers.getField(activity,"engine")).close();ReflectionHelpers.setField(activity,"engine",fake);
        ReflectionHelpers.callInstanceMethod(activity,"changeMode",ReflectionHelpers.ClassParameter.from(int.class,1));
        ((EditText)ReflectionHelpers.getField(activity,"input")).setText("Merhaba");
        ReflectionHelpers.callInstanceMethod(activity,"submitText");fake.ready.success(null);fake.result.success("Hello");
        assertEquals("Merhaba",fake.input);assertEquals("tr",fake.from);assertEquals("en",fake.to);
        assertEquals("Hello",((TextView)ReflectionHelpers.getField(activity,"output")).getText().toString());
        assertTrue(new HistoryStore(activity.getSharedPreferences("tercuman",Context.MODE_PRIVATE)).all(false).isEmpty());
        controller.pause().stop().destroy();
    }
    @Test public void backgroundingInvalidatesPendingDownload(){
        ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity activity=controller.get();
        FakeEngine fake=new FakeEngine();((TranslationEngine)ReflectionHelpers.getField(activity,"engine")).close();
        ReflectionHelpers.setField(activity,"engine",fake);
        ReflectionHelpers.callInstanceMethod(activity,"changeMode",ReflectionHelpers.ClassParameter.from(int.class,1));
        ((EditText)ReflectionHelpers.getField(activity,"input")).setText("Merhaba");ReflectionHelpers.callInstanceMethod(activity,"submitText");
        controller.pause();fake.ready.success(null);assertNull(fake.result);controller.stop().destroy();
    }
    @Test public void alternatingConversationSwitchesOnlyAfterTranslationCompletes(){
        ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=controller.get();
        a.getSharedPreferences("tercuman",Context.MODE_PRIVATE).edit().putBoolean("autoSpeak",false).putBoolean("repeat",true).putBoolean("alternate",true).commit();
        FakeEngine fake=new FakeEngine();((TranslationEngine)ReflectionHelpers.getField(a,"engine")).close();ReflectionHelpers.setField(a,"engine",fake);
        ReflectionHelpers.setField(a,"sessionActive",true);ReflectionHelpers.setField(a,"activeSide",0);
        SessionGate gate=ReflectionHelpers.getField(a,"gate");
        ReflectionHelpers.callInstanceMethod(a,"translate",ReflectionHelpers.ClassParameter.from(String.class,"Merhaba"),
            ReflectionHelpers.ClassParameter.from(String.class,"tr"),ReflectionHelpers.ClassParameter.from(String.class,"en"),
            ReflectionHelpers.ClassParameter.from(long.class,gate.current()),ReflectionHelpers.ClassParameter.from(boolean.class,true));
        assertEquals(0,(int)ReflectionHelpers.getField(a,"activeSide"));fake.result.success("Hello");
        assertEquals(1,(int)ReflectionHelpers.getField(a,"activeSide"));
        controller.pause().stop().destroy();
    }
    @Test public void reverseConversationKeepsOriginalLanguageLabelWhenScreenRebuilds(){
        ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity a=controller.get();
        ReflectionHelpers.setField(a,"draft","Hello");ReflectionHelpers.setField(a,"draftFrom","en");
        ReflectionHelpers.callInstanceMethod(a,"render");
        assertTrue(((TextView)ReflectionHelpers.getField(a,"originalLabel")).getText().toString().contains("İngilizce"));
        assertEquals(59,((java.util.List<?>)ReflectionHelpers.getField(a,"languages")).size());
        controller.pause().stop().destroy();
    }
    static class FakeEngine implements TranslationEngine {
        Callback<Void> ready;Callback<String> result;String input,from,to;
        public void prepare(String from,String to,boolean wifi,Callback<Void> cb){ready=cb;}
        public void translate(String text,String from,String to,Callback<String> cb){input=text;this.from=from;this.to=to;result=cb;}
        public void close(){}
    }
}
