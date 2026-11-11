package com.hizirbey.tercuman;
import java.nio.*;import java.nio.file.*;import java.nio.charset.*;import java.util.*;
public class LatencyCheck {
 static float[] wav(String path)throws Exception{byte[] bytes=Files.readAllBytes(Path.of(path));ByteBuffer b=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);for(int at=12;at+8<bytes.length;){int n=b.getInt(at+4);if(new String(bytes,at,4,StandardCharsets.US_ASCII).equals("data")){float[] pcm=new float[n/2];for(int i=0;i<pcm.length;i++)pcm[i]=b.getShort(at+8+2*i)/32768f;return pcm;}at+=8+n+n%2;}throw new Exception("No PCM");}
 static void run(String name,String model,String vad,float[] audio)throws Exception{long start=System.nanoTime();long handle=NativeWhisper.create(model);try{
  NativeWhisper.configureVad(handle,vad);NativeWhisper.reset(handle);if(!NativeWhisper.hasSpeech(handle,audio))throw new AssertionError("Real speech gate rejected");if(NativeWhisper.hasSpeech(handle,new float[48000]))throw new AssertionError("Silence gate failed");System.out.println("INIT "+name+" ms="+(System.nanoTime()-start)/1000000);
  for(boolean fast:new boolean[]{false,true}){NativeWhisper.reset(handle);NativeWhisper.configureFast(handle,fast);long at=System.nanoTime();String text=new String(NativeWhisper.transcribe(handle,audio,"en",4),StandardCharsets.UTF_8).trim();long elapsed=(System.nanoTime()-at)/1000000;
   System.out.println("RESULT "+name+" fast="+fast+" ms="+elapsed+" text="+text);String lower=text.toLowerCase(Locale.ROOT);if(!lower.contains("fellow")||!lower.contains("country"))throw new AssertionError(text);
  }
  NativeWhisper.reset(handle);NativeWhisper.configureFast(handle,true);if(NativeWhisper.transcribe(handle,new float[48000],"en",4).length>0)throw new AssertionError("Silence hallucination");
 }finally{NativeWhisper.destroy(handle);}}
 public static void main(String[] args)throws Exception{float[] audio=wav(args[3]);run("base",args[0],args[2],audio);System.out.println("NATIVE_LATENCY_REGRESSION_PASS");}
}
