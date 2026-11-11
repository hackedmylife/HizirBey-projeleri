package com.hizirbey.tercuman;
import org.junit.Test;
import static org.junit.Assert.*;
public class SpeechBoundaryTest {
    @Test public void silenceDoesNotReachWhisper(){SpeechBoundary b=new SpeechBoundary();for(int i=0;i<400;i++)b.accept(new short[320],320);assertTrue(b.finished());assertFalse(b.hasSpeech());}
    @Test public void isolatedClickIsNotAcceptedAsSpeech(){SpeechBoundary b=new SpeechBoundary();short[] click=new short[320];java.util.Arrays.fill(click,(short)10000);b.accept(click,320);for(int i=0;i<999;i++)b.accept(new short[320],320);assertFalse(b.hasSpeech());}
    @Test public void voiceFinishesAfterPauseAndRetainsLeadingAudio(){SpeechBoundary b=new SpeechBoundary();short[] voice=new short[320];for(int i=0;i<320;i++)voice[i]=(short)(Math.sin(i*0.2)*8000);for(int i=0;i<20;i++)b.accept(new short[320],320);for(int i=0;i<50;i++)b.accept(voice,320);assertTrue(b.hasSpeech());assertFalse(b.finished());for(int i=0;i<60;i++)b.accept(new short[320],320);assertTrue(b.finished());assertTrue(b.startSample()<20*320);assertTrue(b.endSample(130*320)<=130*320);}
}
