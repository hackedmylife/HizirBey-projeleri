package com.hizirbey.tercuman;
import java.util.*;
import java.util.function.*;
/** Publishes a complete result only; cancellation prevents subsequent requests. */
final class PhotoBatch {
    static void translate(TranslationEngine engine,List<PhotoPage.Region> regions,String from,String to,BooleanSupplier active,IntConsumer progress,TranslationEngine.Callback<List<String>> callback){
        next(engine,regions,from,to,active,progress,callback,new ArrayList<>(),new HashMap<>());
    }
    private static void next(TranslationEngine engine,List<PhotoPage.Region> regions,String from,String to,BooleanSupplier active,IntConsumer progress,TranslationEngine.Callback<List<String>> callback,List<String> results,Map<String,String> cache){
        if(!active.getAsBoolean())return;int i=results.size();
        if(i==regions.size()){callback.success(results);return;}
        String text=regions.get(i).original;progress.accept(i+1);
        TranslationEngine.Callback<String> step=new TranslationEngine.Callback<String>(){
            public void success(String value){if(!active.getAsBoolean())return;if(value==null||value.trim().isEmpty()){callback.failure(new IllegalStateException("Boş resim çevirisi"));return;}boolean cloud=engine instanceof HybridTranslationEngine&&((HybridTranslationEngine)engine).usingCloud();if(cache.containsKey(text)){for(int previous=0;previous<i;previous++)if(regions.get(previous).original.equals(text)){cloud=regions.get(previous).cloud;break;}}regions.get(i).cloud=cloud;cache.put(text,value);results.add(value);next(engine,regions,from,to,active,progress,callback,results,cache);}
            public void failure(Exception e){if(active.getAsBoolean())callback.failure(e);}
        };
        if(cache.containsKey(text))step.success(cache.get(text));else engine.translate(text,from,to,step);
    }
}
