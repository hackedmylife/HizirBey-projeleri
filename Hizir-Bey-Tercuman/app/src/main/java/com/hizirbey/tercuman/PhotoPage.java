package com.hizirbey.tercuman;
import android.graphics.*;
import java.util.*;
final class PhotoPage {
    static final class Region {
        final RectF bounds;String original;String translated="";boolean cloud;
        Region(RectF bounds,String text){this.bounds=new RectF(bounds);this.original=text.trim();}
    }
    final Bitmap image;final List<Region> regions;final String language;
    String target="";boolean translated;
    PhotoPage(Bitmap bitmap,List<Region> areas,String language){
        float scale=Math.min(1f,2000f/Math.max(bitmap.getWidth(),bitmap.getHeight()));
        Bitmap resized=Bitmap.createScaledBitmap(bitmap,Math.max(1,Math.round(bitmap.getWidth()*scale)),Math.max(1,Math.round(bitmap.getHeight()*scale)),true);
        image=resized==bitmap?bitmap.copy(Bitmap.Config.ARGB_8888,false):resized;
        regions=new ArrayList<>();this.language=language;
        for(Region area:areas){RectF r=new RectF(area.bounds.left*scale,area.bounds.top*scale,area.bounds.right*scale,area.bounds.bottom*scale);
            if(r.intersect(0,0,image.getWidth(),image.getHeight())&&!area.original.isEmpty())regions.add(new Region(r,area.original));}
    }
    void recycle(){if(!image.isRecycled())image.recycle();}
}
