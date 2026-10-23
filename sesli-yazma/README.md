# Hızır Bey Sesli Yazma

Chrome / LiveChat için logolu Türkçe dikte uzantısı. Güncel sürüm: **0.2.0**.

**Win + H (Windows yönlendirmesiyle) → konuş → Space ile bitir → metni oku → Enter ile gönder.**

## Google / Chrome denemesi

Ayarlar → **Ses tanıma → Google / Chrome · Deneme** seçeneğini kullan. Google / Chrome ses işleme onayını kaydet; daha önce alınmadıysa “Mikrofonu dene” ile mikrofon iznini ver. Ses için Google Cloud hesabı / API anahtarı istenmez. Güncel Google Chrome 135+ gerekir; diğer Chromium dağıtımları aynı Google hizmetini sağlamayabilir. İnternet ve Workspace politikası erişimi etkileyebilir.

Ses tanıma Google / Chrome tarafından yapılır. **Space sonrası noktalama** mevcut Groq Free bağlantısını kullanır; Google modunda Groq'a ses gönderilmez. Bu son kontrol için kayıtlı anahtar, Free hesap ve Groq metin işleme onayı gerekir. Bunlar yoksa Google ses taslağı yine yazılır; son noktalama yapılmadığı uyarıyla belirtilir. Ücretli plana geçiş / hesap yükseltme yapılmaz.

Önceki **Groq / Whisper** yöntemi aynı menüden seçilebilir. Mevcut anahtar, özel terimler, mikrofon seçimi / güçlendirme ve sözlük korunur. Google için ayrı ses işleme onayı gerekir; önceki Groq onayı yeni sağlayıcıya kendiliğinden aktarılmaz. Sağlayıcılar arasında otomatik geçiş yoktur.

Google hizmetinin kullanıcının bağlantısında erişilebilirliği veya Türkçeyi Groq'tan daha doğru tanıdığı bu ortamda doğrulanmış değildir. Bu sürüm karşılaştırma denemesidir; aynı cümleyle gerçek mikrofonunda değerlendir.

## Kurulum / güncelleme

ZIP'teki extension dosyalarını mevcut sabit uzantı klasörünün üzerine kopyala; chrome://extensions sayfasından aynı uzantıya **Yenile** uygula. LiveChat sayfasını da yenile. Uzantı kimliği / profil aynı tutulduğunda depolama anahtarları sıfırlanmaz. Anahtar veya hafıza dosyası paketlenmez. İlk kurulum: Geliştirici modu → Paketlenmemiş öğe yükle → extension klasörü. Ayrıntı: [KURULUM.txt](KURULUM.txt).

Chrome komutu **Alt + H**'dir. Win tuşu Chrome uzantı komutlarında desteklenmediği için Windows'ta mevcut FastKeys yönlendirmesi veya paketteki ücretsiz AutoHotkey v2 yardımcısı kullanılır. [Windows-Kisayol.txt](windows/Windows-Kisayol.txt) adımları içerir. Yardımcı kendiliğinden kurulmaz / başlatılmaz; Windows ayarları değiştirilmez.

## Dinleme, noktalama ve gönderim

- **Kısa veya uzun sessizlik dinlemeyi bitirmez, noktalama başlatmaz.** Canlı metin cümle noktalamasından temizlenir; sayı / tutar / saat ayırıcıları, bağlantılar ve e-posta adresleri korunur. 90 saniye sessizlik ve 15 dakika oturum kapanma zamanlayıcıları yoktur.
- Space / açık Durdur komutu fiziksel mikrofonu durdurur; son AudioWorklet kısmı, filtre / işlenmiş ses kuyruğu ve son tanıma sonucu tamamlanır. Sonrasında bütün taslak için **bir** noktalama kontrolü yapılır. Otomatik bellek koruması durdurması noktalama çağrısı yapmaz. Noktalama yeni kelime ekleyemez, silemez veya sıralayamaz; sayılar ve işlem durumu korunur.
- Google / Chrome Türkçe tr-TR, sürekli tanıma ve ara sonuçlarla çalışır. Aynı turun güncel sonucu eski önizlemesini yeniler; kısmi metinler art arda eklenmez. Gerçekte söylenen tekrarlar benzer kelime diye silinmez. Chrome destekliyorsa kendi otomatik noktalaması da kapatılır. Bir tarayıcı tanıma turu bitince aynı işlenmiş mikrofon izinde yeniden açılır; kullanıcı oturumu açık kalır. Yeniden açılma aralığı / gerçek ağ kesintisinde kelime eksikliği olabilir; göndermeden önce oku.
- Space sonrası son Google sonucu en fazla 5 saniye beklenir. Yetişmezse görünen taslak uyarıyla korunur. Bu süre yalnızca kullanıcı bitirdikten sonraki son sonuç içindir; dinlerken sessizlik sınırı değildir. Süren ağ hatası, izin / hizmet engeli veya mikrofon kopması açık hata verir.
- Whisper seçilirse varsayılan model Large v3, isteğe bağlı Turbo'dur. Taslak varsayılan 0,5 saniyelik durakta aktarılır. Konuşma 4 saniyeden sonra kısa doğal durakta veya en geç 8 saniyede parçalanır. Yakın parçalar en fazla 12 saniyelik ortak pencerede tanınır; yeni sonuç kendi önceki metnini yeniler. En az 1 saniyelik durak yalnızca yeni ses penceresini açar; noktalama / durdurma yapmaz.
- Son noktalamanın hızlı mod bütçesi 2,5 saniye; hızlı mod kapalıysa 10 saniyedir. Noktalama isteği tekrar edilmez. Yetişmezse taslak uyarıyla kalır; zorla son nokta eklenmez. Ses tanıma ve bağlantı süreleri bu bütçeden ayrıdır; sabit uçtan uca gecikme garantisi verilmez.
- Ekranın tam ortasında dinleme / hazırlık boyunca tıklamaları engellemeyen **20 px kırmızı nokta** görünür. İşlem bitince gizlenir. Logolu kontrol paneli yalnızca eklenti simgesine tıklanınca açılır; paneli kapatmak mikrofonu durdurmaz.
- Eklenti kendiliğinden göndermez. Kullanıcının gerçek Enter basışı bağlı görüşmenin kendi Gönder düğmesini bir kez çalıştırır. Gönderilen, ekranda görülen taslaktır; geç sonuç eklenmez. İlk metin / ekleme hazır değilken Enter bekletilip sonradan gönderime dönüştürülmez. Shift + Enter satır açar. Alt + H ile açıkça bitirilen hazır taslakta da Enter çalışır.
- Space'i basılı tutmak / hazırlıkta tekrar basmak ikinci bitirme, yeni kayıt veya taslağa boşluk oluşturmaz. İşlem tamamlanınca normal boşluk yazımı geri döner. Değiştirici tuşlar, IME girişi ve sayfanın ürettiği sahte klavye olayları durdurma sayılmaz.
- Gerçek LiveChat Lexical yazı alanı ve bağlı görüşme hedeflenir. İç not, sohbet / sekme / sayfa değişimi veya hedefin kaybolması kaydı kapatır. Elle düzenleme geç sonuçla ezilmez. Taslak, oturum başındaki yazıyı koruyarak kendi dikte alanını yeniler.
- **Yeniden yazdır** son dikteyi aynı görüşmeye yerleştirir; zaten varsa ikinci kez eklemez. Boşaltılan alan / geri alınan dikte geri getirilebilir. Farklı dolu manuel metin korunur. İşlem kayıt / bekleyen sesi kapatır, ek ses tanıma yapmaz ve göndermez. Yeni dikte, gönderim veya görüşme değişimi eski bağı kapatır. Son metin panelden kopyalanabilir.

## Mikrofon ve arka plan müziği

Arka plan koruması varsayılan açıktır. Paketlenmiş WebRTC/libfvad WASM, 20 ms kareler ve sürekli tek ton kontrolü cihazda çalışır. Ayarlardan **Arka planı ölç · 2 sn** ile müzik açıkken konuşmadan ölç. Yalnızca seviye / mikrofon kimliği saklanır; ölçüm sesi tutulmaz / gönderilmez. Farklı mikrofonun ölçümü uygulanmaz. Ortam / sistem mikrofon seviyesi değişirse yeniden ölç.

Gürültü ve yankı giderme istenir; cihaz destekliyorsa tüm yerel çalıma yönelik yankı giderme denenir. Koruma açıkken otomatik kazanç istenmez. Güçlendirme algılama sonrasında uygulanır: varsayılan %135, aralık %100–200. Google'a seçilmiş ve yerel filtreden geçmiş MediaStreamTrack verilir; ikinci bir varsayılan mikrofon açılmaz. Yeni sistem sesi / ekran yakalama izni yoktur.

Filtre şarkı vokalini / başka konuşmacıyı kullanıcıdan kesin ayırmaz; konuşmayla karışmış müziği bütünüyle çıkarmaz. Çok kısık konuşma filtreye takılabilir. Yüksek arka planda yakın kulaklık mikrofonu kullan; gerekirse %100 güçlendirmeyle dene. Ayarlardan koruma kapatılabilir.

Bilinen MK / altyazı ve uygunsuz metin kalıpları ortak denetimden geçer. Whisper ayrıca segment güven verisini denetler; Google aynı veriyi sağlamadığından bu denetime eşdeğer sayılmaz. Şüpheli bölüm yazılmaz, uyarı verilir; bilinmeyen kelime tahminle doldurulmaz. Filtre tüm tanıma hatalarını yakalamaz; sayı / özel ad / işlem durumunu oku.

## Ücretsiz kullanım ve sınırlar

Uzantı Google Cloud API kullanmaz, kota satın almaz veya hesap yükseltmez. Chrome hizmetinin kesintisiz / sınırsız olması garanti edilmez. Groq anahtarı yalnızca faturalandırması kapalı Free hesaptan kullanılmalı; anahtar planı kendiliğinden doğrulamaz.

Whisper ağ / sunucu / zaman aşımında 45 saniyelik istek bütçesiyle en fazla 3 deneme yapar; yeniden denemeler kotaya dahildir. 400 / 401 / 403 / 429 tekrar edilmez. Yerel dakika sınırında sıra beklenir; günlük veya sağlayıcı kotası dolunca durulur. İşlenen + sıradaki ses pencereleri yaklaşık 106 saniyeye yaklaşınca bellek koruması mikrofonu kapatıp alınmış sesi tamamlar. Tekrar kullanılan ses bağlamı da süreye / kotaya dahildir. Google işlenmiş ses aktarımı yaklaşık 2 saniyeyi aşan bir kuyruk oluşturursa bellek yerine açık hata ile durur.

Taslak 8.000 karakter sınırını aşarsa mevcut metin korunur. Sözlük / isteğe bağlı yerel düzeltmeler 10 MB UTF-8 sınırıyla yönetilir; sabit 1000 örnek kesintisi yoktur. Dışa / içe aktarma yalnızca sözlük ve düzeltmeler içindir; anahtar yedeğe eklenmez. Google denemesinde sözlükteki terimlerin yazımı yerel taslakta korunur; Chrome'a yeni bir kişisel ses modeli yüklenmez.

## Gizlilik

Ses seçili sağlayıcının hizmetinde, son noktalama metni izin verilmişse Groq'ta işlenir. Müşteri mesajları / görüşme geçmişi servise eklenmez. Ses yalnızca geçici bellektedir. Son dikte kurtarma kopyası güvenilir chrome.storage.session alanında tarayıcı oturumu boyunca tutulur. Anahtar chrome.storage.local içinde yalnızca güvenilir eklenti bağlamlarına açıktır; şifreli kasa olarak tanıtılmaz.

[Chrome gizlilik bilgileri](https://www.google.com/chrome/privacy/whitepaper.html) · [Groq veri işleme](https://console.groq.com/docs/your-data)

## Geliştirici ve doğrulama

Node 22.13+ / 24 ve Python 3: npm ci, npm run lint, npm test, npm run check, npm run package. Tarayıcı: npx playwright install chromium, node tests/browser.mjs, TEST_AUDIO=/absolute/path/to/test.wav node tests/extension.mjs. Son kullanıcı Node / Python kurmaz. Testler gerçek müşteri görüşmesi / kullanıcı anahtarı kullanmaz. Google tanıma olayları ve Groq yanıtları kontrollü taklit edilir; bu, gerçek Google doğruluk testi değildir. Son durum: [TEST-RAPORU.md](TEST-RAPORU.md).

API kaynakları: [Chrome sürekli tanıma / ara sonuçlar](https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api), [Chrome 135 MediaStreamTrack girişi](https://developer.chrome.com/release-notes/135), [Chrome 151 otomatik noktalama](https://developer.chrome.com/release-notes/151), [Web Speech API](https://webaudio.github.io/web-speech-api/).
