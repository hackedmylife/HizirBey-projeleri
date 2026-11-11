# Hızır Bey Tercüman 0.2.1

Ücretsiz Android uygulaması. Samsung S20 FE ve Redmi Note 10 Pro için ARM64/ARMv7, Android 8.0+. Fiziksel telefonların mikrofon/kamera testi bu ortamda yapılmadı.

## 0.2.1: Paket beklerken dinlememe düzeltmesi

Konuşma düğmesi artık çeviri paketinin indirilmesini beklemeden dinlemeyi başlatır. Yerel dinlemede mikrofon, Whisper modeli belleğe yüklenmeden önce açılır; model konuşma alındıktan sonra çözümleme için hazırlanır. Konuşma metni önce ekrana yazılır. Çeviri için yalnızca seçili dil çiftinin eksik modelleri hazırlanır. Bu modellerin hazır olması çeviri için hâlâ gereklidir; dinleme için değildir.

Daha önce indirilmiş paketler kullanılırken yeni bir indirme isteği gönderilmez. Seçili paket hazırlığı 90 saniyede bitmezse bekleme sonlandırılır, alınan metin korunur ve hata/yeniden deneme ekranı gösterilir. “Bu bağlantıyla indir” seçeneği yalnızca seçili çifti Wi-Fi kısıtı olmadan denemek içindir; mobil veri kullanabilir. Genel Wi-Fi tercihini değiştirmez.

Konuşma sırasında toplu indirme **sırasına** ara verilir; başlamış bir SDK indirmesi arka planda tamamlanabilir. Seçili çift önceliklidir. Konuşma tamamlandığında/durdurulduğunda toplu sıra uygulama açıkken sürer. Toplu paket isteğine de paket başına süre sınırı eklendi. Mikrofon izni sonucunun ekran yeniden görünmeden gelmesi durumunda dinleme ekran görünür olunca başlatılır.

## Güncelleme ve toplu kurulum

1. APK'yı eski uygulamanın üzerine kur; uygulamayı kaldırma. Aynı test imzası kullanılır.
2. İlk açılışta **Tüm dil ve ses desteğini hazırla** sorusu çıkar. **Tümünü hazırla** seçeneği 59 dilde metin çevirisi için 58 paketi sırayla indirir; İngilizce ortak dil olduğundan ayrı çeviri paketi yoktur. Yaklaşık 2 GB internet ve boş alan gerekebilir. Boyut modellere göre değişir. Wi-Fi tercihi uygulanır. Uygulamayı açık tut; kesilirse sonraki açılışta eksik paketlerden devam edilir. Önceki paketler korunur.
3. İşaretli **Çok dilli ücretsiz ses motorunu da kur** seçeneği yaklaşık 10 MB eSpeak NG uygulamasını resmi F-Droid deposundan indirir. Bu ayrı ve ücretsiz uygulama çok sayıda ses dilini tek kurulumda getirir. Android'in **Bu kaynaktan yüklemeye izin ver** ve **Yükle** onaylarını ver. Kurulum sonrası açılan eSpeak kendi verilerini hazırlar; Geri ile Tercüman'a dön. Varsayılan ses motorunu değiştirmen gerekmez.
4. Daha sonra aynı hazırlık ekranı **Ayarlar → Tüm dil ve ses desteğini hazırla** üzerinden açılabilir. İlk soruda geçmek hiçbir toplu indirme başlatmaz.
5. Mikrofon iznini ver. Konuşan kişinin dil düğmesine dokun. Yerel dinlemede kısa cümlenin ardından yaklaşık bir saniye durakla. Bir konuşma parçası en çok 20 saniyedir.

## Ses paketi düzeltmesi

İngilizce ve Makedonca doğrudan APK içindeki **Whisper base-q5_1 / whisper.cpp** çok dilli konuşma motorunda çözülür. Android'den bu iki dil için ayrı konuşma tanıma paketi istenmez. Makedoncanın Android bölge kodu `mk-MK` olarak düzeltildi. Diğer desteklenen dillerde Android ses hizmeti hata verirse yerel motor açılır.

**Kesin çevrimdışı ses** veya **Konuşmayı her zaman telefonda çözümle** seçeneği desteklenen dillerde yerel tanımayı kullanır. Ücretli API, sunucu, GPU veya anahtar gerekmez. Yaklaşık 60 MB model APK içindedir; ilk kullanımda özel alana kopyalanır. CPU üzerinde çözümleme telefona/cümleye göre birkaç saniye veya daha uzun sürebilir. Modelin dili desteklemesi kusursuz tanıma anlamına gelmez; gürültü, aksan ve az verili diller kaliteyi etkiler.

Metin çevirisi listesindeki Esperanto ve İrlandaca yerel Whisper modelinde yoktur. Bu iki dilde konuşma Android hizmetine bağlıdır. Konuşmayı tanımak, çeviri modeli ve sesli okuma ayrı işlevlerdir.

Sesli okumada mevcut doğal ses tercih edilir; uygun ses yoksa eSpeak dahil diğer yüklü motorlar denenir. Bölgesi farklı ama dili aynı ses kabul edilir. Eksik sesli okumada çeviri ekranda kalır ve kurulum seçeneği sunulur. eSpeak daha robotik seslidir. Sistem motorlarının bütün seslerini üçüncü taraf uygulamadan sessizce kurmak Android tarafından garanti edilmez; toplu seslendirme için ayrı çok dilli motorun bir kez kurulması kullanılır.

## Diğer özellikler

59 dilde Google ML Kit metin çevirisi; ilgili paketler indirildikten sonra internetsiz çalışır. İki yönlü konuşma, sesli okuma, sırayla iki dile geçme, yapıştırma, metin dilini algılama, kopyalama, favoriler, son 200 çevirinin yerel geçmişi ve silme vardır. Sırayla dinleme konuşanın dilini kendiliğinden tespit etmez.

Fotoğraf/kamera OCR: Latin, Çince, Japonca, Korece ve Devanagari. Arapça/Kiril/diğer alfabeler için OCR yoktur; bu sınırlama ses tanımadan ayrıdır. Metin girişi 4000 karakterdir. Büyük fotoğraf küçültülür ve EXIF yönü düzeltilir. Uzun seslendirme parçalanır. Uygulama arka planda mikrofonu kapatır ve iptal edilen işlemin geç sonucunu reddeder.

Telefon/WhatsApp aramasını yakalama, başka uygulama videosuna dublaj, 139 dilde tam çevrimdışı destek ve otomatik uygulama güncellemesi bu sürümde yoktur. Gelecekte ücretli çeviri sağlayıcısı `TranslationEngine` üzerinden eklenebilir; mevcut sürüm ücretli API çağırmaz.

## Veriler ve kurulum

Yerel tanımada ham ses dosyası oluşturulmaz; RAM'de işlenir. Diğer dillerde kullanılan Android ses hizmeti sesi internetten işleyebilir. Geçmiş uygulama alanında kalır; bulut yedeği ve cihaz aktarımı kapalıdır. Uygulamayı kaldırmak verileri silebilir.

eSpeak yalnızca kullanıcının seçimiyle indirilir. F-Droid APK'sının SHA-256 özeti ve paket adı doğrulanır. `REQUEST_INSTALL_PACKAGES`, Android kurucusunu açmak içindir; sessiz kurulum yapılmaz. Yüklüyse yeniden indirilmez. API anahtarı veya token yoktur.

## Derleme ve yedek

JDK 17/21, SDK 35, Build Tools 34, NDK 25.2.9519653, CMake 3.22.1, Gradle Wrapper 8.9 gerekir. Android Studio ile açılabilir. `ANDROID_HOME` veya `local.properties` içindeki `sdk.dir` ayarlanmalıdır.

```sh
python3 prepare_dependencies.py
./gradlew assembleDebug testDebugUnitTest lintDebug
```

Windows'ta `python` ve `gradlew.bat` kullanılır. APK: `app/build/outputs/apk/debug/app-debug.apk`.

Özel kaynak ZIP'i aynı imzayla güncelleme için `signing/hizirbey-test.keystore` içerir. Bu kişisel test anahtarı mağaza/üretim anahtarı değildir; hiçbir API anahtarı yoktur. Genel GitHub yedeği imza anahtarını, büyük modeli ve üçüncü taraf kaynak ağacını içermez. `prepare_dependencies.py` özeti sabitlenmiş kaynak/modeli geri getirir. Orijinal anahtar yoksa yeni bir yerel test anahtarı üretir; bu anahtarla eski APK'nın üzerine güncelleme yapılamaz. Bunun için özel kaynak ZIP'indeki orijinal anahtarı kullan.

## Kaynaklar ve lisanslar

- whisper.cpp v1.7.6 (MIT): https://github.com/ggml-org/whisper.cpp/tree/v1.7.6
- Whisper model (MIT): https://github.com/openai/whisper
- Model: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin
- eSpeak NG, ayrı uygulama (GPL-3.0+): https://github.com/espeak-ng/espeak-ng
- eSpeak APK ve karşılık gelen kaynak: https://f-droid.org/packages/com.reecedunn.espeak/
- ML Kit: https://developers.google.com/ml-kit/language/translation/android
- OCR: https://developers.google.com/ml-kit/vision/text-recognition/v2/android
- Android ses hizmeti: https://developer.android.com/reference/android/speech/SpeechRecognizer
- Çeviri hakkında: https://cloud.google.com/translate/
- Atıf koşulları: https://developers.google.com/ml-kit/language/translation/translation-terms

Google Translate ve Google logosu Google LLC'nin markalarıdır. Uygulama Google tarafından onaylanmış veya Google ile bağlantılı değildir. Atıf rozeti özgün dosyadır; SHA-256: `1ce4cf9db4cd6c8ae6f6d49542264f5334f40ac79139d51c145a4e039d26323d`. Özgün dağıtım: https://docs.cloud.google.com/static/translate/images/google-translate-attribution.zip içindeki png/color-regular.png. Önceki sürümde bunun aynı baytlı kopyası https://huggingface.co/datasets/superlinked/sie-task-evidence/resolve/main/translation/wmt24pp-study-2026-10/assets/powered-by-google-translate.png adresinden alınmıştır. Marka hakları proje kodunun lisansına dahil değildir.

Çeviriler otomatik oluşturulur. Google; çevirilerin doğruluğu, güvenilirliği, ticari elverişliliği, belirli bir amaca uygunluğu ve hak ihlali içermemesi konusunda açık veya örtülü garanti vermez.
