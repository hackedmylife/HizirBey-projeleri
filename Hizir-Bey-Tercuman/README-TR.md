# Hızır Bey Tercüman 0.5.2

Ücretsiz Android çevirmeni. Android 8.0+, ARM64/ARMv7. Samsung S20 FE ve Redmi Note 10 Pro üzerinde fiziksel test henüz yapılmadı. Gerçek doğrulama kapsamı DOGRULAMA-0.5.2.txt dosyasında yazılıdır.

## Bu sürümde

0.5.2: Hızlı modda ses kalitesi düzeltmesi.

- Hızlı diyalog seçeneğinin eSpeak'i ilk sıraya alması kaldırıldı. Yüklü ve çevrimdışı kullanılabilen cihaz sesleri önce değerlendirilir; aynı dilde kalite puanı, bölge uyumu ve ancak eşitlik halinde gecikme dikkate alınır. Ağ gerektiren veya paketi indirilmemiş sesler seçilmez.
- Google/Samsung gibi kurulu cihaz motorunun uygun çevrimdışı sesi varsa eSpeak'ten önce kullanılır. eSpeak, ses kalitesini yüksek bildirse bile diğer uygun cihaz motorunun önüne geçmez. Bu sıralama her dilde doğal bir ses paketinin var olduğu anlamına gelmez; yalnızca eSpeak destekliyorsa temel robotik yedek korunur ve ekranda belirtilir.
- Konuşma hızı ve perde normal değere (1,0) alınır. Hızlı modun ASR, kısa işlem penceresi, Groq ve kısa ses parçaları korunur; hızlı diyaloğu kapatmak gerekmez. Gerçek ses kalitesi ve ilk ses gecikmesi, telefondaki motor/pakete bağlıdır.
- Ayarlar → **Cihazın ses paketlerini hazırla** kurulu Google/Samsung vb. motorların Android ses verisi ekranını açar. İlk paket indirme internet gerektirebilir; indirilmiş uygun ses daha sonra çevrimdışı seçilir. İşletim sisteminin bu ekranı ve desteklenen dil listesi uygulama tarafından kontrol edilemez. Her dil için doğal ses garantisi yoktur.
- Telefon ve ses desteğini kontrol et ekranı artık kullanılan motoru, ses kimliğini, kalite puanını ve normal hız/perde ayarını gösterir. Motor değiştirilip uygulamaya dönüldüğünde yeni motor da değerlendirilir.

0.5.1'den korunan hız ve Bluetooth özellikleri:

- Kulaklık için ilk görünen aygıt alınmaz: A2DP/LE/kablolu/USB medya çıkışları seçilir; Bluetooth arama (SCO) kanalı medya sesi yerine kullanılmaz. Android'in değiştirdiği çıkış kimlikleri, hâlâ özel bir medya kulaklığı etkinse hata sayılmaz. İstenen özel çıkış uygulanmazsa yalnızca sessiz doğrulama sırasında sistemin medya yolu denenir; gerçek çıkış kulaklık değilse konuşma oynatılmaz. Çıkış kaybında ses kesilir. Donanım ve Bluetooth ayarındaki **Medya sesi** desteği gerekir.
- **Hızlı diyalog modu** varsayılan açıktır. Aynı çok dilli Base modeli İngilizce/Türkçe/Makedonca geçişlerinde korunur ve konuşma kaydı sürerken hazırlanır. Kısa ses parçaları tam 30 saniyelik pencere yerine en az 768 encoder adımlı (15,36 saniyelik) pencereyle çözülür; uzun parçalar için sınır modele göre büyütülür. Mikrofona otomatik kapanma eklenmedi: Bitir ve çevir kontrolü aynıdır.
- Hızlı modda ilk kısa cümle/160 karakterlik bölüm seslendirilir, sonra kalan bölümler sırayla devam eder. İlk ses için bütün uzun metnin WAV dosyası beklenmez. Ses motoru seçimi 0.5.2 kalite politikasına göre yapılır; eSpeak önceliği kaldırılmıştır. Yeniden dinleme aralığı 850 ms yerine 250 ms'dir. Hızlı mod kapatılınca tam ses penceresi ve normal uzun seslendirme kullanılır.
- Çok küçük Tiny modeli Türkçe/Makedonca sentetik ses denemelerinde tekrarlara girdiği için bu dağıtıma alınmadı. Base modeli korunur; bu seçim bütün kayıtların doğru anlaşılacağını garanti etmez.
- **Groq ile ses tanıma** ayrı ve varsayılan kapalı bir tercihtir. Açıkken dinleme sırasındaki konuşma parçaları Groq'a gönderilir. Yerel Silero denetimi ses içermeyen parçaları elemeden gönderim yapılmaz. Hızlı modda whisper-large-v3-turbo, normal modda whisper-large-v3 kullanılır. Ağ/kota/hata durumunda yerel modele dönülür; başarısız istekten sonra 30 saniye boyunca yeni ağ denemesi yapılmaz. Durdur, sıradaki gönderimi iptal eder.
- Groq metin ve ses seçenekleri ayrı ayrı açılır; her ikisi de kapalıyken konuşma/çeviri/seslendirme çevrimdışıdır (metin paketleri önceden indirilmiş olmalı). Mevcut Groq metin tercihi, güncelleme sonrası ses gönderimini kendiliğinden açmaz. Anahtarı silmek her iki tercihi kapatır. Gerçek API anahtarı ile bu sürüm test edilmedi; ücretsiz hesap kotası ve ağ gecikmesi değişebilir, uygulama hesap planını doğrulayamaz.
- Hızlı konuşma çevirilerinde Groq gpt-oss-20b ve daha kısa yanıt bekleme sınırı kullanılır. Metin ağ hatası sonrası 30 saniye boyunca tekrar ağ beklenmez; yerel motor kullanılır. Fotoğraf/normal metin yollarında gpt-oss-120b korunur. Başka ücretli sağlayıcıya geçiş yapılmaz.
- **Ayarlar → Ses çıkışlarını dene** kulaklık ve telefon hoparlörünü çevirisiz sınar. **Telefon ve ses desteğini kontrol et** aktif medya/arama aygıtını ve son uygulama aşaması sürelerini gösterir. Bluetooth'un fiziksel ses gecikmesi bu sürelerle ölçülmez.

0.5.0'dan korunan fotoğraf özellikleri:

- Makedonca OCR, gömülü tessdata_best LSTM modeliyle çalışır. Fotoğrafı seçince yazı alanı parmakla çerçevelenir; Tümü ile bütün görüntü seçilebilir. Seçili alan büyütülür; fotoğrafın özgün ışık/renk yapısı korunur. Küçük gri etiketlerde kontrastı bozan yapay beyaz kenar eklenmez. Düşük güvenli okuma ayrıca belirtilir. Latin harfleri Kiril'e tahmini olarak değiştiren bir filtre yoktur.
- **Resim üzerinde çevir** metin alanlarını yerel çeviri motoruyla çevirip ilgili alanların üzerine yerleştirir. Fotoğraf/çeviri arasında geçiş ve tam ekranda iki parmakla yakınlaştırma vardır. **Okunan alanları düzelt** ile bir alanın OCR metni düzeltilip yeniden çevrilebilir. Her alan en fazla 4000 karakter; resim toplamı 24000 karakter/150 alan. Daha uzun belgeler parça parça seçilmelidir. Arka plan alan kenarlarının rengiyle örtülür; karmaşık dokuyu, yazı tipini veya belge düzenini birebir yeniden üretme garantisi yoktur. Canlı kamera videosu değil, çekilmiş/seçilmiş fotoğraf kullanılır. Çevrilmiş resim oturum belleğinde kalır; uygulama yeniden açılınca fotoğraf tekrar seçilir.
- Ayarlar'daki **Kulaklıkla karşılıklı konuşma** seçeneği Konuşma sekmesinde geçerlidir. Dil çiftinin biri Türkçe olmalıdır: Türkçe çeviri kulaklığa, diğer dil telefonun dahili hoparlörüne gönderilir. Mikrofon varsayılan olarak telefondan alınır; bu tercih kapatılabilir. Ses önce çevrimdışı TTS ile özel geçici WAV dosyasına hazırlanır, sonra yalnızca uygulamanın AudioTrack çıkışı seçilir. Global hoparlör/arama modu değiştirilmez.
- Gerçek ses çıkışı sessiz bir başlangıç sırasında doğrulanır. Kulaklık yoksa, Android istenen çıkışı uygulamazsa veya çıkış değişirse seslendirme durur; başka çıkışa bilerek devam edilmez. Bluetooth/kablolu/USB yönlendirme telefonun ses politikalarına bağlıdır; gerçek iki telefonda doğrulama gerekir. Donanım değişikliğinin algılanma süresi Android'e bağlıdır, mutlak ses sızıntısı garantisi verilemez.
- Varsayılan çalışma **çevrimdışıdır**. Groq metin seçeneği yalnızca açıkken ve anahtar kaydedildiğinde çevrilecek metni gönderir. Fotoğraf dosyası gönderilmez; çıkarılan metin gönderilebilir. Yeni ses tercihi ayrıca açılırsa kısa konuşma parçaları da gönderilir. Anahtar Android Keystore AES/GCM ile şifrelenir. Ücretsiz hesabın kotası sınırlıdır; ücret/hesap sınırları kullanıcı hesabına bağlıdır. Anahtar, APK'ya veya kaynak yedeğine eklenmez.
- Groq normal metin/fotoğraf için openai/gpt-oss-120b, hızlı konuşma metni için openai/gpt-oss-20b kullanır. Başarısız/kota/bağlantı durumunda yerel motor denenir. Yerel dil paketi yoksa internet açıkken indirme gerekebilir. Başka ücretli servise otomatik geçiş yoktur. Kaydedilmiş anahtarın ücretli bir Groq hesabına ait olup olmadığı uygulama tarafından belirlenemez; hesap limitleri Groq konsolundan yönetilmelidir.
- **Bitir ve çevir** kaydı tamamlar; **Durdur** kayıt/çözümleme/çeviri/seslendirmeyi iptal eder ve otomatik tekrar başlamasını önler. Sonradan gelen eski sonuçlar gösterilmez. Silero konuşma etkinliği filtresi korunur; gerçek konuşmadaki “you” gibi kelimeler körlemesine silinmez.

Önceki sürümden korunan özellikler:

- Konuşma tanıma artık desteklenen dillerde her zaman APK içindeki Whisper motorunu kullanır. Android/Google ses tanıma hizmetine yönlendirme yoktur.
- Dil seçimi veya ⇄ ile dil değiştirildiğinde, başlatılmış konuşma yeni kaynak dilde yeniden dinlenir. Eski ekranın gecikmiş seçim olayı ve iptal edilmiş ses sonucu reddedilir.
- Dinleme düğmesi yalnızca mikrofon gerçekten açıldığında vurgulanır. Ses seviyesi göstergesi gerçek PCM düzeyini gösterir; cihazın mikrofon açması ile konuşmayı duyması ayrı ayrı kontrol edilir.
- Mikrofon 16 kHz, 48 kHz ve 44,1 kHz ile denenir. Yüksek örnek hızları 16 kHz modele dönüştürülür; parçalı okumalar tam ses çerçevesi olana kadar biriktirilir. Veri gelmemesi ve çözümleme süresi sınırlandırılmıştır.
- Desteklenen bütün dillerde tek, çok dilli Base Q5 modeli kullanılır; dil değişiminde model yeniden yüklenmez. Modeller uygulamaya dahildir; ayrı konuşma paketi indirmek gerekmez.
- Makedonca Kiril yazısını okumak için Tesseract modeli APK'ya eklendi. Latin, Çince, Japonca, Korece ve Devanagari okumaları da cihazda çalışır.
- İnternet yokken eksik çeviri paketi için indirme beklenmez; hangi paketin eksik olduğu açıklanır. Önceden indirilen modeller çevrimdışı kullanılmaya devam eder.
- eSpeak'in eski setLanguage arayüzü, yalnızca bu bilinen çevrimdışı motorda kullanılabilir. İnternet gerektiren sesler seçilmez.

## Kurulum

1. Yeni APK'yı mevcut uygulamanın üzerine kur; kaldırma. Aynı özel test imzası korunur.
2. İlk açılışta **Tüm dil ve ses desteğini hazırla → Tümünü hazırla** seçilebilir. Daha önce bu soruyu geçtiysen Ayarlar'dan aynı ekranı aç.
3. Metin çevirisi 59 dili destekler. İngilizce ortak dil olduğu için 58 paket indirilir. Tüm paketler yaklaşık 2 GB boş alan/internet gerektirebilir; boyut değişir. Kurulum sırasında internet gerekir. Uygulama açıkken sıra sürer; sonraki açılışta eksikler tamamlanır.
4. İsteğe bağlı ücretsiz eSpeak NG tüm seslerini ayrı bir uygulamada getirir. Android'in uygulama yükleme onayı gerekir; kurulumdan sonra otomatik açılan ses verisi hazırlama ekranı kapanana kadar bekle. İlk kurulumda bütün diller birlikte hazırlanır. Doğal seslere göre daha robotiktir.
5. Mikrofon iznini ver. Konuşan kişinin dil düğmesine dokun. Ses seviyesi çubuğu hareket etmeli. Kısa bir cümle söyle, ardından yaklaşık bir saniye durakla. Sen **Bitir ve çevir** seçeneğine basana kadar mikrofon açık kalır. Hazır olan metin konuşurken görünür; Bitir son parçayı tamamlayıp bütün metni çevirir.
6. **Durdur** dinlemeyi, bekleyen çeviriyi ve seslendirmeyi keser. Yeniden başlatmak için dil düğmesine dokun. Varsayılan olarak çeviriden sonra aynı yönde dinleme yeniden başlar. Ayarlar'dan kapatılabilir. İstersen sırayla iki dile geçiş açılabilir; bu, otomatik konuşma dili tespiti değildir.
7. Fotoğraf sekmesinde kaynak/ hedef dili seç, Kamera veya Fotoğraf seç kullan, yazı alanını çerçevele ve Seçili alanı oku'ya bas. Küçük bir tabela için yalnız yazıyı seçmek doğruluğu artırır. Metin sonucu için **Metni çevir**, fotoğraf üstündeki sonuç için **Resim üzerinde çevir** seç. Orijinali göster/Çevrilmiş resmi göster ile karşılaştır. Resme dokunup tam ekranda yakınlaştır.
8. Kulaklık için Ayarlar → Kulaklıkla karşılıklı konuşma'yı aç, otomatik seslendirmeyi açık tut, Türkçe ve karşı tarafın dilini seç. Önce kısa bir cümleyle iki yönü dene. Telefon yönlendirmeyi reddederse normal ses modunu veya farklı kulaklığı dene.
9. Çevrimiçi ses tanıma için Ayarlar → Groq internet desteği → mevcut anahtarını kullan veya gir → Groq ile ses tanıma seçeneğini aç → Kaydet. Sesin internete gönderileceğini onaylayan bu tercih ayrıca seçilmelidir. Groq metin seçeneği bağımsızdır; iki seçenek de kapalıyken yerel motor kullanılır. Anahtarı sil düğmesi internet desteğini kapatır. Gerçek anahtarla çevrimiçi kalite testi bu dağıtım hazırlanırken yapılmamıştır.

İlk model ve ses kurulumu tamamlandıktan sonra uçak modunda konuşma, indirilmiş dil çiftlerinde metin çevirisi ve desteklenen fotoğraf alfabeleri kullanılabilir. Ses tanıma, metin çevirisi ve seslendirme üç ayrı bileşendir. Yerel modelin dili içermesi her aksanı kusursuz anlaması demek değildir. Çözümleme süresi ve kalite telefona, konuşma uzunluğuna ve gürültüye bağlıdır.

## Sınırlar

- 59 metin dilinin Esperanto ve İrlandaca hariç 57'sinde yerel konuşma modeli kullanılabilir. Bu iki dilde metin çevrilebilir fakat ses tanıma başlatılmaz.
- Sesli okuma için istenen dili destekleyen kurulu çevrimdışı ses motoru gerekir. eSpeak isteğe bağlı tek kurulum seçeneğidir. Metin desteği bütün doğal Android seslerinin var olduğu anlamına gelmez.
- Fotoğraf okuma Makedonca dışındaki Kiril dilleri, Arapça ve listedeki diğer desteklenmeyen alfabelerde sunulmaz. Bu sınırlama metin/ses desteğinden ayrıdır.
- Telefon veya WhatsApp araması yakalama, başka uygulama videosuna dublaj, canlı görüntülü görüşme çevirisi, 140 dilde çevrimdışı destek ve otomatik uygulama güncellemesi yoktur.
- Metin en fazla 4000 karakter; yerel geçmiş en fazla 200 çeviri. Kopyalama, yapıştırma, favori ve geçmişi silme vardır.
- Ham ses dosyaya yazılmaz, RAM'de işlenir. Arka plana geçilince mikrofon kapatılır. Geçmiş özel uygulama alanındadır; bulut yedeği ve cihaz aktarımı kapalıdır.
- Varsayılan yerel kullanımda ücretli API/abonelik gerekmez. İsteğe bağlı Groq için kendi anahtarın gerekir; hesabının ücretsiz kotasını kontrol et. Yandex bu sürüme eklenmedi.

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
- Silero VAD (MIT): https://github.com/snakers4/silero-vad
- Silero v5.1.2 GGML modeli: https://huggingface.co/ggml-org/whisper-vad
- Whisper model (MIT): https://github.com/openai/whisper
- Model: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin
- Makedonca fotoğraf modeli (Apache-2.0): https://github.com/tesseract-ocr/tessdata_best
- Android Tesseract bağlayıcısı (Apache-2.0): https://github.com/adaptech-cz/Tesseract4Android
- eSpeak NG, ayrı uygulama (GPL-3.0+): https://github.com/espeak-ng/espeak-ng
- eSpeak APK ve karşılık gelen kaynak: https://f-droid.org/packages/com.reecedunn.espeak/
- ML Kit: https://developers.google.com/ml-kit/language/translation/android
- OCR: https://developers.google.com/ml-kit/vision/text-recognition/v2/android
- Android mikrofon API: https://developer.android.com/reference/android/media/AudioRecord
- Groq API ve model belgeleri: https://console.groq.com/docs/speech-to-text , https://console.groq.com/docs/speech-to-text , https://console.groq.com/docs/api-reference , https://console.groq.com/docs/model/openai/gpt-oss-120b
- Groq limitleri: https://console.groq.com/docs/rate-limits
- Android AudioTrack: https://developer.android.com/reference/android/media/AudioTrack
- Çeviri hakkında: https://cloud.google.com/translate/
- Atıf koşulları: https://developers.google.com/ml-kit/language/translation/translation-terms

Google Translate ve Google logosu Google LLC'nin markalarıdır. Uygulama Google tarafından onaylanmış veya Google ile bağlantılı değildir. Atıf rozeti özgün dosyadır; SHA-256: `1ce4cf9db4cd6c8ae6f6d49542264f5334f40ac79139d51c145a4e039d26323d`. Özgün dağıtım: https://docs.cloud.google.com/static/translate/images/google-translate-attribution.zip içindeki png/color-regular.png. Önceki sürümde bunun aynı baytlı kopyası https://huggingface.co/datasets/superlinked/sie-task-evidence/resolve/main/translation/wmt24pp-study-2026-10/assets/powered-by-google-translate.png adresinden alınmıştır. Marka hakları proje kodunun lisansına dahil değildir.

Çeviriler otomatik oluşturulur. Google; çevirilerin doğruluğu, güvenilirliği, ticari elverişliliği, belirli bir amaca uygunluğu ve hak ihlali içermemesi konusunda açık veya örtülü garanti vermez.
