package com.hizirbey.tercuman;
import android.speech.tts.*;import java.util.*;
import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.*;import org.robolectric.annotation.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk={28,33})
public class VoiceQualityTest {
    private final Locale tr=Locale.forLanguageTag("tr-TR");
    private Voice voice(String name,int quality,int latency,boolean network){return new Voice(name,tr,quality,latency,network,Collections.emptySet());}
    @Test public void installedDeviceVoiceBeatsBasicEngineEvenWhenBasicClaimsHighQuality(){Voice device=voice("tr-local",Voice.QUALITY_NORMAL,Voice.LATENCY_NORMAL,false),basic=voice("tr-basic",Voice.QUALITY_VERY_HIGH,Voice.LATENCY_VERY_LOW,false);assertTrue(VoiceSelector.compare("com.google.android.tts",device,"com.reecedunn.espeak",basic,tr)>0);}
    @Test public void qualityBeatsLatencyWithinInstalledOfflineVoices(){Voice clear=voice("clear",Voice.QUALITY_HIGH,Voice.LATENCY_HIGH,false),quick=voice("quick",Voice.QUALITY_LOW,Voice.LATENCY_VERY_LOW,false);assertSame(clear,VoiceSelector.choose(new LinkedHashSet<>(Arrays.asList(quick,clear)),tr,true));}
    @Test public void higherQualityCloudVoiceIsNeverChosenForOfflinePlayback(){Voice cloud=voice("cloud",Voice.QUALITY_VERY_HIGH,Voice.LATENCY_VERY_LOW,true),local=voice("local",Voice.QUALITY_NORMAL,Voice.LATENCY_NORMAL,false);assertSame(local,VoiceSelector.choose(new LinkedHashSet<>(Arrays.asList(cloud,local)),tr,true));}
    @Test public void voicePackMarkedNotInstalledIsNotSelected(){Voice missing=new Voice("missing",tr,Voice.QUALITY_VERY_HIGH,Voice.LATENCY_NORMAL,false,Collections.singleton(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED));assertNull(VoiceSelector.choose(Collections.singleton(missing),tr,true));}
    @Test public void basicEngineStillAvailableIfItIsTheOnlyOfflineOption(){Voice basic=voice("basic",Voice.QUALITY_LOW,Voice.LATENCY_VERY_LOW,false);assertSame(basic,VoiceSelector.choose(Collections.singleton(basic),tr,true));}
}
