package com.hizirbey.tercuman;

/** Reject late speech, OCR, download and TTS callbacks after cancel, tab/language change or background. */
public final class SessionGate {
    private long epoch;
    public long renew() { return ++epoch; }
    public long current() { return epoch; }
    public boolean accepts(long candidate) { return epoch == candidate; }
}
