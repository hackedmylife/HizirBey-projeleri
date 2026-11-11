package com.hizirbey.tercuman;
import android.graphics.*;
import android.text.*;
final class PhotoRenderer {
    static Bitmap render(PhotoPage page){
        Bitmap out=page.image.copy(Bitmap.Config.ARGB_8888,true);Canvas canvas=new Canvas(out);
        for(PhotoPage.Region area:page.regions){if(area.translated.isEmpty())continue;
            RectF r=new RectF(area.bounds);r.inset(-3,-3);r.intersect(0,0,out.getWidth(),out.getHeight());
            int background=background(page.image,r);Paint fill=new Paint();fill.setColor(background);canvas.drawRect(r,fill);
            TextPaint paint=new TextPaint(Paint.ANTI_ALIAS_FLAG);paint.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));
            paint.setColor((Color.red(background)*299+Color.green(background)*587+Color.blue(background)*114)>145000?Color.BLACK:Color.WHITE);
            int width=Math.max(1,(int)r.width()-4);float low=2,high=Math.max(3,r.height());StaticLayout layout=null;
            for(int i=0;i<12;i++){float size=(low+high)/2;paint.setTextSize(size);StaticLayout attempt=layout(area.translated,paint,width);if(attempt.getHeight()<=Math.max(1,r.height()-2))low=size;else high=size;}
            paint.setTextSize(low);layout=layout(area.translated,paint,width);
            canvas.save();canvas.clipRect(r);canvas.translate(r.left+2,r.top+Math.max(0,(r.height()-layout.getHeight())/2));layout.draw(canvas);canvas.restore();
        }return out;
    }
    private static StaticLayout layout(String value,TextPaint paint,int width){return StaticLayout.Builder.obtain(value,0,value.length(),paint,width).setIncludePad(false).setAlignment(Layout.Alignment.ALIGN_NORMAL).build();}
    private static int background(Bitmap image,RectF r){
        int[] colors=new int[12];int n=0;
        for(int i=0;i<6;i++){int x=Math.max(0,Math.min(image.getWidth()-1,(int)(r.left+(r.width()-1)*i/5)));
            colors[n++]=image.getPixel(x,Math.max(0,Math.min(image.getHeight()-1,(int)r.top)));
            colors[n++]=image.getPixel(x,Math.max(0,Math.min(image.getHeight()-1,(int)r.bottom-1)));}
        int[] red=new int[n],green=new int[n],blue=new int[n];for(int i=0;i<n;i++){red[i]=Color.red(colors[i]);green[i]=Color.green(colors[i]);blue[i]=Color.blue(colors[i]);}
        java.util.Arrays.sort(red);java.util.Arrays.sort(green);java.util.Arrays.sort(blue);return Color.rgb(red[n/2],green[n/2],blue[n/2]);
    }
}
