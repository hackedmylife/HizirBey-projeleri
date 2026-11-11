package com.hizirbey.tercuman;
import org.junit.*;import static org.junit.Assert.*;
import java.io.*;import java.nio.*;import java.nio.charset.StandardCharsets;
public class GroqAudioFormatTest {
    @Test(expected=java.util.concurrent.CancellationException.class) public void cancelledTurnNeverOpensAudioUpload()throws Exception{new GroqTranscriber().transcribe(new float[]{0},"tr","not-a-real-key",true,()->false);}
    @Test public void audioUploadUses16kMonoWaveAndClampsSamples()throws Exception{
        byte[] data=GroqTranscriber.wave(new float[]{-2,0,2});assertEquals(50,data.length);ByteBuffer b=ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);assertEquals(16000,b.getInt(24));assertEquals(1,b.getShort(22));assertEquals(16,b.getShort(34));assertEquals(-32767,b.getShort(44));assertEquals(0,b.getShort(46));assertEquals(32767,b.getShort(48));
        File file=File.createTempFile("groq-audio-",".wav");try{try(FileOutputStream out=new FileOutputStream(file)){out.write(data);}try(RoutedAudio.Wave parsed=new RoutedAudio.Wave(file)){assertEquals(6,parsed.length);assertEquals(16000,parsed.rate);}}finally{file.delete();}
    }
    @Test public void multipartContainsForcedSourceLanguageAndTranscriptionModel()throws Exception{byte[] bytes=GroqTranscriber.body("test-boundary",new float[]{0,0},"mk",true);String body=new String(bytes,StandardCharsets.ISO_8859_1);assertTrue(body.contains("whisper-large-v3-turbo"));assertTrue(body.contains("name=\"language\"\r\n\r\nmk\r\n"));assertTrue(body.contains("Content-Type: audio/wav\r\n\r\nRIFF"));assertTrue(body.endsWith("\r\n--test-boundary--\r\n"));assertFalse(body.contains("Bearer"));}
    @Test public void qualityModeUsesLargerSpeechModelWithoutChangingTextTranslationApi()throws Exception{String body=new String(GroqTranscriber.body("b",new float[]{0},"tr",false),StandardCharsets.ISO_8859_1);assertTrue(body.contains("whisper-large-v3\r\n"));assertFalse(body.contains("whisper-large-v3-turbo"));}
}
