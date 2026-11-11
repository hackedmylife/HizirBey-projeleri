package com.hizirbey.tercuman;

import android.content.Context;
import android.graphics.Bitmap;
import com.googlecode.tesseract.android.TessBaseAPI;
import java.io.*;

/** Bundled Macedonian reader; no model download or Play Services required. */
final class OfflinePhotoOcr {
    static String read(Context context,Bitmap bitmap)throws IOException {
        File root=new File(context.getNoBackupFilesDir(),"offline-ocr");
        File data=new File(root,"tessdata");
        if(!data.exists()&&!data.mkdirs())throw new IOException("Fotoğraf modeli klasörü açılamadı.");
        File model=new File(data,"mkd.traineddata");
        long length;
        try(android.content.res.AssetFileDescriptor asset=context.getAssets().openFd("tessdata/mkd.traineddata")){length=asset.getLength();}
        if(!model.isFile()||model.length()!=length){
            File temp=new File(data,"mkd.tmp");
            try(InputStream in=context.getAssets().open("tessdata/mkd.traineddata");OutputStream out=new FileOutputStream(temp)){
                byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);
            }
            if(temp.length()!=length||!temp.renameTo(model))throw new IOException("Fotoğraf modeli hazırlanamadı.");
        }
        TessBaseAPI reader=new TessBaseAPI();
        try{
            if(!reader.init(root.getAbsolutePath(),"mkd"))throw new IOException("Makedonca fotoğraf modeli açılamadı.");
            reader.setImage(bitmap);String result=reader.getUTF8Text();return result==null?"":result.trim();
        }finally{reader.recycle();}
    }
}
