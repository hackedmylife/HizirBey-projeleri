package com.hizirbey.tercuman;
import android.graphics.*;
import android.view.*;
import java.util.*;
import java.util.concurrent.atomic.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk={28,33})
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class PhotoFlowTest {
    @Test public void cropUsesImageCoordinatesAndHandlesReverseDrag(){
        Bitmap image=Bitmap.createBitmap(1000,500,Bitmap.Config.ARGB_8888);PhotoCropView view=new PhotoCropView(RuntimeEnvironment.getApplication(),image);view.layout(0,0,400,400);
        touch(view,MotionEvent.ACTION_DOWN,300,260);touch(view,MotionEvent.ACTION_MOVE,100,140);touch(view,MotionEvent.ACTION_UP,100,140);
        assertEquals(new Rect(250,100,750,400),view.selectedPixels());Bitmap crop=view.croppedImage();assertEquals(500,crop.getWidth());assertEquals(300,crop.getHeight());assertFalse(image.isRecycled());crop.recycle();view.resetSelection();assertEquals(new Rect(0,0,1000,500),view.selectedPixels());image.recycle();
    }
    @Test public void outsideLetterboxDoesNotStartSelection(){Bitmap image=Bitmap.createBitmap(1000,500,Bitmap.Config.ARGB_8888);PhotoCropView view=new PhotoCropView(RuntimeEnvironment.getApplication(),image);view.layout(0,0,400,400);assertFalse(view.onTouchEvent(MotionEvent.obtain(0,0,MotionEvent.ACTION_DOWN,200,30,0)));assertEquals(new Rect(0,0,1000,500),view.selectedPixels());image.recycle();}
    @Test public void rendererPreservesOutsideAndReplacesTextInItsOwnRegion(){
        Bitmap image=Bitmap.createBitmap(600,300,Bitmap.Config.ARGB_8888);image.eraseColor(Color.WHITE);Canvas c=new Canvas(image);Paint p=new Paint();p.setColor(Color.RED);c.drawRect(200,100,400,160,p);
        PhotoPage page=new PhotoPage(image,Arrays.asList(new PhotoPage.Region(new RectF(190,90,410,170),"кошничка за пазарење")),"mk");page.regions.get(0).translated="Alışveriş sepeti";Bitmap result=PhotoRenderer.render(page);
        assertEquals(image.getPixel(10,10),result.getPixel(10,10));int remainingRed=0;for(int y=100;y<160;y++)for(int x=200;x<400;x++)if(result.getPixel(x,y)==Color.RED)remainingRed++;assertEquals("Original red text block was not covered",0,remainingRed);int ink=0;for(int y=90;y<170;y++)for(int x=190;x<410;x++)if(Color.red(result.getPixel(x,y))<100)ink++;assertTrue("Translated glyphs absent",ink>50);assertEquals(Color.RED,image.getPixel(205,105));result.recycle();page.recycle();image.recycle();
    }
    @Test public void batchCachesDuplicatesAndPublishesCompleteResult(){Fake engine=new Fake();List<PhotoPage.Region> regions=regions("one","two","one");AtomicReference<List<String>> result=new AtomicReference<>();PhotoBatch.translate(engine,regions,"en","tr",()->true,n->{},callback(result));engine.pending.success("bir");engine.pending.success("iki");assertEquals(2,engine.calls);assertEquals(Arrays.asList("bir","iki","bir"),result.get());assertEquals("",regions.get(0).translated);}
    @Test public void cancelledBatchDoesNotTranslateNextRegion(){Fake engine=new Fake();AtomicBoolean active=new AtomicBoolean(true);AtomicReference<List<String>> result=new AtomicReference<>();PhotoBatch.translate(engine,regions("one","two"),"en","tr",active::get,n->{},callback(result));active.set(false);engine.pending.success("bir");assertEquals(1,engine.calls);assertNull(result.get());}
    @Test public void cyrillicQualityDistinguishesTheReportedLatinGarbage(){assertEquals(1f,OfflinePhotoOcr.cyrillicShare("кошничка за пазарење"),0);assertEquals(0f,OfflinePhotoOcr.cyrillicShare("KOWHM4Ka 3a nazapebe"),0);}
    private void touch(View view,int action,float x,float y){MotionEvent e=MotionEvent.obtain(0,0,action,x,y,0);view.onTouchEvent(e);e.recycle();}
    private List<PhotoPage.Region> regions(String... texts){List<PhotoPage.Region> result=new ArrayList<>();for(String s:texts)result.add(new PhotoPage.Region(new RectF(0,0,30,10),s));return result;}
    private TranslationEngine.Callback<List<String>> callback(AtomicReference<List<String>> target){return new TranslationEngine.Callback<List<String>>(){public void success(List<String> v){target.set(v);}public void failure(Exception e){throw new AssertionError(e);}};}
    static class Fake implements TranslationEngine {int calls;Callback<String> pending;public void prepare(String f,String t,boolean w,Callback<Void> c){c.success(null);}public void translate(String s,String f,String t,Callback<String> c){calls++;pending=c;}public void close(){}}
}
