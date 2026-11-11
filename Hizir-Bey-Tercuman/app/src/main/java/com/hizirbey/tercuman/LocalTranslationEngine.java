package com.hizirbey.tercuman;

import com.google.mlkit.common.model.*;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;
import com.google.mlkit.nl.translate.TranslateRemoteModel;
import java.util.*;
import java.util.LinkedHashMap;
import java.util.Map;

public final class LocalTranslationEngine implements TranslationEngine {
    private final Map<String, Translator> clients = new LinkedHashMap<>(4,0.75f,true);
    private boolean closed;
    private long preparation;
    interface Models {
        void downloaded(Callback<Set<String>> callback);
        void download(String code,boolean wifiOnly,Callback<Void> callback);
    }
    private final Models models;
    public LocalTranslationEngine(){this(new SdkModels());}
    LocalTranslationEngine(Models models){this.models=models;}
    private static class SdkModels implements Models {
        public void downloaded(Callback<Set<String>> cb){
            RemoteModelManager.getInstance().getDownloadedModels(TranslateRemoteModel.class)
                .addOnSuccessListener(items->{Set<String> loaded=new HashSet<>();for(TranslateRemoteModel m:items)loaded.add(m.getLanguage());cb.success(loaded);})
                .addOnFailureListener(cb::failure);
        }
        public void download(String code,boolean wifiOnly,Callback<Void> cb){
            DownloadConditions.Builder options=new DownloadConditions.Builder();if(wifiOnly)options.requireWifi();
            RemoteModelManager.getInstance().download(new TranslateRemoteModel.Builder(code).build(),options.build())
                .addOnSuccessListener(cb::success).addOnFailureListener(cb::failure);
        }
    }

    private Translator client(String from, String to) {
        if (closed) throw new IllegalStateException("Çeviri motoru kapalı.");
        String key = from + ":" + to;
        Translator existing = clients.get(key);
        if (existing != null) return existing;
        if(clients.size()>=4){
            String oldest=clients.keySet().iterator().next();Translator removed=clients.remove(oldest);
            if(removed!=null)removed.close();
        }
        Translator created = Translation.getClient(new TranslatorOptions.Builder()
            .setSourceLanguage(from).setTargetLanguage(to).build());
        clients.put(key, created);
        return created;
    }
    @Override public void prepare(String from, String to, boolean wifiOnly, Callback<Void> callback) {
        prepare(from,to,wifiOnly,message->{},callback);
    }
    @Override public void prepare(String from,String to,boolean wifiOnly,PreparationProgress progress,Callback<Void> callback){
        final long request=++preparation;
        try {
            if (from.equals(to)) { callback.success(null); return; }
            progress.update("Seçili çeviri paketleri kontrol ediliyor");
            models.downloaded(new Callback<Set<String>>(){
                public void success(Set<String> loaded){
                    if(closed||request!=preparation)return;
                    ArrayList<String> missing=new ArrayList<>();
                    for(String code:Arrays.asList(from,to))if(!code.equals("en")&&!loaded.contains(code)&&!missing.contains(code))missing.add(code);
                    downloadNext(missing,0,wifiOnly,request,progress,callback);
                }
                public void failure(Exception error){if(!closed&&request==preparation)callback.failure(error);}
            });
        } catch (Exception e) { callback.failure(e); }
    }
    private void downloadNext(List<String> missing,int index,boolean wifiOnly,long request,PreparationProgress progress,Callback<Void> callback){
        if(closed||request!=preparation)return;
        if(index>=missing.size()){callback.success(null);return;}
        String code=missing.get(index);
        progress.update(LanguageCatalog.name(code)+" çeviri paketi · İndirme isteği gönderildi"+(wifiOnly?" (Wi-Fi)":""));
        try{models.download(code,wifiOnly,new Callback<Void>(){
            public void success(Void value){downloadNext(missing,index+1,wifiOnly,request,progress,callback);}
            public void failure(Exception error){if(!closed&&request==preparation)callback.failure(error);}
        });}catch(Exception error){callback.failure(error);}
    }
    @Override public void cancelPreparation(){preparation++;}
    @Override public void translate(String text, String from, String to, Callback<String> callback) {
        try {
            if (from.equals(to)) { callback.success(text); return; }
            client(from, to).translate(text)
                .addOnSuccessListener(v -> { if (!closed) callback.success(v); })
                .addOnFailureListener(e -> { if (!closed) callback.failure(e); });
        } catch (Exception e) { callback.failure(e); }
    }
    @Override public void close() {
        closed = true;cancelPreparation();
        for (Translator client : clients.values()) client.close();
        clients.clear();
    }
}
