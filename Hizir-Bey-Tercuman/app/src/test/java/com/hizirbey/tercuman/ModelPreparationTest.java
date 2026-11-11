package com.hizirbey.tercuman;
import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class ModelPreparationTest {
    static class Models implements LocalTranslationEngine.Models {
        Set<String> loaded=new HashSet<>();List<String> downloads=new ArrayList<>();boolean wifi;
        TranslationEngine.Callback<Void> pending;
        public void downloaded(TranslationEngine.Callback<Set<String>> cb){cb.success(loaded);}
        public void download(String code,boolean wifi,TranslationEngine.Callback<Void> cb){downloads.add(code);this.wifi=wifi;pending=cb;}
    }
    static class Result implements TranslationEngine.Callback<Void>{boolean ready;Exception error;public void success(Void value){ready=true;}public void failure(Exception e){error=e;}}
    @Test public void cachedPairIsReadyWithoutRequestingAnyDownload(){Models m=new Models();m.loaded.add("tr");Result r=new Result();new LocalTranslationEngine(m).prepare("en","tr",true,r);assertTrue(r.ready);assertTrue(m.downloads.isEmpty());}
    @Test public void onlyMissingModelIsRequestedAndEnglishNeverIs(){Models m=new Models();m.loaded.add("tr");Result r=new Result();new LocalTranslationEngine(m).prepare("tr","mk",false,r);assertEquals(Collections.singletonList("mk"),m.downloads);assertFalse(m.wifi);assertFalse(r.ready);m.pending.success(null);assertTrue(r.ready);}
    @Test public void cancellationStopsTheRemainingQueueAndLateSuccess(){Models m=new Models();Result r=new Result();LocalTranslationEngine engine=new LocalTranslationEngine(m);engine.prepare("tr","mk",true,r);assertEquals(Collections.singletonList("tr"),m.downloads);engine.cancelPreparation();m.pending.success(null);assertEquals(1,m.downloads.size());assertFalse(r.ready);}
    @Test public void sameLanguageNeedsNoModel(){Models m=new Models();Result r=new Result();new LocalTranslationEngine(m).prepare("mk","mk",true,r);assertTrue(r.ready);assertTrue(m.downloads.isEmpty());}
}
