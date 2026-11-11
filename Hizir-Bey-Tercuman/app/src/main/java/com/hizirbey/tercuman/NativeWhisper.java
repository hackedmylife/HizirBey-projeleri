package com.hizirbey.tercuman;

final class NativeWhisper {
    static { System.loadLibrary("hizir_speech"); }
    static native long create(String modelPath);
    static native void reset(long context);
    static native void configureVad(long context,String modelPath);
    static native byte[] transcribe(long context,float[] samples,String language,int threads);
    static native void cancel(long context);
    static native void destroy(long context);
    private NativeWhisper(){}
}
