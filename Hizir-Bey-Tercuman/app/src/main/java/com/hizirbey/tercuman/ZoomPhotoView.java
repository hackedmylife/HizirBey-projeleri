package com.hizirbey.tercuman;
import android.content.Context;
import android.graphics.*;
import android.view.*;
final class ZoomPhotoView extends View {
    private final Bitmap image;private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);private final ScaleGestureDetector pinch;
    private float zoom=1,panX,panY,lastX,lastY;
    ZoomPhotoView(Context c,Bitmap image){super(c);this.image=image;setContentDescription("İki parmakla yakınlaştırılabilen fotoğraf");
        pinch=new ScaleGestureDetector(c,new ScaleGestureDetector.SimpleOnScaleGestureListener(){@Override public boolean onScale(ScaleGestureDetector detector){zoom=Math.max(1,Math.min(8,zoom*detector.getScaleFactor()));invalidate();return true;}});}
    @Override protected void onDraw(Canvas c){c.drawColor(0xFF0D101B);if(image.isRecycled())return;float fit=Math.min(getWidth()/(float)image.getWidth(),getHeight()/(float)image.getHeight());
        c.save();c.translate(getWidth()/2f+panX,getHeight()/2f+panY);c.scale(fit*zoom,fit*zoom);c.drawBitmap(image,-image.getWidth()/2f,-image.getHeight()/2f,paint);c.restore();}
    @Override public boolean onTouchEvent(MotionEvent e){pinch.onTouchEvent(e);switch(e.getActionMasked()){
        case MotionEvent.ACTION_DOWN:lastX=e.getX();lastY=e.getY();return true;
        case MotionEvent.ACTION_POINTER_UP:lastX=e.getX(e.getActionIndex()==0?1:0);lastY=e.getY(e.getActionIndex()==0?1:0);return true;
        case MotionEvent.ACTION_MOVE:if(!pinch.isInProgress()&&e.getPointerCount()==1&&zoom>1){panX+=e.getX()-lastX;panY+=e.getY()-lastY;float boundX=getWidth()*(zoom-1)/2,boundY=getHeight()*(zoom-1)/2;panX=Math.max(-boundX,Math.min(boundX,panX));panY=Math.max(-boundY,Math.min(boundY,panY));invalidate();}lastX=e.getX();lastY=e.getY();return true;
        case MotionEvent.ACTION_UP:performClick();return true;default:return true;}}
    @Override public boolean performClick(){super.performClick();return true;}
}
