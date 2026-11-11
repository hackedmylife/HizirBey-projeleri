package com.hizirbey.tercuman;
import android.content.Context;
import android.media.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import org.robolectric.shadows.*;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk={28,33})
public class BluetoothRoutingTest {
    AudioManager manager;RoutedAudio audio;
    @Before public void setup(){manager=(AudioManager)RuntimeEnvironment.getApplication().getSystemService(Context.AUDIO_SERVICE);audio=new RoutedAudio(RuntimeEnvironment.getApplication());}
    @After public void close(){audio.close();}
    private AudioDeviceInfo device(int type){return AudioDeviceInfoBuilder.newBuilder().setType(type).build();}
    private void outputs(AudioDeviceInfo... devices){Shadows.shadowOf(manager).setOutputDevices(Arrays.asList(devices));}
    @Test public void realSelectionPathPrefersMediaOverFirstListedCallChannel(){AudioDeviceInfo sco=device(AudioDeviceInfo.TYPE_BLUETOOTH_SCO),a2dp=device(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP);outputs(sco,device(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER),a2dp);assertSame(a2dp,audio.output(true));}
    @Test public void peerReplyUsesPhoneEvenWithBluetoothConnected(){AudioDeviceInfo phone=device(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER);outputs(device(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP),phone);assertSame(phone,audio.output(false));}
    @Test public void callOnlyHeadsetRequiresMediaInsteadOfChoosingSpeaker(){outputs(device(AudioDeviceInfo.TYPE_BLUETOOTH_SCO),device(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER));assertNull(audio.output(true));}
    @Test public void endpointReplacementDoesNotCancelStillAvailableMediaHeadphones(){AudioDeviceInfo old=device(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP),replacement=device(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP);outputs(replacement);AtomicInteger errors=new AtomicInteger();ReflectionHelpers.setField(audio,"chosenId",old.getId());ReflectionHelpers.setField(audio,"privateRoute",true);ReflectionHelpers.setField(audio,"callback",new RoutedAudio.Callback(){public void done(){}public void error(String s){errors.incrementAndGet();}});AudioDeviceCallback listener=ReflectionHelpers.getField(audio,"devices");listener.onAudioDevicesRemoved(new AudioDeviceInfo[]{old});ShadowLooper.idleMainLooper(100,TimeUnit.MILLISECONDS);assertEquals(0,errors.get());}
    @Test public void fullDisconnectCancelsInsteadOfFallingBackToSpeaker(){AudioDeviceInfo old=device(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP);outputs(device(AudioDeviceInfo.TYPE_BUILTIN_SPEAKER));AtomicInteger errors=new AtomicInteger();ReflectionHelpers.setField(audio,"chosenId",old.getId());ReflectionHelpers.setField(audio,"privateRoute",true);ReflectionHelpers.setField(audio,"callback",new RoutedAudio.Callback(){public void done(){}public void error(String s){errors.incrementAndGet();}});AudioDeviceCallback listener=ReflectionHelpers.getField(audio,"devices");listener.onAudioDevicesRemoved(new AudioDeviceInfo[]{old});ShadowLooper.idleMainLooper(100,TimeUnit.MILLISECONDS);assertEquals(1,errors.get());assertEquals(-1,(int)ReflectionHelpers.getField(audio,"chosenId"));}
}
