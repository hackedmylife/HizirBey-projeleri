package com.hizirbey.tercuman;
import java.nio.*;import java.nio.file.*;import java.nio.charset.*;
public class OfflineNativeCheck {
 public static void main(String[] args)throws Exception{
  byte[] wav=Files.readAllBytes(Path.of(args[1]));ByteBuffer data=ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);float[] samples=null;
  for(int at=12;at+8<=wav.length;){int size=data.getInt(at+4);if(new String(wav,at,4,StandardCharsets.US_ASCII).equals("data")){samples=new float[size/2];for(int i=0;i<samples.length;i++)samples[i]=data.getShort(at+8+i*2)/32768f;break;}at+=8+size+(size%2);}
  if(samples==null)throw new AssertionError("Missing PCM");
  long started=System.nanoTime();long handle=NativeWhisper.create(args[0]);
  try{String text=new String(NativeWhisper.transcribe(handle,samples,"en",4),StandardCharsets.UTF_8).trim();System.out.println("RESULT: "+text);if(!text.toLowerCase().contains("fellow americans"))throw new AssertionError(text);System.out.println("HOST_JNI_PASS seconds="+((System.nanoTime()-started)/1e9));}finally{NativeWhisper.destroy(handle);}
 }
}
