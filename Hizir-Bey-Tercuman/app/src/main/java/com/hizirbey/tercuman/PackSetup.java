package com.hizirbey.tercuman;

import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.widget.*;
import androidx.core.content.FileProvider;
import com.google.mlkit.common.model.*;
import com.google.mlkit.nl.translate.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/** One consent for all offline translation packs and one optional, separate free TTS engine. */
final class PackSetup implements AutoCloseable {
    private static final String VOICE_PACKAGE="com.reecedunn.espeak";
    private static final String VOICE_URL="https://f-droid.org/repo/com.reecedunn.espeak_22.apk";
    private static final String VOICE_SHA256="0a7822fec54d7f7ae759ffedc9afeaa77f809587b171fb2101998787821ec790";
    private final Activity activity;
    private final SharedPreferences prefs;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService downloader=Executors.newSingleThreadExecutor();
    private volatile boolean closed;
    private boolean running,voiceDownloading,offerVisible,resumed,permissionPromptShown,foregroundWork;
    private Runnable queueDeadline;
    private int generation;
    private AlertDialog progressDialog;
    private AlertDialog offerDialog;
    private TextView progress;
    PackSetup(Activity activity,SharedPreferences prefs){this.activity=activity;this.prefs=prefs;}
    void onResume(){
        if(closed)return;resumed=true;
        if(prefs.getBoolean("voiceInstallPending",false))continueVoiceInstall();
        else if(prefs.getBoolean("voiceInitPending",false)&&voiceInstalled()){
            prefs.edit().putBoolean("voiceInitPending",false).apply();
            Intent launch=activity.getPackageManager().getLaunchIntentForPackage(VOICE_PACKAGE);
            if(launch!=null){toast("Ses motoru ilk açılışta verilerini hazırlar. Ardından Geri ile Tercüman'a dön.");activity.startActivity(launch);}
        }
        if(!prefs.getBoolean("setupOfferV2",false))showOffer();
        else if(prefs.getBoolean("allPacksPending",false)&&!running&&!foregroundWork)downloadAll();
    }
    void onPause(){resumed=false;}
    void pauseForConversation(){
        foregroundWork=true;
        if(running){running=false;generation++;clearQueueDeadline();setProgress("Konuşma için toplu indirme sırasına ara verildi. Seçili çeviri çifti öncelikli hazırlanacak.");}
    }
    void resumeAfterConversation(){
        foregroundWork=false;
        main.postDelayed(()->{if(!closed&&resumed&&!foregroundWork&&!running&&prefs.getBoolean("allPacksPending",false))downloadAll(false);},2000);
    }
    static ArrayList<String> downloadableLanguages(Collection<String> languages){
        ArrayList<String> out=new ArrayList<>();for(String l:languages)if(!l.equals("en"))out.add(l);
        Collections.sort(out);if(out.remove("tr"))out.add(0,"tr");if(out.remove("mk"))out.add(Math.min(1,out.size()),"mk");return out;
    }
    void showOffer(){
        if(closed||offerVisible)return;offerVisible=true;prefs.edit().putBoolean("setupOfferV2",true).apply();
        LinearLayout content=new LinearLayout(activity);content.setOrientation(LinearLayout.VERTICAL);
        int padding=Math.round(20*activity.getResources().getDisplayMetrics().density);content.setPadding(padding,padding,padding,padding);
        TextView message=new TextView(activity);message.setText("Tüm dil ve ses desteğini bir kez hazırlayalım mı?\n\n• Yerel konuşma tanıma modeli zaten uygulamanın içinde. İngilizce ve Makedonca için ayrı tanıma paketi gerekmez.\n• Desteklenen 59 dilde metin çevirisi için 58 paket indirilir; İngilizce ortak dildir. Yaklaşık 2 GB boş alan ve internet gerekir. Kesin boyut modellere göre değişir.\n• İsteğe bağlı ücretsiz eSpeak NG ses motoru, çok sayıda dili tek kurulumla seslendirir. Ayrı bir uygulama olarak kurulur; Android kurulum onayı gerekir. Sesi doğal seslere göre daha robotiktir.\n\nİndirmeler tamamlanana kadar uygulamayı açık tut. Yarım kalan paketler sonraki açılışta sürdürülür.");content.addView(message);
        CheckBox voices=new CheckBox(activity);voices.setText("Çok dilli ücretsiz ses motorunu da kur (yaklaşık 10 MB)");voices.setChecked(true);content.addView(voices);
        ScrollView scroll=new ScrollView(activity);scroll.addView(content);
        offerDialog=new AlertDialog.Builder(activity).setTitle("Tüm paketleri hazırla").setView(scroll)
            .setPositiveButton("Tümünü hazırla",(d,w)->{
                prefs.edit().putBoolean("allPacksPending",true).apply();downloadAll();
                if(voices.isChecked())installVoiceEngine();
            }).setNegativeButton("Şimdilik geç",null).setOnDismissListener(d->offerVisible=false).show();
    }
    private void downloadAll(){
        downloadAll(true);
    }
    private void downloadAll(boolean showUi){
        if(closed||running||foregroundWork)return;running=true;int token=++generation;
        if(showUi)showProgress();setProgress("Yüklü paketler kontrol ediliyor…");armQueueDeadline(token);
        RemoteModelManager manager=RemoteModelManager.getInstance();
        manager.getDownloadedModels(TranslateRemoteModel.class).addOnSuccessListener(existing->{
            if(!valid(token))return;clearQueueDeadline();Set<String> loaded=new HashSet<>();for(TranslateRemoteModel m:existing)loaded.add(m.getLanguage());
            ArrayList<String> all=downloadableLanguages(TranslateLanguage.getAllLanguages());
            downloadNext(all,loaded,0,token);
        }).addOnFailureListener(e->downloadFailed(token));
    }
    private boolean valid(int token){return !closed&&running&&generation==token;}
    private void downloadNext(ArrayList<String> all,Set<String> loaded,int position,int token){
        if(!valid(token))return;
        int index=position;while(index<all.size()&&loaded.contains(all.get(index)))index++;
        if(index>=all.size()){
            running=false;clearQueueDeadline();prefs.edit().putBoolean("allPacksPending",false).putBoolean("allPacksReady",true).apply();
            setProgress("Tüm metin çevirisi paketleri hazır. Ses tanıma modeli uygulamada hazır; sesli okuma için ses motorunun kurulumunu tamamla.");
            toast("Tüm metin çevirisi paketleri hazır.");return;
        }
        String language=all.get(index);int next=index+1;
        setProgress("Paket "+next+" / "+all.size()+" · "+LanguageCatalog.name(language)+"\nİndiriliyor veya Wi-Fi bekleniyor…\n\nDaha önce indirilen paketler korunur.");
        DownloadConditions.Builder options=new DownloadConditions.Builder();if(prefs.getBoolean("wifiOnly",true))options.requireWifi();
        armQueueDeadline(token);
        RemoteModelManager.getInstance().download(new TranslateRemoteModel.Builder(language).build(),options.build())
            .addOnSuccessListener(v->{if(valid(token)){clearQueueDeadline();loaded.add(language);downloadNext(all,loaded,next,token);}})
            .addOnFailureListener(e->downloadFailed(token));
    }
    private void downloadFailed(int token){
        if(!valid(token))return;running=false;clearQueueDeadline();
        setProgress("Paket indirme kesildi. Wi-Fi, boş alan ve Google Play Hizmetlerini kontrol et. Uygulamayı yeniden açınca eksik paketlerden devam edilir.");
        toast("Bazı paketler indirilemedi. İndirilenler korundu.");
    }
    private void clearQueueDeadline(){if(queueDeadline!=null)main.removeCallbacks(queueDeadline);queueDeadline=null;}
    private void armQueueDeadline(int token){
        clearQueueDeadline();queueDeadline=()->downloadFailed(token);main.postDelayed(queueDeadline,180000);
    }
    private void showProgress(){
        if(progressDialog!=null&&progressDialog.isShowing())return;
        progress=new TextView(activity);int pad=Math.round(22*activity.getResources().getDisplayMetrics().density);progress.setPadding(pad,pad,pad,pad);
        progressDialog=new AlertDialog.Builder(activity).setTitle("Dil paketleri hazırlanıyor").setView(progress)
            .setPositiveButton("Arka plana al",null).setNegativeButton("İndirme sırasını durdur",(d,w)->{
                running=false;generation++;clearQueueDeadline();prefs.edit().putBoolean("allPacksPending",false).apply();
                toast("İndirme sırası durduruldu. Başlamış olan paket indirmesi Android tarafından tamamlanabilir.");
            }).create();progressDialog.show();
    }
    private void setProgress(String value){if(!closed&&progress!=null)progress.setText(value);}
    private boolean voiceInstalled(){try{activity.getPackageManager().getPackageInfo(VOICE_PACKAGE,0);return true;}catch(PackageManager.NameNotFoundException e){return false;}}
    void installVoiceEngine(){
        if(closed)return;
        if(voiceInstalled()){
            toast("Çok dilli ses motoru yüklü. İlk hazırlık ekranı açılıyor; ardından Geri ile dön.");
            Intent launch=activity.getPackageManager().getLaunchIntentForPackage(VOICE_PACKAGE);if(launch!=null)activity.startActivity(launch);return;
        }
        if(voiceDownloading){toast("Ses motoru indiriliyor…");return;}
        voiceDownloading=true;toast("Ücretsiz çok dilli ses motoru indiriliyor (yaklaşık 10 MB)…");
        downloader.execute(()->{
            File dir=new File(activity.getCacheDir(),"voice-installer");File temp=new File(dir,"voice.tmp"),apk=new File(dir,"espeak.apk");
            try{
                if(!dir.exists()&&!dir.mkdirs())throw new IOException("Kurulum klasörü açılamadı.");
                HttpURLConnection connection=(HttpURLConnection)new URL(VOICE_URL).openConnection();connection.setConnectTimeout(20000);connection.setReadTimeout(20000);
                try{
                    if(connection.getResponseCode()!=200)throw new IOException("Ses motoru indirilemedi.");
                    MessageDigest digest=MessageDigest.getInstance("SHA-256");long total=0;
                    try(InputStream in=connection.getInputStream();OutputStream out=new FileOutputStream(temp)){
                        byte[] buffer=new byte[65536];int count;while((count=in.read(buffer))!=-1){
                            if(closed)throw new IOException("İndirme iptal edildi.");total+=count;if(total>20000000)throw new IOException("Beklenmeyen paket boyutu.");
                            digest.update(buffer,0,count);out.write(buffer,0,count);
                        }
                    }
                    StringBuilder hex=new StringBuilder();for(byte b:digest.digest())hex.append(String.format(Locale.ROOT,"%02x",b&255));
                    if(!VOICE_SHA256.equals(hex.toString()))throw new IOException("Ses motorunun bütünlüğü doğrulanamadı. Kurulum yapılmadı.");
                }finally{connection.disconnect();}
                PackageInfo info=activity.getPackageManager().getPackageArchiveInfo(temp.getAbsolutePath(),0);
                if(info==null||!VOICE_PACKAGE.equals(info.packageName))throw new IOException("Beklenmeyen uygulama paketi.");
                if(!temp.renameTo(apk))throw new IOException("Kurulum dosyası hazırlanamadı.");
                main.post(()->{
                    voiceDownloading=false;if(closed)return;prefs.edit().putBoolean("voiceInstallPending",true).putBoolean("voiceInitPending",true).apply();
                    if(resumed)continueVoiceInstall();
                });
            }catch(Exception e){temp.delete();main.post(()->{voiceDownloading=false;if(!closed){
                new AlertDialog.Builder(activity).setTitle("Ses motoru kurulamadı").setMessage(e.getMessage()+"\nİstersen resmi indirme sayfasını açabilirsin.")
                    .setPositiveButton("Resmi sayfa",(d,w)->activity.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://f-droid.org/packages/com.reecedunn.espeak/"))))
                    .setNegativeButton("Kapat",null).show();
            }});}
        });
    }
    private void continueVoiceInstall(){
        if(closed||!resumed)return;
        if(activity.getPackageManager().canRequestPackageInstalls()){launchInstaller();return;}
        if(permissionPromptShown)return;permissionPromptShown=true;
        new AlertDialog.Builder(activity).setTitle("Android kurulum izni")
            .setMessage("eSpeak NG ayrı ve ücretsiz bir ses motorudur. Android, Tercüman'ın bu paketi kurabilmesi için bir kez izin ister. İzni açıp Geri ile dön; ardından sistemin Yükle onayını ver.")
            .setPositiveButton("İzin ekranını aç",(d,w)->activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName()))))
            .setNegativeButton("Şimdi değil",(d,w)->prefs.edit().putBoolean("voiceInstallPending",false).apply()).show();
    }
    private void launchInstaller(){
        if(closed)return;File apk=new File(activity.getCacheDir(),"voice-installer/espeak.apk");
        prefs.edit().putBoolean("voiceInstallPending",false).apply();
        if(!apk.isFile()){toast("Ses motoru kurulum dosyası bulunamadı. Hazırlamayı yeniden başlat.");return;}
        Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".files",apk);
        Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);intent.setClipData(ClipData.newRawUri("Ses motoru",uri));
        try{activity.startActivity(intent);}catch(ActivityNotFoundException e){toast("Android paket kurucusu açılamadı.");}
    }
    private void toast(String message){if(!closed)Toast.makeText(activity,message,Toast.LENGTH_LONG).show();}
    @Override public void close(){closed=true;running=false;generation++;downloader.shutdownNow();main.removeCallbacksAndMessages(null);if(progressDialog!=null)progressDialog.dismiss();if(offerDialog!=null)offerDialog.dismiss();}
}
