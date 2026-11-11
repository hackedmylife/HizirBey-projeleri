package com.hizirbey.tercuman;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Opt-in audio upload; all calls are serialized by the recognizer's decoding worker. */
final class GroqTranscriber {
    private volatile HttpsURLConnection active;
    private volatile long retryAt;
    static byte[] wave(float[] pcm){
        ByteBuffer b=ByteBuffer.allocate(44+pcm.length*2).order(ByteOrder.LITTLE_ENDIAN);
        b.put(new byte[]{'R','I','F','F'}).putInt(36+pcm.length*2).put(new byte[]{'W','A','V','E','f','m','t',' '}).putInt(16).putShort((short)1).putShort((short)1).putInt(16000).putInt(32000).putShort((short)2).putShort((short)16).put(new byte[]{'d','a','t','a'}).putInt(pcm.length*2);
        for(float sample:pcm)b.putShort((short)Math.round(Math.max(-1,Math.min(1,sample))*32767));return b.array();
    }
    String transcribe(float[] pcm,String language,String key,boolean fast,java.util.function.BooleanSupplier allowed)throws Exception{
        if(!allowed.getAsBoolean())throw new java.util.concurrent.CancellationException();
        if(android.os.SystemClock.elapsedRealtime()<retryAt)throw new IOException("Groq ses beklemede; yerel model kullanılacak.");
        String boundary="hizir-"+java.util.UUID.randomUUID();
        HttpsURLConnection connection=(HttpsURLConnection)new URL("https://api.groq.com/openai/v1/audio/transcriptions").openConnection();active=connection;
        try{
            if(!allowed.getAsBoolean())throw new java.util.concurrent.CancellationException();
            connection.setConnectTimeout(4000);connection.setReadTimeout(fast?7000:12000);connection.setRequestMethod("POST");connection.setDoOutput(true);
            connection.setRequestProperty("Authorization","Bearer "+key);connection.setRequestProperty("Content-Type","multipart/form-data; boundary="+boundary);
            byte[] body=body(boundary,pcm,language,fast);connection.setFixedLengthStreamingMode(body.length);
            if(!allowed.getAsBoolean())throw new java.util.concurrent.CancellationException();
            try(OutputStream out=connection.getOutputStream()){if(!allowed.getAsBoolean())throw new java.util.concurrent.CancellationException();out.write(body);}
            int code=connection.getResponseCode();if(code!=200)throw new IOException(code==429?"Groq ses kotası doldu.":"Groq ses isteği tamamlanamadı ("+code+").");
            try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>1000000)throw new IOException("Ses yanıtı çok büyük.");out.write(buffer,0,n);}
                return new JSONObject(new String(out.toByteArray(),StandardCharsets.UTF_8)).getString("text").trim();
            }
        }catch(java.util.concurrent.CancellationException cancelled){throw cancelled;}catch(Exception error){if(!allowed.getAsBoolean())throw new java.util.concurrent.CancellationException();retryAt=android.os.SystemClock.elapsedRealtime()+30000;throw error;}finally{connection.disconnect();if(active==connection)active=null;}
    }
    static byte[] body(String boundary,float[] pcm,String language,boolean fast)throws IOException{
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        field(out,boundary,"model",fast?"whisper-large-v3-turbo":"whisper-large-v3");field(out,boundary,"language",language);field(out,boundary,"response_format","json");field(out,boundary,"temperature","0");
        out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"speech.wav\"\r\nContent-Type: audio/wav\r\n\r\n").getBytes(StandardCharsets.UTF_8));out.write(wave(pcm));out.write(("\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8));return out.toByteArray();
    }
    private static void field(OutputStream out,String boundary,String name,String value)throws IOException{out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\""+name+"\"\r\n\r\n"+value+"\r\n").getBytes(StandardCharsets.UTF_8));}
    void cancel(){HttpsURLConnection c=active;if(c!=null)c.disconnect();}
}
