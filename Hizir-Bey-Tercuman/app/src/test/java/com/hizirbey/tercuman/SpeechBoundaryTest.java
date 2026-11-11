package com.hizirbey.tercuman;
import org.junit.Test;
import static org.junit.Assert.*;
public class SpeechBoundaryTest {
    @Test public void silenceDoesNotReachWhisper(){SpeechBoundary b=new SpeechBoundary();for(int i=0;i<400;i++)b.accept(new short[320],320);assertTrue(b.finished());assertFalse(b.hasSpeech());}
    @Test public void isolatedClickIsNotAcceptedAsSpeech(){SpeechBoundary b=new SpeechBoundary();short[] click=new short[320];java.util.Arrays.fill(click,(short)10000);b.accept(click,320);for(int i=0;i<999;i++)b.accept(new short[320],320);assertFalse(b.hasSpeech());}
    @Test public void voiceFinishesAfterPauseAndRetainsLeadingAudio(){SpeechBoundary b=new SpeechBoundary();short[] voice=new short[320];for(int i=0;i<320;i++)voice[i]=(short)(Math.sin(i*0.2)*8000);for(int i=0;i<20;i++)b.accept(new short[320],320);for(int i=0;i<50;i++)b.accept(voice,320);assertTrue(b.hasSpeech());assertFalse(b.finished());for(int i=0;i<60;i++)b.accept(new short[320],320);assertTrue(b.finished());assertTrue(b.startSample()<20*320);assertTrue(b.endSample(130*320)<=130*320);}
    @Test public void quietVoiceIsNotLearnedAsBackgroundNoise(){
        SpeechBoundary b=new SpeechBoundary();short[] voice=new short[320];for(int i=0;i<320;i++)voice[i]=(short)(Math.sin(i*0.2)*100);
        for(int i=0;i<30;i++)b.accept(new short[320],320);for(int i=0;i<50;i++)b.accept(voice,320);
        assertTrue(b.hasSpeech());
    }
    @Test public void microphoneRatesPreserveTwentyMillisecondWaveform(){
        for(int rate:new int[]{16000,44100,48000}){
            short[] input=new short[rate/50];for(int i=0;i<input.length;i++)input[i]=(short)(Math.sin(2*Math.PI*400*i/rate)*8000);
            short[] out=EmbeddedSpeech.resample(input,rate);assertEquals(320,out.length);
            for(int i=0;i<out.length;i++)assertEquals(Math.sin(2*Math.PI*400*i/16000)*8000,out[i],4.0);
        }
    }
    private short[] tone(int amplitude){short[] frame=new short[320];for(int i=0;i<320;i++)frame[i]=(short)(Math.sin(i*0.2)*amplitude);return frame;}
    @Test public void steadyRoomNoiseIsNotAnUtterance(){
        SpeechBoundary b=new SpeechBoundary();for(int i=0;i<SpeechBoundary.MAX_FRAMES;i++)b.accept(tone(400),320);
        assertTrue(b.finished());assertFalse(b.hasSpeech());
    }
    @Test public void roomNoiseAfterSpeechDoesNotKeepTheMicrophoneOpen(){
        SpeechBoundary b=new SpeechBoundary();for(int i=0;i<20;i++)b.accept(tone(400),320);
        for(int i=0;i<50;i++)b.accept(tone(6000),320);assertTrue(b.hasSpeech());
        for(int i=0;i<35;i++)b.accept(tone(400),320);assertTrue(b.finished());
    }
    @Test public void continuousSpeechIsBoundedToSixSeconds(){
        SpeechBoundary b=new SpeechBoundary();for(int i=0;i<15;i++)b.accept(new short[320],320);
        int frames=15;while(!b.finished()&&frames<1000){b.accept(tone(6000),320);frames++;}
        assertTrue(b.hasSpeech());assertEquals(300,frames);
    }
}
