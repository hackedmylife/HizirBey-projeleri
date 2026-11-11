package com.hizirbey.tercuman;
import android.content.Context;
import android.graphics.*;
import android.view.*;
final class PhotoCropView extends View {
    private final Bitmap image;private final RectF display=new RectF(),selection=new RectF();
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
    private float anchorX,anchorY;private boolean dragging;
    PhotoCropView(Context c,Bitmap image){super(c);this.image=image;resetSelection();setContentDescription("Yazının etrafına kutu çiz. Tümü fotoğrafın tamamını seçer.");}
    void resetSelection(){selection.set(0,0,image.getWidth(),image.getHeight());invalidate();}
    Rect selectedPixels(){return new Rect(Math.max(0,(int)Math.floor(selection.left)),Math.max(0,(int)Math.floor(selection.top)),Math.min(image.getWidth(),(int)Math.ceil(selection.right)),Math.min(image.getHeight(),(int)Math.ceil(selection.bottom)));}
    Bitmap croppedImage(){Rect r=selectedPixels();Bitmap area=Bitmap.createBitmap(image,r.left,r.top,r.width(),r.height());Bitmap copy=area.copy(Bitmap.Config.ARGB_8888,false);if(area!=image)area.recycle();return copy;}
    @Override protected void onSizeChanged(int w,int h,int ow,int oh){float s=Math.min(w/(float)image.getWidth(),h/(float)image.getHeight());float iw=image.getWidth()*s,ih=image.getHeight()*s;display.set((w-iw)/2,(h-ih)/2,(w+iw)/2,(h+ih)/2);}
    @Override protected void onDraw(Canvas c){c.drawColor(0xFF0D101B);paint.setStyle(Paint.Style.FILL);paint.setColor(Color.WHITE);c.drawBitmap(image,null,display,paint);if(display.isEmpty())return;
        float sx=display.width()/image.getWidth(),sy=display.height()/image.getHeight();RectF r=new RectF(display.left+selection.left*sx,display.top+selection.top*sy,display.left+selection.right*sx,display.top+selection.bottom*sy);
        paint.setColor(0x99000000);c.drawRect(display.left,display.top,display.right,r.top,paint);c.drawRect(display.left,r.bottom,display.right,display.bottom,paint);c.drawRect(display.left,r.top,r.left,r.bottom,paint);c.drawRect(r.right,r.top,display.right,r.bottom,paint);
        paint.setColor(0xFFB6AAFF);paint.setStrokeWidth(3*getResources().getDisplayMetrics().density);paint.setStyle(Paint.Style.STROKE);c.drawRect(r,paint);
    }
    @Override public boolean onTouchEvent(MotionEvent e){if(display.isEmpty())return false;float x=Math.max(0,Math.min(image.getWidth(),(e.getX()-display.left)*image.getWidth()/display.width())),y=Math.max(0,Math.min(image.getHeight(),(e.getY()-display.top)*image.getHeight()/display.height()));
        switch(e.getActionMasked()){
        case MotionEvent.ACTION_DOWN:if(!display.contains(e.getX(),e.getY()))return false;anchorX=x;anchorY=y;dragging=true;if(getParent()!=null)getParent().requestDisallowInterceptTouchEvent(true);return true;
        case MotionEvent.ACTION_MOVE:if(!dragging)return false;selection.set(Math.min(anchorX,x),Math.min(anchorY,y),Math.max(anchorX,x),Math.max(anchorY,y));invalidate();return true;
        case MotionEvent.ACTION_UP:if(!dragging)return false;dragging=false;selection.set(Math.min(anchorX,x),Math.min(anchorY,y),Math.max(anchorX,x),Math.max(anchorY,y));if(selection.width()<12||selection.height()<12)resetSelection();if(getParent()!=null)getParent().requestDisallowInterceptTouchEvent(false);invalidate();performClick();return true;
        case MotionEvent.ACTION_CANCEL:dragging=false;resetSelection();return true;default:return false;}}
    @Override public boolean performClick(){super.performClick();return true;}
}
