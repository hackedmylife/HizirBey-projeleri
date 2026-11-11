package com.hizirbey.tercuman;
import android.speech.tts.*;
import java.util.*;

final class VoiceSelector {
    static boolean knownOfflineEngine(String name){return "com.reecedunn.espeak".equals(name);}
    static boolean sameLanguage(Locale a,Locale b){
        if(a.getLanguage().equals(b.getLanguage()))return true;
        try{return !a.getISO3Language().isEmpty()&&a.getISO3Language().equals(b.getISO3Language());}
        catch(MissingResourceException e){return false;}
    }
    static Voice choose(Set<Voice> voices,Locale requested,boolean offline){
        Voice best=null;int score=-1;
        if(voices==null)return null;
        for(Voice v:voices){
            if(!sameLanguage(v.getLocale(),requested)||(offline&&v.isNetworkConnectionRequired()))continue;
            if(offline&&v.getFeatures()!=null&&v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))continue;
            int rank=(v.isNetworkConnectionRequired()?0:4)+(v.getLocale().equals(requested)?2:0);
            if(rank>score){score=rank;best=v;}
        }
        return best;
    }
}
