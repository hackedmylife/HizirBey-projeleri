package com.hizirbey.tercuman;

import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;
import java.util.LinkedHashMap;
import java.util.Map;

public final class LocalTranslationEngine implements TranslationEngine {
    private final Map<String, Translator> clients = new LinkedHashMap<>(4,0.75f,true);
    private boolean closed;

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
        try {
            if (from.equals(to)) { callback.success(null); return; }
            DownloadConditions.Builder conditions = new DownloadConditions.Builder();
            if (wifiOnly) conditions.requireWifi();
            client(from, to).downloadModelIfNeeded(conditions.build())
                .addOnSuccessListener(v -> { if (!closed) callback.success(null); })
                .addOnFailureListener(e -> { if (!closed) callback.failure(e); });
        } catch (Exception e) { callback.failure(e); }
    }
    @Override public void translate(String text, String from, String to, Callback<String> callback) {
        try {
            if (from.equals(to)) { callback.success(text); return; }
            client(from, to).translate(text)
                .addOnSuccessListener(v -> { if (!closed) callback.success(v); })
                .addOnFailureListener(e -> { if (!closed) callback.failure(e); });
        } catch (Exception e) { callback.failure(e); }
    }
    @Override public void close() {
        closed = true;
        for (Translator client : clients.values()) client.close();
        clients.clear();
    }
}
