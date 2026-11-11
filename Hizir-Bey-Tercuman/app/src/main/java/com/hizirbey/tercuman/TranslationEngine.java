package com.hizirbey.tercuman;

/** Engine boundary: future paid providers can be injected without changing the conversation UI. */
public interface TranslationEngine extends AutoCloseable {
    interface Callback<T> {
        void success(T value);
        void failure(Exception error);
    }
    void prepare(String from, String to, boolean wifiOnly, Callback<Void> callback);
    void translate(String text, String from, String to, Callback<String> callback);
    @Override void close();
}
