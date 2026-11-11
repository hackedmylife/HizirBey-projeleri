package com.hizirbey.tercuman;

import org.junit.Test;
import static org.junit.Assert.*;

public class SessionGateTest {
    @Test public void aStoppedSessionRejectsAllLateCallbacks(){
        SessionGate gate=new SessionGate();long recording=gate.renew();
        assertTrue(gate.accepts(recording));gate.renew();
        assertFalse(gate.accepts(recording));assertTrue(gate.accepts(gate.current()));
    }
    @Test public void aNewSessionDoesNotReviveAnEarlierOne(){
        SessionGate gate=new SessionGate();long old=gate.renew();gate.renew();long current=gate.renew();
        assertFalse(gate.accepts(old));assertTrue(gate.accepts(current));
    }
}
