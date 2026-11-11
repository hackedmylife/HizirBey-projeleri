package com.hizirbey.tercuman;

import android.Manifest;
import android.os.Looper;
import android.content.Context;
import java.util.concurrent.atomic.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=33)
public class CaptureCompletionTest {
    @Before public void permission(){Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.RECORD_AUDIO);}
    static class Probe implements EmbeddedSpeech.Listener {
        volatile String text,error,partial;volatile boolean recording;
        public void state(String value){}public void result(String value){text=value;}public void error(String value){error=value;}
        public void recording(boolean value){recording=value;}public void partial(String value){partial=value;}
    }
    static class Pcm implements EmbeddedSpeech.Capture {
        final AtomicInteger frames=new AtomicInteger();volatile boolean closed;
        public int sampleRate(){return 16000;}
        public int read(short[] out,int offset,int count){
            int frame=frames.incrementAndGet();for(int i=0;i<count;i++)out[offset+i]=frame<20?0:(short)(Math.sin(i*0.2)*6000);
            try{Thread.sleep(2);}catch(InterruptedException e){Thread.currentThread().interrupt();}return count;
        }
        public void close(){closed=true;}
    }
    private void until(java.util.function.BooleanSupplier predicate)throws Exception{
        long deadline=System.nanoTime()+4_000_000_000L;
        while(!predicate.getAsBoolean()&&System.nanoTime()<deadline){Shadows.shadowOf(Looper.getMainLooper()).idle();Thread.sleep(5);}
        Shadows.shadowOf(Looper.getMainLooper()).idle();assertTrue("Capture worker did not complete",predicate.getAsBoolean());
    }
    @Test public void finishFlushesAudioThroughDecoderWithoutCancellingTheResult()throws Exception{
        Pcm pcm=new Pcm();Probe listener=new Probe();AtomicInteger samples=new AtomicInteger();
        EmbeddedSpeech speech=new EmbeddedSpeech(RuntimeEnvironment.getApplication(),()->pcm,(audio,language)->{samples.set(audio.length);return "Hello";});
        try{speech.listen("en",listener);until(()->pcm.frames.get()>=40);speech.finishCapture();until(()->listener.text!=null||listener.error!=null);
            assertNull(listener.error);assertEquals("Hello",listener.text);assertTrue(samples.get()>8*320);assertTrue(samples.get()<SpeechBoundary.MAX_SAMPLES);assertTrue(pcm.closed);assertFalse(listener.recording);
        }finally{speech.close();}
    }
    @Test public void cancelStillDiscardsTheCaptureAndNeverCallsDecoder()throws Exception{
        Pcm pcm=new Pcm();Probe listener=new Probe();AtomicInteger decoded=new AtomicInteger();
        EmbeddedSpeech speech=new EmbeddedSpeech(RuntimeEnvironment.getApplication(),()->pcm,(audio,language)->{decoded.incrementAndGet();return "SHOULD NOT APPEAR";});
        try{speech.listen("en",listener);until(()->pcm.frames.get()>=40);speech.cancel();until(()->pcm.closed);
            assertNull(listener.text);assertEquals(0,decoded.get());
        }finally{speech.close();}
    }
    @Test public void multipleInternalChunksDoNotStopListeningOrFinalizeBeforeTheButton()throws Exception{
        Pcm pcm=new Pcm();Probe listener=new Probe();AtomicInteger decoded=new AtomicInteger();
        EmbeddedSpeech speech=new EmbeddedSpeech(RuntimeEnvironment.getApplication(),()->pcm,(audio,language)->{decoded.incrementAndGet();assertTrue(audio.length<=SpeechBoundary.MAX_SAMPLES);return "Partial words";});
        try{speech.listen("en",listener);until(()->pcm.frames.get()>=650&&decoded.get()>=2);assertFalse(pcm.closed);assertTrue(listener.recording);assertNull(listener.text);assertNotNull(listener.partial);
            speech.finishCapture();until(()->listener.text!=null||listener.error!=null);assertNull(listener.error);assertTrue(listener.text.contains("Partial words"));assertTrue(pcm.closed);assertFalse(listener.recording);
        }finally{speech.close();}
    }
    @Test public void silenceNeverClosesTheMicrophoneUntilFinish()throws Exception{
        Pcm pcm=new Pcm(){@Override public int read(short[] out,int offset,int count){int n=super.read(out,offset,count);java.util.Arrays.fill(out,offset,offset+n,(short)0);return n;}};
        Probe listener=new Probe();AtomicInteger decoded=new AtomicInteger();EmbeddedSpeech speech=new EmbeddedSpeech(RuntimeEnvironment.getApplication(),()->pcm,(audio,language)->{decoded.incrementAndGet();return "unexpected";});
        try{speech.listen("mk",listener);until(()->pcm.frames.get()>=650);assertFalse(pcm.closed);assertNull(listener.text);assertNull(listener.error);assertTrue(listener.recording);
            speech.finishCapture();until(()->listener.error!=null);assertEquals(0,decoded.get());assertTrue(pcm.closed);
        }finally{speech.close();}
    }
    @Test public void decoderFailureDoesNotCloseRecordingBeforeTheUserFinishes()throws Exception{
        Pcm pcm=new Pcm();Probe listener=new Probe();AtomicInteger decoded=new AtomicInteger();
        EmbeddedSpeech speech=new EmbeddedSpeech(RuntimeEnvironment.getApplication(),()->pcm,(audio,language)->{decoded.incrementAndGet();throw new IllegalStateException("Decoder unavailable");});
        try{speech.listen("en",listener);until(()->pcm.frames.get()>=650);assertEquals(1,decoded.get());assertTrue(listener.recording);assertFalse(pcm.closed);assertNull(listener.error);
            speech.finishCapture();until(()->listener.error!=null);assertEquals("Decoder unavailable",listener.error);assertTrue(pcm.closed);
        }finally{speech.close();}
    }
}
