package com.hizirbey.tercuman;
import android.media.AudioDeviceInfo;
import org.junit.*;
import static org.junit.Assert.*;
public class DialogueLatencyTest {
    @Test public void mediaChannelWinsEvenWhenCallChannelIsListedFirst(){assertEquals(2,RoutedAudio.selectIndex(new int[]{AudioDeviceInfo.TYPE_BLUETOOTH_SCO,AudioDeviceInfo.TYPE_BUILTIN_SPEAKER,AudioDeviceInfo.TYPE_BLUETOOTH_A2DP},true));}
    @Test public void callOnlyBluetoothDoesNotSilentlyUseSpeaker(){assertEquals(-1,RoutedAudio.selectIndex(new int[]{AudioDeviceInfo.TYPE_BLUETOOTH_SCO,AudioDeviceInfo.TYPE_BUILTIN_SPEAKER},true));}
    @Test public void replyToPeerStillSelectsBuiltInSpeaker(){assertEquals(1,RoutedAudio.selectIndex(new int[]{AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,AudioDeviceInfo.TYPE_BUILTIN_SPEAKER},false));}
    @Test public void routeValidationAcceptsPrivateMediaEndpointAliasesButRejectsSpeakerAndSco(){assertTrue(RoutedAudio.routeMatches(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,true));assertFalse(RoutedAudio.routeMatches(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,AudioDeviceInfo.TYPE_BUILTIN_SPEAKER,true));assertFalse(RoutedAudio.routeMatches(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,AudioDeviceInfo.TYPE_BLUETOOTH_SCO,true));}
    @Test public void firstSpeechChunkDoesNotWaitForWholeLongParagraph(){String text="Bu kısa cümleyi hemen söyle. "+"Sonraki uzun cümle devam ediyor. ".repeat(30);int end=SpeechChunks.end(text,4000,true);assertEquals("Bu kısa cümleyi hemen söyle.",text.substring(0,end));assertTrue(end<160);}
    @Test public void chunkingPreservesWordsAndUnicodeAcrossManyChunks(){String text="Merhaba dünya! "+"Uzun bir açıklama ve Türkçe karakterler: alışveriş, teşekkür, görüşürüz. ".repeat(20)+" Bitti.";String rest=text;StringBuilder joined=new StringBuilder();int turns=0;while(!rest.isEmpty()){int end=SpeechChunks.end(rest,4000,true);String chunk=rest.substring(0,end);assertFalse(Character.isHighSurrogate(chunk.charAt(chunk.length()-1)));if(joined.length()>0)joined.append(' ');joined.append(chunk.trim());rest=rest.substring(end).trim();assertTrue(++turns<100);}assertEquals(text.trim().replaceAll("\\s+"," "),joined.toString().replaceAll("\\s+"," "));}
    @Test public void accurateSpeechRetainsTheLongerExistingRequestLimit(){String text="abc ".repeat(200);assertEquals(text.length(),SpeechChunks.end(text,4000,false));}
}
