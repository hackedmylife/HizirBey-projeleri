package com.hizirbey.tercuman;
import java.nio.*;import java.nio.file.*;import java.nio.charset.*;import java.util.*;
public class BoundedRecognitionCheck {
 public static void main(String[] args)throws Exception{
  byte[] wav=Files.readAllBytes(Path.of(args[1]));ByteBuffer bytes=ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);short[] pcm=null;
  for(int at=12;at+8<=wav.length;){int size=bytes.getInt(at+4);if(new String(wav,at,4,StandardCharsets.US_ASCII).equals("data")){pcm=new short[size/2];for(int i=0;i<pcm.length;i++)pcm[i]=bytes.getShort(at+8+i*2);break;}at+=8+size+(size%2);}
  if(pcm==null)throw new AssertionError("Missing PCM");
  SpeechBoundary boundary=new SpeechBoundary();float[] captured=new float[SpeechBoundary.MAX_SAMPLES];int used=0;
  for(int at=0;at+320<=pcm.length&&used+320<=captured.length&&!boundary.finished();at+=320){
   short[] frame=new short[320];for(int i=0;i<320;i++){double noise=Math.sin((at+i)*0.2)*260;frame[i]=(short)Math.max(-32768,Math.min(32767,pcm[at+i]+noise));captured[used+i]=frame[i]/32768f;}
   boundary.accept(frame,320);used+=320;
  }
  if(!boundary.hasSpeech())throw new AssertionError("Voice not detected");
  float[] speech=Arrays.copyOfRange(captured,boundary.startSample(),boundary.endSample(used));long started=System.nanoTime();long handle=NativeWhisper.create(args[0]);
  try{String text=new String(NativeWhisper.transcribe(handle,speech,"en",4),StandardCharsets.UTF_8).trim();System.out.println("CAPTURE_SECONDS="+used/16000.0);System.out.println("RESULT="+text);if(!text.toLowerCase().contains("fellow americans"))throw new AssertionError(text);System.out.println("BOUNDED_HOST_JNI_PASS seconds="+(System.nanoTime()-started)/1e9);}
  finally{NativeWhisper.destroy(handle);}
 }
}
