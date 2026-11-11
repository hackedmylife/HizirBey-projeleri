package com.hizirbey.tercuman;

/** Engine boundary: future paid providers can be injected without changing the conversation UI. */
public interface TranslationEngine extends AutoCloseable {
    interface Callback<T> {
        void success(T value);
        void failure(Exception error);
    }
    void prepare(String from, String to, boolean wifiOnly, Callback<Void> callback);
    interface PreparationProgress { void update(String message); }
    default void prepare(String from,String to,boolean wifiOnly,PreparationProgress progress,Callback<Void> callback){prepare(from,to,wifiOnly,callback);}
    default void cancelPreparation(){}
    void translate(String text, String from, String to, Callback<String> callback);
    @Override void close();
}
