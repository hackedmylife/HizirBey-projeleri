package com.hizirbey.tercuman;

import android.content.Context;
import android.graphics.*;
import android.view.View;
import android.widget.EditText;
import android.widget.ScrollView;
import android.widget.LinearLayout;
import java.util.concurrent.TimeUnit;
import java.io.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.*;
import org.robolectric.util.ReflectionHelpers;
import org.robolectric.shadows.ShadowLooper;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=33,qualifiers="tr-rTR-w393dp-h851dp-xxhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class LayoutTest {
    @Test public void rendersFourPhoneScreensWithoutCrash()throws Exception{
        RuntimeEnvironment.getApplication().getSharedPreferences("tercuman",Context.MODE_PRIVATE).edit().clear().putBoolean("setupOfferV2",true).commit();
        ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();
        MainActivity a=controller.get();ShadowLooper.idleMainLooper();
        save(a,"conversation");
        assertEquals(0,((ScrollView)ReflectionHelpers.getField(a,"mainScroll")).getScrollY());
        View languages=((LinearLayout)ReflectionHelpers.getField(a,"body")).getChildAt(0);
        assertTrue(languages.getHeight()>0);assertTrue(languages.getGlobalVisibleRect(new Rect()));
        ReflectionHelpers.callInstanceMethod(a,"changeMode",ReflectionHelpers.ClassParameter.from(int.class,1));
        ((EditText)ReflectionHelpers.getField(a,"input")).setText("Merhaba, tren istasyonu nerede?");
        save(a,"text");
        ReflectionHelpers.callInstanceMethod(a,"changeMode",ReflectionHelpers.ClassParameter.from(int.class,2));save(a,"photo");
        ReflectionHelpers.callInstanceMethod(a,"changeMode",ReflectionHelpers.ClassParameter.from(int.class,3));save(a,"history");
        assertNotNull(a.findViewById(android.R.id.content));controller.pause().stop().destroy();
    }
    private void save(MainActivity activity,String name)throws IOException{
        View decor=activity.getWindow().getDecorView();
        decor.measure(View.MeasureSpec.makeMeasureSpec(1179,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(2553,View.MeasureSpec.EXACTLY));
        decor.layout(0,0,1179,2553);
        ShadowLooper.idleMainLooper(300,TimeUnit.MILLISECONDS);
        decor.invalidate();
        Bitmap bitmap=Bitmap.createBitmap(1179,2553,Bitmap.Config.ARGB_8888);decor.draw(new Canvas(bitmap));
        File directory=new File("build/layout-previews");assertTrue(directory.exists()||directory.mkdirs());
        try(FileOutputStream out=new FileOutputStream(new File(directory,name+".png"))){bitmap.compress(Bitmap.CompressFormat.PNG,100,out);}
        bitmap.recycle();
    }
}
