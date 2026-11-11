package com.hizirbey.tercuman;

import android.content.SharedPreferences;
import org.json.*;
import java.util.*;

public final class HistoryStore {
    public static final class Entry {
        public String id, original, translated, from, to;
        public long time;
        public boolean favorite,cloud;
        Entry(String id, String original, String translated, String from, String to, long time, boolean favorite) {
            this.id=id; this.original=original; this.translated=translated;
            this.from=from; this.to=to; this.time=time; this.favorite=favorite;
        }
    }
    private final SharedPreferences prefs;
    private final List<Entry> entries = new ArrayList<>();
    public HistoryStore(SharedPreferences prefs) {
        this.prefs=prefs;
        try {
            JSONArray array=new JSONArray(prefs.getString("history", "[]"));
            for(int i=0;i<array.length();i++) {
                JSONObject o=array.getJSONObject(i);
                entries.add(new Entry(o.getString("id"), o.getString("original"), o.getString("translated"),
                    o.getString("from"), o.getString("to"), o.getLong("time"), o.optBoolean("favorite")));
                entries.get(entries.size()-1).cloud=o.optBoolean("cloud",false);
            }
        } catch(JSONException ignored) { entries.clear(); }
    }
    public Entry add(String original,String translated,String from,String to) {return add(original,translated,from,to,false);}
    public Entry add(String original,String translated,String from,String to,boolean cloud) {
        Entry e=new Entry(UUID.randomUUID().toString(),original,translated,from,to,System.currentTimeMillis(),false);
        e.cloud=cloud;entries.add(0,e);
        while(entries.size()>200) {
            int remove=-1;
            for(int i=entries.size()-1;i>=0;i--) if(!entries.get(i).favorite){remove=i;break;}
            if(remove<0) remove=entries.size()-1;
            entries.remove(remove);
        }
        save(); return e;
    }
    public List<Entry> all(boolean onlyFavorites) {
        List<Entry> out=new ArrayList<>();
        for(Entry e:entries) if(!onlyFavorites || e.favorite) out.add(e);
        return out;
    }
    public void toggle(Entry e) { e.favorite=!e.favorite; save(); }
    public void clear() { entries.clear(); save(); }
    private void save() {
        JSONArray array=new JSONArray();
        for(Entry e:entries) {
            try {
                JSONObject o=new JSONObject();
                o.put("id",e.id);o.put("original",e.original);o.put("translated",e.translated);
                o.put("cloud",e.cloud);o.put("from",e.from);o.put("to",e.to);o.put("time",e.time);o.put("favorite",e.favorite);
                array.put(o);
            } catch(JSONException ignored) { /* All values are valid primitives. */ }
        }
        prefs.edit().putString("history",array.toString()).apply();
    }
}
