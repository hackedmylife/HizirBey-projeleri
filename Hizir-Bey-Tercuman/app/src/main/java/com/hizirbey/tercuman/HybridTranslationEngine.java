package com.hizirbey.tercuman;
import android.content.Context;
import android.net.*;
import android.os.Handler;
import java.util.concurrent.*;
import java.util.function.Consumer;
final class HybridTranslationEngine implements TranslationEngine {
    interface Cloud {String translate(String text,String from,String to,String key)throws Exception;void cancel();}
    interface Policy {boolean enabled();boolean online();String key()throws Exception;}
    private final TranslationEngine local;private final Cloud cloud;private final Policy policy;private final Handler main;private final Consumer<String> status;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();private volatile long generation;private boolean readyCloud;private volatile boolean closed;
    HybridTranslationEngine(Context context,Handler handler,Consumer<String> status){
        this(new LocalTranslationEngine(context),new Cloud(){final GroqClient client=new GroqClient();public String translate(String t,String f,String to,String k)throws Exception{return client.translate(t,f,to,k);}public void cancel(){client.cancel();}},new Policy(){
            public boolean enabled(){return context.getSharedPreferences("tercuman",0).getBoolean("groqEnabled",false)&&ApiKeyStore.has(context);}
            public String key()throws Exception{return ApiKeyStore.read(context);}
            public boolean online(){ConnectivityManager manager=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);NetworkCapabilities network=manager.getNetworkCapabilities(manager.getActiveNetwork());return network!=null&&network.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);}
        },handler,status);
    }
    HybridTranslationEngine(TranslationEngine local,Cloud cloud,Policy policy,Handler main,Consumer<String> status){this.local=local;this.cloud=cloud;this.policy=policy;this.main=main;this.status=status;}
    boolean usingCloud(){return readyCloud;}
    private boolean active(long token){return !closed&&token==generation;}
    public void prepare(String from,String to,boolean wifi,Callback<Void> callback){prepare(from,to,wifi,m->{},callback);}
    public void prepare(String from,String to,boolean wifi,PreparationProgress progress,Callback<Void> callback){
        long token=++generation;readyCloud=policy.enabled()&&policy.online()&&!from.equals(to);
        if(readyCloud){progress.update("Groq internet desteği hazır");callback.success(null);}
        else local.prepare(from,to,wifi,progress,new Callback<Void>(){public void success(Void v){if(active(token))callback.success(v);}public void failure(Exception e){if(active(token))callback.failure(e);}});
    }
    public void translate(String text,String from,String to,Callback<String> callback){
        long token=generation;if(!active(token))return;
        if(from.equals(to)){callback.success(text);return;}
        if(!readyCloud||!policy.enabled()){local.translate(text,from,to,callback);return;}
        status.accept("Groq ile çevriliyor · İnternet desteği");
        worker.execute(()->{try{if(!active(token))return;String key=policy.key();if(key.isEmpty())throw new IllegalStateException("Groq anahtarı yok.");String value=cloud.translate(text,from,to,key);main.post(()->{if(active(token))callback.success(value);});}
            catch(Exception error){main.post(()->{if(!active(token))return;readyCloud=false;String reason=error.getMessage();status.accept((reason!=null&&reason.contains("limit")?"Groq limiti doldu":"Groq kullanılamadı")+" · Yerel çeviri deneniyor");
                local.prepare(from,to,false,new Callback<Void>(){public void success(Void v){if(active(token))local.translate(text,from,to,callback);}public void failure(Exception e){if(active(token))callback.failure(e);}});
            });}});
    }
    public void cancelPreparation(){generation++;readyCloud=false;local.cancelPreparation();cloud.cancel();}
    public void close(){closed=true;cancelPreparation();local.close();worker.shutdownNow();}
}
