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
    static boolean usable(Voice voice,Locale requested,boolean offline){
        if(!sameLanguage(voice.getLocale(),requested)||(offline&&voice.isNetworkConnectionRequired()))return false;
        return !offline||voice.getFeatures()==null||!voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED);
    }
    /** Compare within a language: intelligibility/quality before setup latency. */
    static int compareVoices(Voice a,Voice b,Locale requested){
        int quality=Integer.compare(a.getQuality(),b.getQuality());if(quality!=0)return quality;
        int locale=Boolean.compare(a.getLocale().equals(requested),b.getLocale().equals(requested));if(locale!=0)return locale;
        return Integer.compare(b.getLatency(),a.getLatency());
    }
    static int compare(String engineA,Voice a,String engineB,Voice b,Locale requested){
        int engine=Boolean.compare(!knownOfflineEngine(engineA),!knownOfflineEngine(engineB));if(engine!=0)return engine;
        return compareVoices(a,b,requested);
    }
    static Voice choose(Set<Voice> voices,Locale requested,boolean offline){
        Voice best=null;if(voices==null)return null;
        for(Voice voice:voices)if(usable(voice,requested,offline)&&(best==null||compareVoices(voice,best,requested)>0))best=voice;
        return best;
    }
}
