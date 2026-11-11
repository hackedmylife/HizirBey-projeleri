# Hızır Bey Tercüman 0.3.0

Ücretsiz Android çevirmeni. Android 8.0+, ARM64/ARMv7. Samsung S20 FE ve Redmi Note 10 Pro üzerinde fiziksel test henüz yapılmadı. Gerçek doğrulama kapsamı DOGRULAMA-0.3.0.txt dosyasında yazılıdır.

## Bu sürümde

- Konuşma tanıma artık desteklenen dillerde her zaman APK içindeki Whisper motorunu kullanır. Android/Google ses tanıma hizmetine yönlendirme yoktur.
- Dil seçimi veya ⇄ ile dil değiştirildiğinde, başlatılmış konuşma yeni kaynak dilde yeniden dinlenir. Eski ekranın gecikmiş seçim olayı ve iptal edilmiş ses sonucu reddedilir.
- Dinleme düğmesi yalnızca mikrofon gerçekten açıldığında vurgulanır. Ses seviyesi göstergesi gerçek PCM düzeyini gösterir; cihazın mikrofon açması ile konuşmayı duyması ayrı ayrı kontrol edilir.
- Mikrofon 16 kHz, 48 kHz ve 44,1 kHz ile denenir. Yüksek örnek hızları 16 kHz modele dönüştürülür; parçalı okumalar tam ses çerçevesi olana kadar biriktirilir. Veri gelmemesi ve çözümleme süresi sınırlandırılmıştır.
- İngilizce için daha küçük tiny.en Q5 modeli, diğer desteklenen diller için çok dilli base Q5 modeli kullanılır. Modeller uygulamaya dahildir; ayrı konuşma paketi indirmek gerekmez.
- Makedonca Kiril yazısını okumak için Tesseract modeli APK'ya eklendi. Latin, Çince, Japonca, Korece ve Devanagari okumaları da cihazda çalışır.
- İnternet yokken eksik çeviri paketi için indirme beklenmez; hangi paketin eksik olduğu açıklanır. Önceden indirilen modeller çevrimdışı kullanılmaya devam eder.
- eSpeak'in eski setLanguage arayüzü, yalnızca bu bilinen çevrimdışı motorda kullanılabilir. İnternet gerektiren sesler seçilmez.

## Kurulum

1. Yeni APK'yı mevcut uygulamanın üzerine kur; kaldırma. Aynı özel test imzası korunur.
2. İlk açılışta **Tüm dil ve ses desteğini hazırla → Tümünü hazırla** seçilebilir. Daha önce bu soruyu geçtiysen Ayarlar'dan aynı ekranı aç.
3. Metin çevirisi 59 dili destekler. İngilizce ortak dil olduğu için 58 paket indirilir. Tüm paketler yaklaşık 2 GB boş alan/internet gerektirebilir; boyut değişir. Kurulum sırasında internet gerekir. Uygulama açıkken sıra sürer; sonraki açılışta eksikler tamamlanır.
4. İsteğe bağlı ücretsiz eSpeak NG tüm seslerini ayrı bir uygulamada getirir. Android'in uygulama yükleme onayı gerekir; kurulumdan sonra otomatik açılan ses verisi hazırlama ekranı kapanana kadar bekle. İlk kurulumda bütün diller birlikte hazırlanır. Doğal seslere göre daha robotiktir.
5. Mikrofon iznini ver. Konuşan kişinin dil düğmesine dokun. Ses seviyesi çubuğu hareket etmeli. Kısa bir cümle söyle, ardından yaklaşık bir saniye durakla. En çok 20 saniyelik parçalar alınır; çevrilip seslendirilir.
6. Varsayılan olarak çeviriden sonra aynı yönde dinleme yeniden başlar. Ayarlar'dan kapatılabilir. İstersen sırayla iki dile geçiş açılabilir; bu, otomatik konuşma dili tespiti değildir.
7. Fotoğraf sekmesinde kaynak dili seçip Kamera veya Fotoğraf seç kullan. Okunan metni kontrol ettikten sonra **Google ile çevir** düğmesine dokun. Bu düğme cihazdaki ML Kit motorunu çalıştırır.

İlk model ve ses kurulumu tamamlandıktan sonra uçak modunda konuşma, indirilmiş dil çiftlerinde metin çevirisi ve desteklenen fotoğraf alfabeleri kullanılabilir. Ses tanıma, metin çevirisi ve seslendirme üç ayrı bileşendir. Yerel modelin dili içermesi her aksanı kusursuz anlaması demek değildir. Çözümleme süresi ve kalite telefona, konuşma uzunluğuna ve gürültüye bağlıdır.

## Sınırlar

- 59 metin dilinin Esperanto ve İrlandaca hariç 57'sinde yerel konuşma modeli kullanılabilir. Bu iki dilde metin çevrilebilir fakat ses tanıma başlatılmaz.
- Sesli okuma için istenen dili destekleyen kurulu çevrimdışı ses motoru gerekir. eSpeak isteğe bağlı tek kurulum seçeneğidir. Metin desteği bütün doğal Android seslerinin var olduğu anlamına gelmez.
- Fotoğraf okuma Makedonca dışındaki Kiril dilleri, Arapça ve listedeki diğer desteklenmeyen alfabelerde sunulmaz. Bu sınırlama metin/ses desteğinden ayrıdır.
- Telefon veya WhatsApp araması yakalama, başka uygulama videosuna dublaj, canlı görüntülü görüşme çevirisi, 140 dilde çevrimdışı destek ve otomatik uygulama güncellemesi yoktur.
- Metin en fazla 4000 karakter; yerel geçmiş en fazla 200 çeviri. Kopyalama, yapıştırma, favori ve geçmişi silme vardır.
- Ham ses dosyaya yazılmaz, RAM'de işlenir. Arka plana geçilince mikrofon kapatılır. Geçmiş özel uygulama alanındadır; bulut yedeği ve cihaz aktarımı kapalıdır.
- Ücretli API kullanılmaz. İleride bir çeviri sağlayıcısı TranslationEngine üzerinden eklenebilir.

## Derleme ve yedek

JDK 17, Android SDK 35, Build Tools 34, NDK 25.2.9519653, CMake 3.22.1 ve Gradle 8.9 gerekir. ANDROID_HOME veya local.properties içindeki sdk.dir ayarlanmalıdır.

```sh
python3 prepare_dependencies.py
bash gradlew assembleDebug testDebugUnitTest lintDebug
```

Windows'ta python ve gradlew.bat kullanılır. APK: app/build/outputs/apk/debug/app-debug.apk.

Android cihaz testleri app/src/androidTest altındadır. Uçak modu açılmış, mikrofon izni verilmiş ve eSpeak kurulmuş Android test cihazı gerekir. Emülatör için -PtestAbi=x86_64 kullanılabilir. Teslim APK'sı bu bayrak olmadan ARM64/ARMv7 olarak derlenmelidir.

Özel kaynak ZIP'i, önceki APK'nın üzerine güncelleme yapabilmek için signing/hizirbey-test.keystore içerir. Bu mağaza/üretim anahtarı değildir. Genel GitHub yedeği imza anahtarını, büyük modelleri ve üçüncü taraf kaynak ağacını içermez. prepare_dependencies.py sabit SHA-256 ile model ve whisper.cpp kaynaklarını geri getirir. Orijinal anahtar yoksa yeni yerel test anahtarı üretir; yeni anahtarla eski uygulamanın üzerine kurulamaz. Bunun için özel ZIP'teki anahtarı kullan. Hiçbir API anahtarı veya token paketlenmez.

## Kaynaklar ve lisanslar

- whisper.cpp v1.7.6 (MIT): https://github.com/ggml-org/whisper.cpp/tree/v1.7.6
- Whisper model (MIT): https://github.com/openai/whisper
- Model: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin
- İngilizce modeli: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin
- Makedonca fotoğraf modeli (Apache-2.0): https://github.com/tesseract-ocr/tessdata_fast
- Android Tesseract bağlayıcısı (Apache-2.0): https://github.com/adaptech-cz/Tesseract4Android
- eSpeak NG, ayrı uygulama (GPL-3.0+): https://github.com/espeak-ng/espeak-ng
- eSpeak APK ve karşılık gelen kaynak: https://f-droid.org/packages/com.reecedunn.espeak/
- ML Kit: https://developers.google.com/ml-kit/language/translation/android
- OCR: https://developers.google.com/ml-kit/vision/text-recognition/v2/android
- Android mikrofon API: https://developer.android.com/reference/android/media/AudioRecord
- Çeviri hakkında: https://cloud.google.com/translate/
- Atıf koşulları: https://developers.google.com/ml-kit/language/translation/translation-terms

Google Translate ve Google logosu Google LLC'nin markalarıdır. Uygulama Google tarafından onaylanmış veya Google ile bağlantılı değildir. Atıf rozeti özgün dosyadır; SHA-256: `1ce4cf9db4cd6c8ae6f6d49542264f5334f40ac79139d51c145a4e039d26323d`. Özgün dağıtım: https://docs.cloud.google.com/static/translate/images/google-translate-attribution.zip içindeki png/color-regular.png. Önceki sürümde bunun aynı baytlı kopyası https://huggingface.co/datasets/superlinked/sie-task-evidence/resolve/main/translation/wmt24pp-study-2026-10/assets/powered-by-google-translate.png adresinden alınmıştır. Marka hakları proje kodunun lisansına dahil değildir.

Çeviriler otomatik oluşturulur. Google; çevirilerin doğruluğu, güvenilirliği, ticari elverişliliği, belirli bir amaca uygunluğu ve hak ihlali içermemesi konusunda açık veya örtülü garanti vermez.
