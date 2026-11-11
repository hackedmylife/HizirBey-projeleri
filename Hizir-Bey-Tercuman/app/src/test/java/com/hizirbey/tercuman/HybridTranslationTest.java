package com.hizirbey.tercuman;
import android.os.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import org.robolectric.shadows.ShadowLooper;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=33)
public class HybridTranslationTest {
    FakeLocal local;FakeCloud cloud;FakePolicy policy;HybridTranslationEngine engine;
    @Before public void setup(){local=new FakeLocal();cloud=new FakeCloud();policy=new FakePolicy();engine=new HybridTranslationEngine(local,cloud,policy,new Handler(Looper.getMainLooper()),s->{});}
    @After public void close(){engine.close();}
    @Test public void disabledModeMakesNoCloudRequest()throws Exception{policy.enabled=false;AtomicReference<String> result=run();assertEquals("yerel",result.get());assertEquals(0,cloud.calls.get());assertEquals(1,local.prepares);}
    @Test public void airplaneModeMakesNoCloudRequest()throws Exception{policy.online=false;AtomicReference<String> result=run();assertEquals("yerel",result.get());assertEquals(0,cloud.calls.get());}
    @Test public void cloudSuccessNeedsNoLocalModelDownload()throws Exception{AtomicReference<String> result=run();await(result);assertEquals("bulut",result.get());assertEquals(0,local.prepares);assertEquals(1,cloud.calls.get());}
    @Test public void rateLimitFallsBackToLocalAndDoesNotTryAnotherPaidProvider()throws Exception{cloud.failure=true;AtomicReference<String> result=run();await(result);assertEquals("yerel",result.get());assertEquals(1,cloud.calls.get());assertEquals(1,local.prepares);}
    @Test public void repeatedTurnsDoNotKeepWaitingOnAFailedCloudConnection()throws Exception{cloud.failure=true;AtomicReference<String> first=run();await(first);AtomicReference<String> second=run();await(second);assertEquals("yerel",second.get());assertEquals(1,cloud.calls.get());}
    @Test public void stopRejectsLateCloudResult()throws Exception{cloud.block=true;AtomicReference<String> result=run();assertTrue(cloud.entered.await(2,TimeUnit.SECONDS));engine.cancelPreparation();cloud.release.countDown();Thread.sleep(50);ShadowLooper.idleMainLooper();assertNull(result.get());}
    @Test public void groqRequestContainsStructuredSourceTextAndDoesNotEmbedCredentials()throws Exception{org.json.JSONObject request=GroqClient.request("кошничка за пазарење","mk","tr");assertEquals("openai/gpt-oss-120b",request.getString("model"));org.json.JSONObject data=new org.json.JSONObject(request.getJSONArray("messages").getJSONObject(1).getString("content"));assertEquals("mk",data.getString("source_language"));assertEquals("tr",data.getString("target_language"));assertEquals("кошничка за пазарење",data.getString("text"));assertFalse(request.toString().contains("Bearer"));}
    @Test public void fastDialogueChoosesSmallerGroqModelAndBoundedOutput()throws Exception{org.json.JSONObject body=GroqClient.request("Merhaba","tr","mk",true);assertEquals("openai/gpt-oss-20b",body.getString("model"));assertTrue(body.getInt("max_completion_tokens")<=1536);assertEquals("openai/gpt-oss-120b",GroqClient.request("Merhaba","tr","mk").getString("model"));}
    private AtomicReference<String> run(){AtomicReference<String> result=new AtomicReference<>();engine.prepare("mk","tr",false,new TranslationEngine.Callback<Void>(){public void success(Void v){engine.translate("test","mk","tr",new TranslationEngine.Callback<String>(){public void success(String s){result.set(s);}public void failure(Exception e){throw new AssertionError(e);}});}public void failure(Exception e){throw new AssertionError(e);}});return result;}
    private void await(AtomicReference<String> result)throws Exception{long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(3);while(result.get()==null&&System.nanoTime()<deadline){Thread.sleep(10);ShadowLooper.idleMainLooper();}assertNotNull(result.get());}
    static class FakeLocal implements TranslationEngine {int prepares;public void prepare(String f,String t,boolean w,Callback<Void> c){prepares++;c.success(null);}public void translate(String s,String f,String t,Callback<String> c){c.success("yerel");}public void close(){}}
    static class FakePolicy implements HybridTranslationEngine.Policy {boolean enabled=true,online=true;public boolean enabled(){return enabled;}public boolean online(){return online;}public String key(){return "test-key";}}
    static class FakeCloud implements HybridTranslationEngine.Cloud {AtomicInteger calls=new AtomicInteger();boolean failure,block;CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);public String translate(String s,String f,String t,String k)throws Exception{calls.incrementAndGet();entered.countDown();if(block)release.await(2,TimeUnit.SECONDS);if(failure)throw new java.io.IOException("Groq limit");return "bulut";}public void cancel(){}}
}
