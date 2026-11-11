package com.hizirbey.tercuman;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.speech.*;
import android.speech.tts.*;
import android.text.InputFilter;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;
import androidx.core.content.FileProvider;
import androidx.exifinterface.media.ExifInterface;
import com.google.mlkit.common.model.*;
import com.google.mlkit.nl.languageid.*;
import com.google.mlkit.nl.translate.*;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.*;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions;
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions;
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions;
import java.io.*;
import java.text.DateFormat;
import java.util.*;
import java.util.concurrent.*;

/** Native, foreground-only translator. No microphone/background service or paid endpoint. */
public class MainActivity extends Activity {
    private static final int BG=0xFF0D101B, CARD=0xFF181D2E, CARD2=0xFF20263B,
        TEXT=0xFFF4F3FF, MUTED=0xFF9DA6BE, ACCENT=0xFFB6AAFF, GREEN=0xFF8BE3C3;
    private static final int MICROPHONE_REQUEST=10, CAMERA_RESULT=20, GALLERY_RESULT=21;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService imageExecutor=Executors.newSingleThreadExecutor();
    private final SessionGate gate=new SessionGate();
    private final ArrayList<String> languages=new ArrayList<>();
    private final ArrayList<Button> tabButtons=new ArrayList<>();
    private SharedPreferences prefs;
    private HistoryStore history;
    private TranslationEngine engine;
    private TextToSpeech tts;
    private boolean ttsReady, foreground, sessionActive, favoritesOnly, building;
    private int mode=0, activeSide=0, permissionSide=-1, silenceCount=0;
    private String source="tr", target="en", draft="", draftFrom="tr", translation="", lastFrom="tr", lastTo="en";
    private SpeechRecognizer speech;
    private EmbeddedSpeech embeddedSpeech;
    private boolean embeddedThisTurn;
    private final Map<String,TextToSpeech> extraTts=new LinkedHashMap<>();
    private final Set<String> readyTts=new HashSet<>();
    private TextToSpeech speakingTts;
    private PackSetup packSetup;
    private final Set<String> warnedVoiceLanguages=new HashSet<>();
    private Uri cameraUri;
    private String photoSource, photoTarget;
    private HistoryStore.Entry lastEntry;
    private EditText input;
    private TextView output, status, originalLabel, translatedLabel;
    private LinearLayout root, body;
    private LinearLayout translatedPanel;
    private ScrollView mainScroll;
    private Button firstTalk, secondTalk, stopButton, favoriteButton;
    private Runnable afterSpeech;
    private String utteranceId="";
    private Bitmap photoPreview;
    private int resumeVoiceSide=-1;
    private long preparationSerial;
    private boolean preparationActive;
    private Runnable preparationHeartbeat,preparationDeadline;
    private String lastPreparationError="";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs=getSharedPreferences("tercuman",MODE_PRIVATE);
        history=new HistoryStore(prefs);
        engine=new LocalTranslationEngine();
        embeddedSpeech=new EmbeddedSpeech(this);
        packSetup=new PackSetup(this,prefs);
        languages.addAll(TranslateLanguage.getAllLanguages());
        languages.sort((a,b)->java.text.Collator.getInstance(LanguageCatalog.TURKISH)
            .compare(LanguageCatalog.name(a),LanguageCatalog.name(b)));
        source=prefs.getString("source","tr"); target=prefs.getString("target","en");
        if(!languages.contains(source)) source="tr";
        if(!languages.contains(target)) target="en";
        if(state!=null) {
            draft=state.getString("draft",""); translation=state.getString("translation","");
            draftFrom=state.getString("draftFrom",source);
            lastFrom=state.getString("lastFrom",source);lastTo=state.getString("lastTo",target);
            mode=state.getInt("mode",0);
            String uri=state.getString("cameraUri");
            if(uri!=null) cameraUri=Uri.parse(uri);
            photoSource=state.getString("photoSource",source);photoTarget=state.getString("photoTarget",target);
        }
        initTts(); render();
    }
    @Override protected void onResume() {
        super.onResume();foreground=true;refreshTtsEngines();
        handler.post(()->{if(foreground&&!isFinishing())packSetup.onResume();});
        if(resumeVoiceSide>=0){int side=resumeVoiceSide;resumeVoiceSide=-1;handler.post(()->{if(foreground)startVoice(side);});}
    }
    @Override protected void onPause() {
        foreground=false;if(packSetup!=null)packSetup.onPause();int requestedSide=permissionSide;stopSession();permissionSide=requestedSide;super.onPause();
    }
    @Override protected void onDestroy() {
        stopSession(); handler.removeCallbacksAndMessages(null); engine.close();
        embeddedSpeech.close();packSetup.close();
        imageExecutor.shutdownNow(); if(tts!=null) tts.shutdown();
        for(TextToSpeech voice:extraTts.values())voice.shutdown();extraTts.clear();
        if(photoPreview!=null) photoPreview.recycle();
        super.onDestroy();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        rememberInput();state.putString("draft",draft);state.putString("translation",translation);
        state.putString("draftFrom",draftFrom);
        state.putString("lastFrom",lastFrom);state.putString("lastTo",lastTo);state.putInt("mode",mode);
        if(cameraUri!=null) state.putString("cameraUri",cameraUri.toString());
        state.putString("photoSource",photoSource);state.putString("photoTarget",photoTarget);
        super.onSaveInstanceState(state);
    }
    private boolean alive(long token) { return gate.accepts(token)&&!isFinishing()&&!isDestroyed(); }
    private int dp(float v) { return Math.round(v*getResources().getDisplayMetrics().density); }
    private GradientDrawable shape(int color,int radius) {
        GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;
    }
    private LinearLayout vertical() { LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l; }
    private LinearLayout horizontal() { LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l; }
    private TextView text(String value,int size,int color,boolean bold) {
        TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);
        t.setFontFeatureSettings("kern");
        if(bold)t.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));
        return t;
    }
    private void gap(LinearLayout parent,int height) { View v=new View(this);parent.addView(v,new LinearLayout.LayoutParams(1,dp(height))); }
    private Button button(String title,boolean primary,Runnable action) {
        Button b=new Button(this);b.setText(title);b.setTextSize(14);b.setAllCaps(false);
        b.setTextColor(primary?BG:TEXT);b.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));
        b.setBackground(shape(primary?ACCENT:CARD2,16));b.setMinHeight(dp(48));
        b.setMinimumWidth(0);b.setMinWidth(0);b.setStateListAnimator(null);
        b.setPadding(dp(10),dp(8),dp(10),dp(8));b.setOnClickListener(v->action.run());
        return b;
    }
    private void full(LinearLayout parent,View child) { parent.addView(child,new LinearLayout.LayoutParams(-1,-2)); }
    private void rowItem(LinearLayout row,View child) {
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);p.setMargins(dp(3),0,dp(3),0);row.addView(child,p);
    }
    private LinearLayout card(LinearLayout parent,int color) {
        LinearLayout l=vertical();l.setPadding(dp(18),dp(18),dp(18),dp(18));l.setBackground(shape(color,22));full(parent,l);return l;
    }
    private void rememberInput() { if(input!=null) draft=input.getText().toString(); }
    private void render() {
        building=true;
        input=null;output=null;originalLabel=null;translatedLabel=null;
        firstTalk=null;secondTalk=null;stopButton=null;favoriteButton=null;
        root=vertical();root.setBackgroundColor(BG);root.setPadding(dp(20),dp(16),dp(20),dp(12));
        root.setFocusableInTouchMode(true);
        root.setFitsSystemWindows(true);setContentView(root);
        LinearLayout header=horizontal();LinearLayout names=vertical();
        TextView brand=text("HIZIR BEY",11,ACCENT,true);brand.setLetterSpacing(.18f);full(names,brand);
        full(names,text("Tercüman",29,TEXT,true));
        header.addView(names,new LinearLayout.LayoutParams(0,-2,1));
        Button menu=button("Ayarlar",false,this::settings);header.addView(menu);full(root,header);gap(root,14);
        LinearLayout chip=horizontal();chip.setPadding(dp(12),dp(8),dp(12),dp(8));chip.setBackground(shape(0xFF142B29,12));
        full(chip,text("●  Ücretsiz · Cihazda çeviri",12,GREEN,true));full(root,chip);gap(root,14);
        LinearLayout tabs=horizontal();tabButtons.clear();
        String[] titles={"Konuşma","Metin","Fotoğraf","Geçmiş"};
        for(int i=0;i<titles.length;i++) {
            final int selected=i;Button b=button(titles[i],i==mode,()->changeMode(selected));
            b.setTextSize(12);b.setPadding(dp(3),dp(8),dp(3),dp(8));rowItem(tabs,b);tabButtons.add(b);
        }
        full(root,tabs);gap(root,12);
        ScrollView scroll=new ScrollView(this);mainScroll=scroll;scroll.setFillViewport(false);scroll.setClipToPadding(false);
        body=vertical();body.setPadding(0,0,0,dp(12));scroll.addView(body);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        if(mode==3) renderHistory(); else renderTranslator();
        if(mode==0)renderConversationControls();
        if(mode!=3){
            gap(root,8);stopButton=button("Durdur",false,()->{stopSession();setStatus("İşlem durduruldu. Yeni bir çeviri başlatabilirsin.");});
            stopButton.setMinHeight(dp(40));full(root,stopButton);
        }
        gap(root,6);status=text("Hazır · Bir dil ve işlem seç.",12,MUTED,false);
        status.setPadding(dp(2),dp(6),dp(2),dp(4));status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);full(root,status);
        scroll.setFocusableInTouchMode(true);scroll.setDescendantFocusability(ViewGroup.FOCUS_BEFORE_DESCENDANTS);
        scroll.requestFocus();scroll.post(()->scroll.scrollTo(0,0));
        building=false;
    }
    private void renderConversationControls(){
        gap(root,8);LinearLayout talkRow=horizontal();
        firstTalk=button("●  "+LanguageCatalog.name(source)+" konuş",true,()->startVoice(0));
        secondTalk=button("●  "+LanguageCatalog.name(target)+" konuş",false,()->startVoice(1));
        firstTalk.setMinHeight(dp(60));secondTalk.setMinHeight(dp(60));
        rowItem(talkRow,firstTalk);rowItem(talkRow,secondTalk);full(root,talkRow);
    }
    private void changeMode(int selected) {
        if(mode==selected)return;
        rememberInput();stopSession();mode=selected;render();hideKeyboard();
    }
    private void renderTranslator() {
        LinearLayout languageCard=card(body,CARD);languageCard.setPadding(dp(10),dp(10),dp(10),dp(10));
        LinearLayout row=horizontal();
        LinearLayout left=vertical();full(left,text("KAYNAK",10,MUTED,true));Spinner sourceSpinner=spinner(source);full(left,sourceSpinner);
        LinearLayout right=vertical();full(right,text("HEDEF",10,MUTED,true));Spinner targetSpinner=spinner(target);full(right,targetSpinner);
        row.addView(left,new LinearLayout.LayoutParams(0,-2,1));
        Button swap=button("⇄",false,()->{
            rememberInput();stopSession();String old=source;source=target;target=old;saveLanguages();render();
        });swap.setContentDescription("Kaynak ve hedef dilleri değiştir");row.addView(swap,new LinearLayout.LayoutParams(dp(48),dp(48)));
        row.addView(right,new LinearLayout.LayoutParams(0,-2,1));full(languageCard,row);gap(body,12);
        setLanguageListener(sourceSpinner,true);setLanguageListener(targetSpinner,false);
        if(mode==0) {
            full(body,text("Konuş, anlaş.",23,TEXT,true));gap(body,5);
            full(body,text("Alttan konuşanın dilini seç. Google ile çeviri karşı dilde seslendirilsin.",13,MUTED,false));
            if(prefs.getBoolean("repeat",false)){
                gap(body,5);full(body,text(prefs.getBoolean("alternate",false)?"● Sırayla iki dilde dinleme açık":"● Seçili yönde yeniden dinleme açık",11,GREEN,false));
            }
            gap(body,12);
        } else if(mode==2) {
            full(body,text("Gördüğünü çevir.",23,TEXT,true));gap(body,5);
            full(body,text("Menü, tabela veya fotoğraftaki yazıyı seç. Okunan metni çeviriden önce düzenleyebilirsin.",14,MUTED,false));gap(body,12);
            LinearLayout photoRow=horizontal();rowItem(photoRow,button("Kamera",true,this::takePhoto));
            rowItem(photoRow,button("Fotoğraf seç",false,this::pickPhoto));full(body,photoRow);gap(body,10);
            full(body,text("Fotoğraf okuma: Latin, Çince, Japonca, Korece ve Devanagari alfabeleri.",12,MUTED,false));gap(body,12);
            if(photoPreview!=null&&!photoPreview.isRecycled()) {
                ImageView preview=new ImageView(this);preview.setImageBitmap(photoPreview);preview.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
                preview.setContentDescription("Okunan fotoğrafın önizlemesi");body.addView(preview,new LinearLayout.LayoutParams(-1,dp(160)));gap(body,12);
            }
        }
        LinearLayout originalCard=card(body,CARD);
        originalLabel=text("ORİJİNAL · "+LanguageCatalog.name(mode==0&&!draft.isEmpty()?draftFrom:source),11,MUTED,true);full(originalCard,originalLabel);gap(originalCard,8);
        input=new EditText(this);input.setText(draft);input.setHint(mode==0?"Konuşman burada görünecek…":"Çevrilecek metni buraya yaz…");
        input.setTextSize(19);input.setTextColor(TEXT);input.setHintTextColor(0xFF77829D);input.setBackgroundColor(Color.TRANSPARENT);
        input.setGravity(Gravity.TOP|Gravity.START);input.setMinLines(mode==0?1:3);input.setMaxLines(mode==0?3:8);input.setPadding(0,0,0,0);
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE|android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setFilters(new InputFilter[]{new InputFilter.LengthFilter(4000)});input.setContentDescription("Orijinal metin, en çok 4000 karakter");full(originalCard,input);
        if(mode!=0) {
            gap(originalCard,12);LinearLayout tools=horizontal();
            rowItem(tools,button("Yapıştır",false,()->{
                ClipboardManager clip=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                if(clip.hasPrimaryClip()&&clip.getPrimaryClip()!=null&&clip.getPrimaryClip().getItemCount()>0) {
                    CharSequence s=clip.getPrimaryClip().getItemAt(0).coerceToText(this);if(s!=null)input.setText(s);
                } else toast("Panoda metin bulunamadı.");
            }));
            rowItem(tools,button("Dili algıla",false,this::detectLanguage));full(originalCard,tools);
            gap(originalCard,10);full(originalCard,button("Google ile çevir",true,this::submitText));
        }
        gap(body,12);LinearLayout translatedCard=card(body,0xFF25243D);translatedPanel=translatedCard;
        translatedLabel=text("ÇEVİRİ · "+LanguageCatalog.name(translation.isEmpty()?target:lastTo),11,ACCENT,true);full(translatedCard,translatedLabel);gap(translatedCard,9);
        output=text(translation.isEmpty()?"Çevirin burada görünecek.":translation,22,translation.isEmpty()?MUTED:TEXT,false);
        output.setTextIsSelectable(true);output.setMinLines(2);full(translatedCard,output);gap(translatedCard,14);
        LinearLayout actions=horizontal();rowItem(actions,button("Dinle",false,()->replay(translation,lastTo)));
        rowItem(actions,button("Kopyala",false,()->copy(translation)));
        favoriteButton=button(lastEntry!=null&&lastEntry.favorite?"★ Kayıtlı":"☆ Kaydet",false,()->{
            if(lastEntry==null){toast("Önce geçmiş kaydı açıkken bir çeviri yap.");return;}
            history.toggle(lastEntry);favoriteButton.setText(lastEntry.favorite?"★ Kayıtlı":"☆ Kaydet");
        });rowItem(actions,favoriteButton);full(translatedCard,actions);
        gap(translatedCard,12);attribution(translatedCard);
        gap(body,12);full(body,button("Dil paketlerini yönet",false,this::modelDialog));
    }
    private Spinner spinner(String code) {
        Spinner s=new Spinner(this);List<String> names=new ArrayList<>();for(String l:languages)names.add(LanguageCatalog.name(l));
        ArrayAdapter<String> adapter=new ArrayAdapter<String>(this,android.R.layout.simple_spinner_item,names){
            @Override public View getView(int position,View convert,ViewGroup parent){
                TextView v=(TextView)super.getView(position,convert,parent);v.setTextColor(TEXT);v.setTextSize(16);v.setPadding(dp(3),dp(10),dp(3),dp(10));return v;
            }
        };
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);s.setAdapter(adapter);
        s.setSelection(Math.max(0,languages.indexOf(code)));s.setContentDescription("Seçili dil: "+LanguageCatalog.name(code));return s;
    }
    private void setLanguageListener(Spinner spinner,boolean isSource) {
        spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){
            @Override public void onNothingSelected(AdapterView<?> p){}
            @Override public void onItemSelected(AdapterView<?> p,View v,int pos,long id){
                String chosen=languages.get(pos);String old=isSource?source:target;
                if(building||chosen.equals(old))return;
                rememberInput();stopSession();if(isSource)source=chosen;else target=chosen;
                saveLanguages();render();
            }
        });
    }
    private void saveLanguages(){prefs.edit().putString("source",source).putString("target",target).apply();}
    private void renderHistory() {
        full(body,text("Kelimeler kalsın.",23,TEXT,true));gap(body,5);
        full(body,text("Son 200 çeviri bu telefonda saklanır.",14,MUTED,false));gap(body,12);
        LinearLayout tools=horizontal();rowItem(tools,button(favoritesOnly?"Tümünü göster":"★ Favoriler",false,()->{favoritesOnly=!favoritesOnly;render();}));
        rowItem(tools,button("Geçmişi temizle",false,()->new AlertDialog.Builder(this).setTitle("Geçmiş silinsin mi?")
            .setMessage("Favoriler dahil bu telefondaki tüm çeviri kayıtları silinir.")
            .setNegativeButton("Vazgeç",null).setPositiveButton("Sil",(d,w)->{history.clear();lastEntry=null;render();}).show()));full(body,tools);gap(body,14);
        List<HistoryStore.Entry> items=history.all(favoritesOnly);
        if(items.isEmpty()){LinearLayout empty=card(body,CARD);full(empty,text(favoritesOnly?"Henüz favori yok.":"Henüz çeviri yok.",18,TEXT,true));gap(empty,8);full(empty,text("Yaptığın çeviriler, geçmiş kaydı açıksa burada görünür.",14,MUTED,false));}
        for(HistoryStore.Entry e:items){
            LinearLayout c=card(body,CARD);
            full(c,text(LanguageCatalog.name(e.from)+" → "+LanguageCatalog.name(e.to)+" · "+DateFormat.getDateTimeInstance(DateFormat.SHORT,DateFormat.SHORT,LanguageCatalog.TURKISH).format(new Date(e.time)),11,MUTED,false));
            gap(c,9);full(c,text(e.original,16,MUTED,false));gap(c,7);full(c,text(e.translated,20,TEXT,false));gap(c,12);
            LinearLayout row=horizontal();rowItem(row,button("Dinle",false,()->replay(e.translated,e.to)));
            rowItem(row,button("Kopyala",false,()->copy(e.translated)));
            rowItem(row,button(e.favorite?"★":"☆",false,()->{history.toggle(e);render();}));full(c,row);
            gap(c,10);attribution(c);gap(body,12);
        }
    }
    private void initTts() {
        tts=new TextToSpeech(this,result->{ttsReady=result==TextToSpeech.SUCCESS;if(ttsReady)handler.post(this::refreshTtsEngines);});
        attachTtsListener(tts);
    }
    private void attachTtsListener(TextToSpeech voice){
        voice.setOnUtteranceProgressListener(new UtteranceProgressListener(){
            @Override public void onStart(String id){}
            @Override public void onDone(String id){handler.post(()->finishSpeaking(id,false));}
            @Override public void onError(String id){handler.post(()->finishSpeaking(id,true));}
        });
    }
    private void refreshTtsEngines(){
        if(tts==null||!ttsReady||isDestroyed())return;
        for(TextToSpeech.EngineInfo info:tts.getEngines()){
            if(info.name.equals(tts.getDefaultEngine())||extraTts.containsKey(info.name))continue;
            String name=info.name;TextToSpeech voice=new TextToSpeech(this,result->handler.post(()->{
                if(!isDestroyed()&&result==TextToSpeech.SUCCESS)readyTts.add(name);
            }),name);extraTts.put(name,voice);attachTtsListener(voice);
        }
    }
    private void attribution(LinearLayout parent){
        LinearLayout badge=horizontal();badge.setPadding(dp(8),dp(7),dp(8),dp(7));badge.setBackground(shape(Color.WHITE,6));
        ImageView image=new ImageView(this);image.setImageResource(R.drawable.google_translate_badge);
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setContentDescription("powered by Google Translate");
        badge.addView(image,new LinearLayout.LayoutParams(dp(176),dp(16)));
        parent.addView(badge,new LinearLayout.LayoutParams(-2,-2));
    }
    private void finishSpeaking(String id,boolean error){
        if(!utteranceId.equals(id))return;
        Runnable done=afterSpeech;afterSpeech=null;utteranceId="";
        if(error)toast("Seslendirme tamamlanamadı. Telefonun ses paketlerini kontrol et.");
        if(done!=null)done.run();
    }
    private void speak(String value,String language,long token,Runnable done){
        if(value.isEmpty()){done.run();return;}
        Locale locale=Locale.forLanguageTag(LanguageCatalog.speechTag(language));
        boolean offline=prefs.getBoolean("strictOffline",false);
        ArrayList<TextToSpeech> candidates=new ArrayList<>();if(ttsReady)candidates.add(tts);
        for(String name:readyTts){TextToSpeech voice=extraTts.get(name);if(voice!=null)candidates.add(voice);}
        speakingTts=null;
        for(TextToSpeech candidate:candidates){
            Voice selected=VoiceSelector.choose(candidate.getVoices(),locale,offline);
            if(selected!=null&&candidate.setVoice(selected)==TextToSpeech.SUCCESS){speakingTts=candidate;break;}
            if(!offline&&candidate.setLanguage(locale)>=0){speakingTts=candidate;break;}
        }
        if(speakingTts==null){
            sessionActive=false;
            if(warnedVoiceLanguages.add(language)){
                new AlertDialog.Builder(this).setTitle("Çeviri hazır · Sesli okuma eksik")
                    .setMessage(LanguageCatalog.name(language)+" için yüklü ses motorlarında uygun ses bulunamadı. Ücretsiz çok dilli ses motorunu tek kurulumla hazırlayabilirsin.")
                    .setPositiveButton("Ses desteğini hazırla",(d,w)->packSetup.installVoiceEngine()).setNegativeButton("Metni kullan",null).show();
            }
            done.run();return;
        }
        final TextToSpeech selectedEngine=speakingTts;
        utteranceId="hb-"+token+"-"+System.nanoTime();String id=utteranceId;
        int limit=Math.min(TextToSpeech.getMaxSpeechInputLength(),4000);
        int end=Math.min(value.length(),limit);
        if(end<value.length()){
            int boundary=value.lastIndexOf(' ',end-1);if(boundary>end/2)end=boundary;
            if(end>0&&Character.isHighSurrogate(value.charAt(end-1)))end--;
        }
        final String rest=value.substring(end).trim();
        afterSpeech=()->{if(alive(token)){if(rest.isEmpty())done.run();else speak(rest,language,token,done);}};
        setStatus("Seslendiriliyor · "+LanguageCatalog.name(language));
        String chunk=value.substring(0,end);
        if(selectedEngine.speak(chunk,TextToSpeech.QUEUE_FLUSH,null,id)==TextToSpeech.ERROR){finishSpeaking(id,true);return;}
        handler.postDelayed(()->{
            if(alive(token)&&id.equals(utteranceId)){
                selectedEngine.stop();finishSpeaking(id,true);
            }
        },Math.max(120000,Math.min(600000,chunk.length()*120L)));
    }
    private void replay(String value,String language){
        if(value.isEmpty()){toast("Önce bir çeviri yap.");return;}
        stopSession();long token=gate.current();speak(value,language,token,()->setStatus("Hazır."));
    }
    private void setStatus(String value){if(status!=null)status.setText(value);}
    private void toast(String value){Toast.makeText(this,value,Toast.LENGTH_LONG).show();}
    private void copy(String value){
        if(value.isEmpty()){toast("Kopyalanacak çeviri yok.");return;}
        ((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Çeviri",value));toast("Çeviri kopyalandı.");
    }
    private void hideKeyboard(){
        View focused=getCurrentFocus();if(focused!=null){((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(focused.getWindowToken(),0);focused.clearFocus();}
    }
    private void releaseSpeech(){
        SpeechRecognizer old=speech;speech=null;
        if(old!=null){try{old.cancel();old.destroy();}catch(RuntimeException ignored){}}
    }
    private void stopSession(){
        gate.renew();sessionActive=false;permissionSide=-1;releaseSpeech();
        resumeVoiceSide=-1;cancelPreparationWait();if(engine!=null)engine.cancelPreparation();
        if(packSetup!=null)packSetup.resumeAfterConversation();
        if(embeddedSpeech!=null)embeddedSpeech.cancel();embeddedThisTurn=false;
        afterSpeech=null;utteranceId="";if(tts!=null)tts.stop();
        for(TextToSpeech voice:extraTts.values())voice.stop();
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if(stopButton!=null)stopButton.setText("Durdur");
    }
    private void fail(long token,String message,Exception error){
        if(!alive(token))return;stopSession();setStatus(message);toast(message);
    }
    private void prepare(String from,String to,long token,Runnable next){
        prepare(from,to,token,next,prefs.getBoolean("wifiOnly",true));
    }
    private void cancelPreparationWait(){
        preparationSerial++;preparationActive=false;
        if(preparationHeartbeat!=null)handler.removeCallbacks(preparationHeartbeat);
        if(preparationDeadline!=null)handler.removeCallbacks(preparationDeadline);
        preparationHeartbeat=null;preparationDeadline=null;
    }
    private void prepare(String from,String to,long token,Runnable next,boolean wifiOnly){
        if(!alive(token))return;
        cancelPreparationWait();packSetup.pauseForConversation();
        final long serial=preparationSerial,started=SystemClock.elapsedRealtime();preparationActive=true;
        final String[] phase={"Seçili çeviri paketleri kontrol ediliyor"};
        preparationHeartbeat=new Runnable(){public void run(){
            if(!alive(token)||!preparationActive||serial!=preparationSerial)return;
            setStatus(phase[0]+" · "+((SystemClock.elapsedRealtime()-started)/1000)+" sn");handler.postDelayed(this,1000);
        }};
        preparationDeadline=()->{
            if(alive(token)&&preparationActive&&serial==preparationSerial){
                engine.cancelPreparation();cancelPreparationWait();preparationFailed(from,to,token,next,wifiOnly,new java.util.concurrent.TimeoutException("Paket hazırlığı 90 saniyede tamamlanmadı."));
            }
        };
        handler.post(preparationHeartbeat);handler.postDelayed(preparationDeadline,90000);
        try{engine.prepare(from,to,wifiOnly,message->{if(alive(token)&&preparationActive&&serial==preparationSerial){phase[0]=message;setStatus(message);}},new TranslationEngine.Callback<Void>(){
            public void success(Void v){if(alive(token)&&preparationActive&&serial==preparationSerial){cancelPreparationWait();next.run();}}
            public void failure(Exception e){if(alive(token)&&preparationActive&&serial==preparationSerial){cancelPreparationWait();preparationFailed(from,to,token,next,wifiOnly,e);}}
        });}catch(Exception error){if(alive(token)&&serial==preparationSerial){cancelPreparationWait();preparationFailed(from,to,token,next,wifiOnly,error);}}
    }
    private void preparationFailed(String from,String to,long token,Runnable next,boolean wifiOnly,Exception error){
        if(!alive(token))return;sessionActive=false;getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        String detail=error==null?"Nedeni bildirilmedi.":error.getClass().getSimpleName()+": "+error.getMessage();
        if(error instanceof com.google.mlkit.common.MlKitException)detail+=" (kod "+((com.google.mlkit.common.MlKitException)error).getErrorCode()+")";
        lastPreparationError=LanguageCatalog.name(from)+" → "+LanguageCatalog.name(to)+" · "+detail;
        setStatus("Çeviri paketi hazır değil. Alınan konuşma/metin korunuyor.");
        new AlertDialog.Builder(this).setTitle("Çeviri paketi hazırlanamadı")
            .setMessage("Konuşma/metin ekranda duruyor. Mikrofonu kullanmak için bu paketi beklemen gerekmiyor.\n\n"+
                LanguageCatalog.name(from)+" → "+LanguageCatalog.name(to)+"\n"+detail+
                "\n\nWi-Fi, boş alan ve Google Play Hizmetlerini kontrol et. İstersen yalnızca seçili dil çiftini mevcut bağlantıyla indirmeyi dene; mobil veri kullanabilir (dil başına yaklaşık 30 MB).")
            .setPositiveButton("Yeniden dene",(d,w)->{if(alive(token))prepare(from,to,token,next,wifiOnly);})
            .setNeutralButton("Bu bağlantıyla indir",(d,w)->{if(alive(token))prepare(from,to,token,next,false);})
            .setNegativeButton("Kapat",(d,w)->packSetup.resumeAfterConversation()).show();
    }
    private void translateCaptured(String value,String from,String to,long token){
        if(!alive(token))return;
        prepare(from,to,token,()->translate(value,from,to,token,true));
    }
    private void submitText(){
        rememberInput();String value=draft.trim();if(value.isEmpty()){toast("Önce bir metin yaz.");return;}
        hideKeyboard();stopSession();long token=gate.current();String from=source,to=target;draftFrom=from;
        prepare(from,to,token,()->translate(value,from,to,token,false));
    }
    private void translate(String value,String from,String to,long token,boolean conversation){
        if(!alive(token))return;setStatus("Çevriliyor · "+LanguageCatalog.name(from)+" → "+LanguageCatalog.name(to));
        engine.translate(value,from,to,new TranslationEngine.Callback<String>(){
            @Override public void success(String result){
                if(!alive(token))return;
                if(result.trim().isEmpty()){fail(token,"Çeviri sonucu boş geldi. Metni kontrol edip tekrar dene.",null);return;}
                translation=result;lastFrom=from;lastTo=to;
                if(output!=null){output.setText(result);output.setTextColor(TEXT);}
                if(translatedLabel!=null)translatedLabel.setText("ÇEVİRİ · "+LanguageCatalog.name(to));
                if(originalLabel!=null)originalLabel.setText("ORİJİNAL · "+LanguageCatalog.name(from));
                lastEntry=prefs.getBoolean("saveHistory",true)?history.add(value,result,from,to):null;
                if(favoriteButton!=null)favoriteButton.setText("☆ Kaydet");
                if(conversation&&mainScroll!=null)mainScroll.post(()->{
                    if(alive(token)&&translatedPanel!=null)mainScroll.smoothScrollTo(0,translatedPanel.getTop());
                });
                Runnable done=()->{
                    if(!alive(token))return;
                    if(conversation&&sessionActive&&prefs.getBoolean("repeat",false)&&foreground){
                        if(prefs.getBoolean("alternate",false))activeSide=1-activeSide;
                        String next=activeSide==0?source:target;
                        setStatus("Yeniden dinlenecek · "+LanguageCatalog.name(next));
                        handler.postDelayed(()->{if(alive(token)&&sessionActive&&foreground)beginListening(token);},850);
                    }else{sessionActive=false;packSetup.resumeAfterConversation();getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);setStatus("Çeviri hazır · "+LanguageCatalog.name(to));}
                };
                if(prefs.getBoolean("autoSpeak",true))speak(result,to,token,done);else done.run();
            }
            @Override public void failure(Exception error){fail(token,"Çeviri yapılamadı. Dil paketlerini kontrol edip yeniden dene.",error);}
        });
    }
    private void startVoice(int side){
        rememberInput();stopSession();hideKeyboard();
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            permissionSide=side;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MICROPHONE_REQUEST);return;
        }
        if(source.equals(target)){toast("Konuşma için iki farklı dil seç.");return;}
        activeSide=side;sessionActive=true;silenceCount=0;long token=gate.current();
        packSetup.pauseForConversation();beginListening(token);
    }
    private Intent recognitionIntent(String from){
        Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,LanguageCatalog.speechTag(from));
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
        return intent;
    }
    private void beginListening(long token){
        if(!alive(token)||!foreground||!sessionActive)return;
        releaseSpeech();String from=activeSide==0?source:target,to=activeSide==0?target:source;
        boolean strict=prefs.getBoolean("strictOffline",false);
        embeddedThisTurn=false;
        if(LanguageCatalog.supportsEmbeddedSpeech(from)&&(from.equals("mk")||from.equals("en")||strict||prefs.getBoolean("preferEmbedded",false)||!SpeechRecognizer.isRecognitionAvailable(this))){
            beginEmbedded(token,from,to);return;
        }
        try{
            if(strict){
                if(Build.VERSION.SDK_INT<31||!SpeechRecognizer.isOnDeviceRecognitionAvailable(this)){
                    fail(token,"Bu telefonda kesin çevrimdışı ses tanıma servisi bulunamadı. Metin çevirisini kullanabilir veya çevrimdışı ses ayarını kapatabilirsin.",null);return;
                }
                speech=SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
            }else speech=SpeechRecognizer.createSpeechRecognizer(this);
            SpeechRecognizer current=speech;
            current.setRecognitionListener(new RecognitionListener(){
                @Override public void onReadyForSpeech(Bundle params){if(alive(token)&&current==speech){setStatus("● Dinleniyor · "+LanguageCatalog.name(from));if(stopButton!=null)stopButton.setText("● Dinleniyor · Durdur");}}
                @Override public void onBeginningOfSpeech(){if(alive(token)&&current==speech)setStatus("● Konuşman alınıyor · "+LanguageCatalog.name(from));}
                @Override public void onRmsChanged(float v){}
                @Override public void onBufferReceived(byte[] b){}
                @Override public void onEndOfSpeech(){if(alive(token)&&current==speech)setStatus("Konuşma çözümleniyor…");}
                @Override public void onPartialResults(Bundle results){
                    if(!alive(token)||current!=speech)return;ArrayList<String> values=results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if(values!=null&&!values.isEmpty()&&input!=null){draftFrom=from;input.setText(values.get(0));if(originalLabel!=null)originalLabel.setText("DUYULAN · "+LanguageCatalog.name(from));}
                }
                @Override public void onResults(Bundle results){
                    if(!alive(token)||current!=speech)return;
                    ArrayList<String> values=results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if(values==null||values.isEmpty()||values.get(0).trim().isEmpty()){onError(SpeechRecognizer.ERROR_NO_MATCH);return;}
                    silenceCount=0;String value=values.get(0).trim();
                    if(value.length()>4000)value=value.substring(0,4000);
                    draft=value;draftFrom=from;if(input!=null)input.setText(value);releaseSpeech();
                    translateCaptured(value,from,to,token);
                }
                @Override public void onError(int code){
                    if(!alive(token)||current!=speech)return;
                    releaseSpeech();
                    if(code!=SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS&&code!=SpeechRecognizer.ERROR_NO_MATCH&&code!=SpeechRecognizer.ERROR_SPEECH_TIMEOUT&&LanguageCatalog.supportsEmbeddedSpeech(from)){
                        beginEmbedded(token,from,to);return;
                    }
                    if((code==SpeechRecognizer.ERROR_NO_MATCH||code==SpeechRecognizer.ERROR_SPEECH_TIMEOUT)&&prefs.getBoolean("repeat",false)&&++silenceCount<3){
                        setStatus("Konuşma duyulmadı · Yeniden dinlenecek.");
                        handler.postDelayed(()->{if(alive(token)&&sessionActive)beginListening(token);},1200);return;
                    }
                    String message;
                    switch(code){
                        case SpeechRecognizer.ERROR_NETWORK:case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:message="Ses tanıma bağlantısı kurulamadı. İnterneti kontrol et veya destek varsa çevrimdışı sesi aç.";break;
                        case SpeechRecognizer.ERROR_NO_MATCH:case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:message="Konuşma duyulmadı. Dil düğmesine dokunup tekrar konuş.";break;
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:message="Mikrofon izni gerekli. Uygulama izinlerinden açabilirsin.";break;
                        case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:message="Bu dil ses tanıma hizmetinde hazır değil. Dil paketini indir veya metin çevirisini kullan.";break;
                        case SpeechRecognizer.ERROR_TOO_MANY_REQUESTS:message="Telefonun ses hizmeti çok sık istek aldı. Biraz bekleyip tekrar dene.";break;
                        case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:message="Mikrofon başka bir işlemde meşgul. Kısa süre sonra tekrar dene.";break;
                        default:message="Ses tanıma tamamlanamadı ("+code+"). Google ses hizmetini ve mikrofonu kontrol et.";
                    }
                    fail(token,message,null);
                }
                @Override public void onEvent(int type,Bundle params){}
            });
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            current.startListening(recognitionIntent(from));setStatus("Mikrofon hazırlanıyor · "+LanguageCatalog.name(from));
            handler.postDelayed(()->{
                if(alive(token)&&current==speech)fail(token,"Ses hizmeti uzun süredir yanıt vermiyor. Düğmeye dokunup yeniden dene.",null);
            },90000);
        }catch(RuntimeException e){
            if(LanguageCatalog.supportsEmbeddedSpeech(from))beginEmbedded(token,from,to);
            else fail(token,"Ses tanıma başlatılamadı. Telefonun ses hizmetini kontrol et.",e);
        }
    }
    private void beginEmbedded(long token,String from,String to){
        if(!alive(token)||!foreground||!sessionActive)return;
        releaseSpeech();embeddedThisTurn=true;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        embeddedSpeech.listen(from,new EmbeddedSpeech.Listener(){
            public void state(String message){if(alive(token)){setStatus(message);if(stopButton!=null)stopButton.setText("Yerel ses · Durdur");}}
            public void result(String value){
                if(!alive(token))return;draft=value.length()>4000?value.substring(0,4000):value;draftFrom=from;
                if(input!=null)input.setText(draft);translateCaptured(draft,from,to,token);
            }
            public void error(String message){fail(token,message,null);}
        });
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==MICROPHONE_REQUEST){int side=permissionSide;permissionSide=-1;
            if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED&&side>=0){if(foreground)startVoice(side);else resumeVoiceSide=side;}
            else new AlertDialog.Builder(this).setTitle("Mikrofon izni gerekli")
                .setMessage("Sesli çeviri için uygulama ayarlarından mikrofon iznini aç. Metin ve fotoğraf çevirisini izinsiz kullanabilirsin.")
                .setNegativeButton("Kapat",null).setPositiveButton("İzinler",(d,w)->openSystem("android.settings.APPLICATION_DETAILS_SETTINGS",Uri.parse("package:"+getPackageName()))).show();
        }
    }
    private void showSpeechHelp(){
        new AlertDialog.Builder(this).setTitle("Ses tanıma hizmeti bulunamadı")
            .setMessage("Google uygulamasını ve Google'ın Konuşma Tanıma ve Sentez hizmetini yükleyip etkinleştir. Metin ve fotoğraf çevirisi ayrı çalışır.")
            .setPositiveButton("Tamam",null).show();
    }
    private void detectLanguage(){
        rememberInput();String value=draft.trim();if(value.length()<3){toast("Dil algılamak için biraz daha uzun bir metin yaz.");return;}
        stopSession();long token=gate.current();setStatus("Metnin dili algılanıyor…");
        LanguageIdentifier identifier=LanguageIdentification.getClient();
        identifier.identifyLanguage(value).addOnSuccessListener(code->{
            if(!alive(token))return;
            if(!languages.contains(code)){setStatus("Dil güvenle algılanamadı veya ücretsiz motorda desteklenmiyor. Kaynak dili kendin seç.");return;}
            source=code;draftFrom=code;saveLanguages();render();setStatus("Algılanan dil · "+LanguageCatalog.name(code));
        }).addOnFailureListener(e->fail(token,"Dil algılanamadı. Kaynak dili kendin seçebilirsin.",e))
            .addOnCompleteListener(task->identifier.close());
    }
    private boolean checkPhotoLanguage(){
        if(!LanguageCatalog.script(source).equals("Unsupported"))return true;
        new AlertDialog.Builder(this).setTitle("Bu alfabe henüz desteklenmiyor")
            .setMessage(LanguageCatalog.name(source)+" için fotoğraftan yazı okuma bu sürümde yok. Bu dili metin veya destekleniyorsa sesle çevirebilirsin.")
            .setPositiveButton("Tamam",null).show();return false;
    }
    private void takePhoto(){
        if(!checkPhotoLanguage())return;rememberInput();stopSession();
        try{
            File dir=new File(getCacheDir(),"photos");if(!dir.exists()&&!dir.mkdirs())throw new IOException("Fotoğraf klasörü açılamadı.");
            File[] old=dir.listFiles();if(old!=null)for(File f:old){if(f.lastModified()<System.currentTimeMillis()-86400000L)f.delete();}
            File file=File.createTempFile("translate-",".jpg",dir);cameraUri=FileProvider.getUriForFile(this,getPackageName()+".files",file);
            Intent intent=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);intent.putExtra(MediaStore.EXTRA_OUTPUT,cameraUri);
            intent.setClipData(ClipData.newRawUri("Fotoğraf",cameraUri));intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION);
            photoSource=source;photoTarget=target;startActivityForResult(intent,CAMERA_RESULT);
        }catch(Exception e){toast("Kamera açılamadı. Galeriden fotoğraf seçebilirsin.");}
    }
    private void pickPhoto(){
        if(!checkPhotoLanguage())return;rememberInput();stopSession();
        photoSource=source;photoTarget=target;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.setType("image/*");intent.addCategory(Intent.CATEGORY_OPENABLE);
        try{startActivityForResult(intent,GALLERY_RESULT);}catch(ActivityNotFoundException e){toast("Fotoğraf seçebilecek uygulama bulunamadı.");}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(result!=RESULT_OK)return;
        if(request==CAMERA_RESULT&&cameraUri!=null)readPhoto(cameraUri);
        if(request==GALLERY_RESULT&&data!=null&&data.getData()!=null)readPhoto(data.getData());
    }
    private void readPhoto(Uri uri){
        stopSession();long token=gate.current();String from=photoSource==null?source:photoSource;
        setStatus("Fotoğraftaki yazılar okunuyor…");
        imageExecutor.execute(()->{
            try{
                Bitmap bitmap=decodeImage(uri);
                handler.post(()->{
                    if(!alive(token)){bitmap.recycle();return;}
                    if(photoPreview!=null&&!photoPreview.isRecycled())photoPreview.recycle();
                    int previewWidth=Math.min(640,bitmap.getWidth());
                    int previewHeight=Math.max(1,Math.round(bitmap.getHeight()*(previewWidth/(float)bitmap.getWidth())));
                    Bitmap preview=Bitmap.createScaledBitmap(bitmap,previewWidth,previewHeight,true);
                    photoPreview=preview==bitmap?bitmap.copy(Bitmap.Config.ARGB_8888,false):preview;
                    TextRecognizer reader;
                    switch(LanguageCatalog.script(from)){
                        case "Chinese":reader=TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());break;
                        case "Japanese":reader=TextRecognition.getClient(new JapaneseTextRecognizerOptions.Builder().build());break;
                        case "Korean":reader=TextRecognition.getClient(new KoreanTextRecognizerOptions.Builder().build());break;
                        case "Devanagari":reader=TextRecognition.getClient(new DevanagariTextRecognizerOptions.Builder().build());break;
                        default:reader=TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                    }
                    reader.process(InputImage.fromBitmap(bitmap,0)).addOnSuccessListener(result->{
                        if(!alive(token))return;
                        String value=result.getText().trim();if(value.isEmpty()){render();setStatus("Yazı bulunamadı. Daha net ve yakın bir fotoğraf dene.");return;}
                        boolean truncated=value.length()>4000;draft=value.substring(0,Math.min(value.length(),4000));
                        source=from;draftFrom=from;target=photoTarget==null?target:photoTarget;saveLanguages();render();
                        setStatus(truncated?"İlk 4000 karakter alındı. Metni kontrol edip Çevir'e dokun.":"Yazı okundu. Metni kontrol edip Çevir'e dokun.");
                    }).addOnFailureListener(e->fail(token,"Fotoğraf okunamadı. Daha net bir görüntü seç.",e))
                        .addOnCompleteListener(task->{reader.close();bitmap.recycle();});
                });
            }catch(Exception|OutOfMemoryError e){handler.post(()->fail(token,"Görüntü açılamadı. Daha küçük bir fotoğraf seç.",null));}
        });
    }
    private Bitmap decodeImage(Uri uri)throws IOException{
        BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;
        try(InputStream in=getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,o);}
        if(o.outWidth<1||o.outHeight<1)throw new IOException("Görüntü geçersiz.");
        o.inSampleSize=1;while(Math.max(o.outWidth,o.outHeight)/o.inSampleSize>2200)o.inSampleSize*=2;
        o.inJustDecodeBounds=false;o.inPreferredConfig=Bitmap.Config.ARGB_8888;Bitmap b;
        try(InputStream in=getContentResolver().openInputStream(uri)){b=BitmapFactory.decodeStream(in,null,o);}
        if(b==null)throw new IOException("Görüntü açılamadı.");
        Matrix matrix=new Matrix();int orientation;
        try(InputStream in=getContentResolver().openInputStream(uri)){
            if(in==null)throw new IOException("Görüntü açılamadı.");
            orientation=new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_NORMAL);
        }
        switch(orientation){
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL:matrix.setScale(-1,1);break;
            case ExifInterface.ORIENTATION_ROTATE_180:matrix.setRotate(180);break;
            case ExifInterface.ORIENTATION_FLIP_VERTICAL:matrix.setScale(1,-1);break;
            case ExifInterface.ORIENTATION_TRANSPOSE:matrix.setRotate(90);matrix.postScale(-1,1);break;
            case ExifInterface.ORIENTATION_ROTATE_90:matrix.setRotate(90);break;
            case ExifInterface.ORIENTATION_TRANSVERSE:matrix.setRotate(270);matrix.postScale(-1,1);break;
            case ExifInterface.ORIENTATION_ROTATE_270:matrix.setRotate(270);break;
            default:break;
        }
        if(!matrix.isIdentity()){Bitmap rotated=Bitmap.createBitmap(b,0,0,b.getWidth(),b.getHeight(),matrix,true);if(rotated!=b)b.recycle();b=rotated;}
        return b;
    }
    private void settings(){
        rememberInput();stopSession();LinearLayout content=vertical();content.setPadding(dp(22),dp(6),dp(22),dp(12));
        full(content,text("Ücretsiz motor · "+languages.size()+" dilde metin çevirisi\nSes desteği, telefonun ses hizmetine bağlıdır.",14,TEXT,false));gap(content,12);
        settingSwitch(content,"Çeviriyi otomatik seslendir","autoSpeak",true);
        settingSwitch(content,"Çeviriden sonra yeniden dinle","repeat",false);
        settingSwitch(content,"Yeniden dinlerken sırayla iki dile geç","alternate",false);
        full(content,text("İki dile sırayla geçiş her çeviriden sonra yönü değiştirir; konuşulan dili kendiliğinden algılamaz. İlk konuşmacının düğmesine bir kez dokunarak başlat.",12,MUTED,false));gap(content,6);
        settingSwitch(content,"Paketleri yalnızca Wi-Fi ile indir","wifiOnly",true);
        settingSwitch(content,"Kesin çevrimdışı ses kullan","strictOffline",false);
        settingSwitch(content,"Konuşmayı her zaman telefonda çözümle","preferEmbedded",false);
        full(content,text("İngilizce ve Makedonca dahil yerel konuşma modeli uygulamaya dahildir. Telefonun ses tanıma hizmeti hata verirse desteklenen dillerde bu motor açılır. Kısa cümlelerden sonra durakla; çözümleme telefona göre birkaç saniye sürebilir.",12,MUTED,false));gap(content,8);
        full(content,button("Tüm dil ve ses desteğini hazırla",false,()->packSetup.showOffer()));gap(content,8);
        full(content,text("Yerel konuşma motoru Esperanto ve İrlandaca hariç metin çevirisi dillerini destekler. Sesli okuma ayrı bir motordur; çok dilli ses kurulumu için Android onayı gerekebilir.",12,MUTED,false));gap(content,6);
        settingSwitch(content,"Çevirileri geçmişe kaydet","saveHistory",true);gap(content,12);
        full(content,button("Telefon ve ses desteğini kontrol et",false,this::diagnostics));gap(content,8);
        full(content,button("Seslendirme ayarları",false,()->openSystem("com.android.settings.TTS_SETTINGS",null)));gap(content,8);
        full(content,button("Ses tanıma ayarları",false,()->openSystem(android.provider.Settings.ACTION_VOICE_INPUT_SETTINGS,null)));gap(content,12);
        full(content,button("Çeviri hakkında",false,()->openSystem(Intent.ACTION_VIEW,Uri.parse("https://cloud.google.com/translate/"))));gap(content,12);
        full(content,text("Metin çevirisi, fotoğraftan okuma ve yerel konuşma modeli cihazda çalışır. Varsayılan Android ses tanıma hizmeti sesi internet üzerinden işleyebilir. API anahtarı veya abonelik gerekmez.\n\nHızır Bey Tercüman 0.2.1 · Test sürümü\nYerel ses: Whisper / whisper.cpp (MIT). Çok dilli sesli okuma: ayrı ve isteğe bağlı eSpeak NG uygulaması (GPL-3.0+). Google Translate modelleri ile otomatik çeviri (Google ML Kit). Fotoğraftan okuma: Google ML Kit.\n\nÇeviriler otomatik oluşturulur. Google; çevirilerin doğruluğu, güvenilirliği, ticari elverişliliği, belirli bir amaca uygunluğu ve hak ihlali içermemesi konusunda açık veya örtülü garanti vermez.",12,MUTED,false));
        ScrollView scroll=new ScrollView(this);scroll.addView(content);
        new AlertDialog.Builder(this).setTitle("Tercihler").setView(scroll).setPositiveButton("Tamam",(d,w)->render()).show();
    }
    private void settingSwitch(LinearLayout parent,String label,String key,boolean fallback){
        Switch s=new Switch(this);s.setText(label);s.setTextSize(14);s.setTextColor(TEXT);s.setPadding(0,dp(8),0,dp(8));
        s.setChecked(prefs.getBoolean(key,fallback));s.setOnCheckedChangeListener((v,value)->prefs.edit().putBoolean(key,value).apply());full(parent,s);
    }
    private void openSystem(String action,Uri uri){
        try{Intent i=new Intent(action);if(uri!=null)i.setData(uri);startActivity(i);}
        catch(ActivityNotFoundException e){toast("Bu telefonda ilgili ayar ekranı bulunamadı.");}
    }
    private void diagnostics(){
        String device=Build.MANUFACTURER+" "+Build.MODEL+"\nAndroid "+Build.VERSION.RELEASE+" (API "+Build.VERSION.SDK_INT+")\n\n";
        device+="Ses tanıma servisi: "+(SpeechRecognizer.isRecognitionAvailable(this)?"Var":"Yok")+"\n";
        boolean onDevice=Build.VERSION.SDK_INT>=31&&SpeechRecognizer.isOnDeviceRecognitionAvailable(this);
        device+="Cihaz içi ses servisi: "+(onDevice?"Var; dil desteği ayrıca kontrol edilmeli":"Bulunamadı")+"\n";
        device+="Seslendirme: "+(ttsReady?"Hazır":"Hazır değil")+"\n\n";
        if(ttsReady){for(String code:new String[]{source,target}){
            int support=tts.isLanguageAvailable(Locale.forLanguageTag(LanguageCatalog.speechTag(code)));
            device+=LanguageCatalog.name(code)+" seslendirme: "+(support>=0?"Destekleniyor":"Paket eksik / desteklenmiyor")+"\n";
        }}
        device+="\nMetin çevirisi: "+languages.size()+" dil\nFotoğraf alfabeleri: Latin, Çince, Japonca, Korece, Devanagari\n\nSes tanıma ve seslendirme dil listeleri metin çevirisi listesinden farklı olabilir.";
        device+="\n\nUygulama: 0.2.1\nSon paket hatası: "+(lastPreparationError.isEmpty()?"Yok":lastPreparationError);
        final String summary=device;
        AlertDialog d=new AlertDialog.Builder(this).setTitle("Telefon desteği").setMessage(device)
            .setNeutralButton("Kopyala",(dialog,w)->copy(summary)).setPositiveButton("Tamam",null).create();d.show();
    }
    private void modelDialog(){
        rememberInput();stopSession();long token=gate.current();setStatus("İndirilmiş dil paketleri kontrol ediliyor…");
        RemoteModelManager.getInstance().getDownloadedModels(TranslateRemoteModel.class)
            .addOnSuccessListener(models->{
                if(!alive(token))return;ArrayList<String> codes=new ArrayList<>();for(TranslateRemoteModel m:models)codes.add(m.getLanguage());
                codes.sort((a,b)->LanguageCatalog.name(a).compareTo(LanguageCatalog.name(b)));
                StringBuilder message=new StringBuilder("Seçili çift: "+LanguageCatalog.name(source)+" ↔ "+LanguageCatalog.name(target)+"\n\nİndirilmiş paketler:\n");
                if(codes.isEmpty())message.append("Henüz paket yok.");else for(String c:codes)message.append("• ").append(LanguageCatalog.name(c)).append("\n");
                message.append("\nPaketler ilk indirmeden sonra internetsiz metin çevirisi sağlar. Ses paketleri ayrıdır.");
                setStatus("Dil paketleri kontrol edildi.");
                new AlertDialog.Builder(this).setTitle("Dil paketleri").setMessage(message)
                    .setPositiveButton("Seçili çifti indir",(d,w)->{
                        long current=gate.renew();String a=source,b=target;
                        prepare(a,b,current,()->prepare(b,a,current,()->{setStatus("İki yönde çeviri paketleri hazır.");toast("Dil paketleri hazır. Metin çevirisini internetsiz kullanabilirsin.");}));
                    }).setNeutralButton("Paket sil",(d,w)->deleteModel(codes)).setNegativeButton("Kapat",null).show();
            }).addOnFailureListener(e->fail(token,"Dil paketleri okunamadı. Google Play Hizmetlerini kontrol et.",e));
    }
    private void deleteModel(ArrayList<String> codes){
        if(codes.isEmpty()){toast("Silinecek dil paketi yok.");return;}
        String[] names=new String[codes.size()];for(int i=0;i<codes.size();i++)names[i]=LanguageCatalog.name(codes.get(i));
        new AlertDialog.Builder(this).setTitle("Silinecek paketi seç").setItems(names,(d,which)->{
            String code=codes.get(which);new AlertDialog.Builder(this).setTitle(LanguageCatalog.name(code)+" paketi silinsin mi?")
                .setMessage("Bu dilde metin çevirisi için paketi yeniden indirmen gerekecek.")
                .setNegativeButton("Vazgeç",null).setPositiveButton("Sil",(dialog,w)->{
                    stopSession();engine.close();engine=new LocalTranslationEngine();
                    RemoteModelManager.getInstance().deleteDownloadedModel(new TranslateRemoteModel.Builder(code).build())
                        .addOnSuccessListener(v->toast("Dil paketi silindi.")).addOnFailureListener(e->toast("Paket silinemedi. Uygulamayı yeniden açıp dene."));
                }).show();
        }).setNegativeButton("Kapat",null).show();
    }
}
