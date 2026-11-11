package com.hizirbey.tercuman;
import java.nio.*;import java.nio.file.*;import java.nio.charset.*;import java.util.*;
public class VadRegressionCheck {
 static void empty(long handle,float[] pcm,String name){NativeWhisper.reset(handle);String text=new String(NativeWhisper.transcribe(handle,pcm,"en",4),StandardCharsets.UTF_8).trim();if(!text.isEmpty())throw new AssertionError(name+": "+text);System.out.println("PASS no words: "+name);}
 public static void main(String[] args)throws Exception{
  long handle=NativeWhisper.create(args[0]);try{
   NativeWhisper.configureVad(handle,args[1]);
   empty(handle,new float[48000],"three seconds of silence");
   Random random=new Random(45);float[] noise=new float[64000];for(int i=0;i<noise.length;i++)noise[i]=(float)(random.nextGaussian()*0.015);for(int i=24000;i<24400;i++)noise[i]+=0.06f;empty(handle,noise,"room noise and short click");
   byte[] wav=Files.readAllBytes(Path.of(args[2]));ByteBuffer data=ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);float[] audio=null;
   for(int at=12;at+8<=wav.length;){int n=data.getInt(at+4);if(new String(wav,at,4,StandardCharsets.US_ASCII).equals("data")){audio=new float[n/2+32000];for(int i=0;i<n/2;i++)audio[i]=data.getShort(at+8+i*2)/32768f;break;}at+=8+n+n%2;}
   if(audio==null)throw new AssertionError("No PCM");NativeWhisper.reset(handle);String text=new String(NativeWhisper.transcribe(handle,audio,"en",4),StandardCharsets.UTF_8).trim();
   System.out.println("SPEECH="+text);String normalized=text.toLowerCase(Locale.ROOT).replaceAll("[.!?]$","");
   if(!normalized.contains("you")||!normalized.contains("fellow americans")||normalized.endsWith("you"))throw new AssertionError("Speech/tail regression: "+text);
   System.out.println("PASS real speech with legitimate you retained and silent tail rejected");
   empty(handle,noise,"noise after previous speech, cached context");System.out.println("VAD_NATIVE_REGRESSIONS_PASS");
  }finally{NativeWhisper.destroy(handle);}
 }
}
