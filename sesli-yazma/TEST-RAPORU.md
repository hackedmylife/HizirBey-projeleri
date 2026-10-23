# Hızır Bey Sesli Yazma 0.2.0 — Doğrulama

23 Ekim 2026

| Kontrol | Sonuç | Kapsam |
| --- | --- | --- |
| Birim / DOM / oturum | **109 / 109 geçti** | Google durum makinesi, ses / VAD / kuyruk, duraklarda devam, yalnız bitirmede noktalama, son PCM, önceki korumalar |
| ESLint | **Geçti** | Uygulama, testler ve yardımcılar |
| Kaynak / manifest / sözdizimi | **Geçti** | 29 çalışma dosyası, WASM özeti / lisanslar, host listesi, Alt + H ve literal anahtar taraması |
| Chromium arayüz / editör | **62 kontrol geçti** | Sağlayıcı / açık Google onayı, model seçimi, Space, Enter, tekrar yazdırma ve masaüstü / mobil görünüm |
| Gerçek MV3 / mikrofon / kontrollü hizmetler | **63 kontrol geçti** | Gerçek AudioWorklet / WASM / işlenmiş MediaStreamTrack, Google olayları, dinlerken sıfır metin isteği, Space sonrası tek noktalama |

CI: [Sesli Yazma QA](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39915475330).
Test edilen kaynak commit: `75f1b123616cfa0cc8090d16ade828a8a5dff508`.
109 test, 62 arayüz ve 63 MV3 başarı satırı CI günlüğünden ayrıca doğrulandı; tüm iş adımları başarılıdır.

## Noktalama / duraklama regresyonu

- Kısa ve daha uzun sessizlikler arasında üç konuşma bölümü verilir. Her bölüm taslağa eklenir; mikrofon açık kalır, noktalama isteği sayısı sıfırdır. Açık bitirme sonrasında bütün taslak için yalnızca bir metin isteği yapılır.
- Beş parçalı uzun konuşma ve büyüyen ortak ses pencereleri canlı taslak olarak kalır. Bekleme, önizleme sınırı, Whisper sonucu veya Google final tanıma sonucu noktalama / kullanıcı oturumu bitişi sayılmaz.
- Google tanıma örneğine nokta / virgül / ünlem içeren sonuçlar verilir; canlı taslağa bu cümle işaretleri aktarılmaz. Browser final sonucu ve onend sonrasında yeni tanıma turu açılır; önceki metin korunur. Gerçekte söylenen tekrarlar silinmez.
- Gerçek Space ile fiziksel mikrofon durur; son tanıma cevabındaki ek kelimeler alınır. Bütün taslak noktalandıktan sonra oturum biter, nokta gizlenir ve kullanıcı gerçek Enter ile bir kez gönderir. Space kendiliğinden gönderim yapmaz.
- Önceki süre deneyi sürer: kontrollü saatle 91 saniye sessizlik ve ardından 16 dakika daha ilerletilince mikrofon açık kalır. Bu gerçek zamanlı 17 dakika Google hizmeti deneyi değildir.

## Google ses yolu ve sınırı

- Gerçek MV3 testinde seçilmiş mikrofon / AudioWorklet, paketlenmiş WASM ve Web Audio MediaStreamTrack kullanılır. SpeechRecognition tanıma olayları kontrollü taklit edilir; ses izi gerçekten işlenmiş çıkış izidir. Üretilmiş müzik sinyalinde çıkış RMS sıfır, kamuya açık konuşmada sıfırdan büyük ölçülür. Bu, Google'ın gerçek tanıma doğruluğu testi değildir.
- Türkçe, continuous / interimResults ve kapalı unspokenPunctuation ayarları doğrulanır. Google dinlerken uygulamanın Groq ses / metin isteği sayısı sıfırdır. Space sonrası bir Groq metin isteği, sıfır Groq ses isteği görülür; anahtar korunur.
- No-speech olayı yeniden açılabilir sessizliktir. Ardışık ağ hatalarında sınırlı yeniden bağlanma yapılır; izin / mikrofon / hizmet hataları açıkça durur. İptal edilen turdan geç sonuç / zamanlayıcı yeni dikte oluşturmaz. Son sonuç zaman aşımında görünen taslak korunur.
- Ayrı Google onayı olmadan yeni sağlayıcı başlatılmaz. Önceki Groq anahtarı silinmez; Groq metin onayı yokken Google ses başlatılabilse de anahtar / düzeltme yetkisi ses bağlamına aktarılmaz ve Groq isteği yapılmaz.
- Google sunucusuna gerçek bağlantı, kullanıcının Türkçe tanıma doğruluğu, Workspace erişim politikası ve gerçek mikrofon bu ortamda doğrulanmamıştır. Deneme seçeneği bu nedenle açıkça etiketlidir. Gerçek müşteri görüşmesi veya kişisel ses / anahtar kullanılmaz. Google'ın Groq'tan daha iyi olduğu sonucu çıkarılmaz.

## Son ses / güvenlik / görünüm

- Gerçek AudioWorklet kodu ayrı testte çalıştırılır: 2.048 örnekten kısa son parça bitirme isteğinde bir kez gönderilir, ardından tamamlandı olayı gelir. Tekrar boşaltma aynı sesi çoğaltmaz.
- Ses kapısının başlangıç tamponu yeni hecenin başını korur; reddedilen arka plan sıfır ses olarak çıkışa verilir. Güçlendirme ve kaynaklar kapanınca mikrofon / işlenmiş iz / oynatım düğümleri serbest bırakılır. Uygulama Google Cloud API / ödeme entegrasyonu kullanmaz.
- Sayı / kelime / olumsuzluk koruması, MK / altyazı denetimi, gerçek Enter, elle düzenleme / görüşme bağı, yeniden yazdırma, kota ve ağ yeniden denemesi testleri sürer. Google, Whisper'ın segment güven verisini sağlamaz; bu iki kalite denetimi eşdeğer değildir.
- Masaüstü ve mobil ayar ekranları incelendi. Google / Groq seçimi, ayrı onay, Space sonrası noktalama etiketi, logo ve sürüm görünür; yatay taşma kontrolü geçer. 20 px merkez noktası korunur.
- Cihazda kabul testi gerektirenler: canlı Lexical, kişisel mikrofon / şarkı vokali, gerçek Google hizmeti ve fiziksel Windows Win + H yönlendirmesi. Tam müzik ayırma, sıfır kelime hatası, sınırsız hizmet veya sabit gecikme garantisi verilmez.

## Paket / kaynak

35 arşiv dosyası yerel içerikle, 29 çalışma dosyası başarılı kaynak commit'inin Git içerik özetleriyle eşleştirilir. Son teslim commit'i yalnızca rapor, proje özeti, ZIP ve SHA-256 dosyasını günceller. CRC / SHA-256 ve hem kaynak hem arşiv literal anahtar taraması yapılır. Test kancası / fetch değişikliği, kullanıcı anahtarı / hafızası veya ses arşivi pakete konmaz. Kota, gerçek bağlantı / hedef değişimi, 8.000 karakter taslak ve ses belleği korumaları sürer.
