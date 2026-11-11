package com.hizirbey.tercuman;
import android.content.Context;
import android.graphics.*;
import com.googlecode.tesseract.android.*;
import java.io.*;
import java.util.*;
final class OfflinePhotoOcr {
    static final class Result {
        final String text;final int confidence;final List<PhotoPage.Region> regions;
        Result(String text,int confidence,List<PhotoPage.Region> regions){this.text=clean(text);this.confidence=confidence;this.regions=regions;}
        boolean needsReview(){return confidence<60||cyrillicShare(text)<0.5f;}
        float score(){return confidence+20*cyrillicShare(text);}
    }
    static float cyrillicShare(String text){int letters=0,cyrillic=0;for(int i=0;i<text.length();i++){char c=text.charAt(i);if(Character.isLetter(c)){letters++;if(Character.UnicodeBlock.of(c)==Character.UnicodeBlock.CYRILLIC)cyrillic++;}}return letters==0?0:cyrillic/(float)letters;}
    static String read(Context context,Bitmap bitmap)throws IOException{return readDetailed(context,bitmap).text;}
    static Result readDetailed(Context context,Bitmap bitmap)throws IOException {
        File root=new File(context.getNoBackupFilesDir(),"offline-ocr-best-v1"),data=new File(root,"tessdata");
        if(!data.exists()&&!data.mkdirs())throw new IOException("Fotoğraf modeli klasörü açılamadı.");
        File model=new File(data,"mkd.traineddata");long length;
        try(android.content.res.AssetFileDescriptor asset=context.getAssets().openFd("tessdata/mkd.traineddata")){length=asset.getLength();}
        if(!model.isFile()||model.length()!=length){File temp=new File(data,"mkd.tmp");
            try(InputStream in=context.getAssets().open("tessdata/mkd.traineddata");OutputStream out=new FileOutputStream(temp)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}
            if(temp.length()!=length||!temp.renameTo(model))throw new IOException("Fotoğraf modeli hazırlanamadı.");}
        TessBaseAPI reader=new TessBaseAPI();Bitmap prepared=prepare(bitmap);
        try{if(!reader.init(root.getAbsolutePath(),"mkd",TessBaseAPI.OEM_LSTM_ONLY))throw new IOException("Makedonca fotoğraf modeli açılamadı.");
            reader.setVariable("user_defined_dpi","300");reader.setPageSegMode(TessBaseAPI.PageSegMode.PSM_SPARSE_TEXT);reader.setImage(prepared);
            Result best=result(reader,prepared,bitmap);
            if(best.needsReview()){reader.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO);reader.setImage(prepared);Result other=result(reader,prepared,bitmap);if(!other.text.isEmpty()&&(best.text.isEmpty()||other.score()>best.score()))best=other;}
            return best;
        }finally{reader.recycle();prepared.recycle();}
    }
    private static Result result(TessBaseAPI reader,Bitmap prepared,Bitmap original){
        String text=reader.getUTF8Text();int confidence=reader.meanConfidence();List<PhotoPage.Region> areas=new ArrayList<>();
        ResultIterator it=reader.getResultIterator();if(it!=null){try{it.begin();do{String line=it.getUTF8Text(TessBaseAPI.PageIteratorLevel.RIL_PARA);int[] box=it.getBoundingBox(TessBaseAPI.PageIteratorLevel.RIL_PARA);
            if(line!=null&&!line.trim().isEmpty()&&box!=null){float sx=original.getWidth()/(float)prepared.getWidth(),sy=original.getHeight()/(float)prepared.getHeight();
                RectF r=new RectF(box[0]*sx,box[1]*sy,box[2]*sx,box[3]*sy);if(r.intersect(0,0,original.getWidth(),original.getHeight()))areas.add(new PhotoPage.Region(r,clean(line)));}
        }while(it.next(TessBaseAPI.PageIteratorLevel.RIL_PARA));}finally{it.delete();}}
        return new Result(text,confidence,areas);
    }
    private static String clean(String text){return text==null?"":text.replaceAll("(?m)^\\s*[|¦]\\s+(?=\\p{L})","").trim();}
    /** Preserve the photographed paper's luminance: a white border can destroy low-contrast glyphs at thresholding. */
    static Bitmap prepare(Bitmap source){
        float scale=Math.min(3f,Math.min(3000f/source.getWidth(),3000f/source.getHeight()));scale=Math.min(scale,(float)Math.sqrt(6000000d/(source.getWidth()*(double)source.getHeight())));
        int w=Math.max(1,Math.round(source.getWidth()*scale)),h=Math.max(1,Math.round(source.getHeight()*scale));
        Bitmap scaled=Bitmap.createScaledBitmap(source,w,h,true);return scaled==source?source.copy(Bitmap.Config.ARGB_8888,false):scaled;
    }
}
