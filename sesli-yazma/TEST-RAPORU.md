# Hızır Bey Sesli Yazma 0.1.2 — Doğrulama

15 Ekim 2026

| Kontrol | Sonuç | Kapsam |
| --- | --- | --- |
| Birim / DOM / oturum testleri | **43 / 43 geçti** | Türkçe düzeltme korumaları, WAV/VAD, kazanç, gecikme/yeniden deneme/iptal, tampon sınırı, anahtar geçişi, 10 MB yedek, hedef editör |
| ESLint | **Geçti** | Uygulama, testler ve JavaScript yardımcıları |
| Sözdizimi ve manifest | **Geçti** | Alt + H sözleşmesi, kaynaklar, dar host listesi ve kimlik bilgisi taraması |
| Chromium arayüz / editör | **23 kontrol geçti** | Logonun yüklenmesi, masaüstü/mobil taşma, simge paneli, gizli boşta görünüm, dinleme/işleme sırasında kırmızı nokta, geri al, mikrofon ayarları ve Enter davranışı |
| Gerçek MV3 uzantısı + sahte mikrofon / API | **17 kontrol geçti** | Offscreen AudioWorklet → ses isteği → 503 sonrası tekrar → 26 saniye gecikme → düzeltme → tek ekleme → kullanıcının Enter'ı; kota sayacı, kırmızı noktanın görünmesi/kaybolması, tekrar başlatma, görüşme değişimi ve 429 |

Başarılı CI çalışması: [Sesli Yazma QA](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/38792814205). MV3 testinin çıktı günlüğü ayrıca okunmuş, 17 kontrolün tamamlandığı doğrulanmıştır.

Doğrulanan uygulama kaynak commit'i: `f9e525b17894931406216a63c30f2a1b257d5e23`. Teslimdeki 20 uygulama dosyası bu kaynakla bayt düzeyinde eşleştirilmiştir; daha sonraki teslim commit'i rapor, proje özeti ve kurulum arşivini ekler.

## Gerçek olarak doğrulananlar

- Chrome Manifest V3 uzantısı yüklenir; logolu ayarlar açılır, anahtar kaydı ve mikrofon izni akışı çalışır.
- Chrome offscreen belgesinde AudioWorklet mikrofon akışı işlenir. Test kaydı deterministik yapay sestir; canlı kullanıcı sesi değildir.
- Servis çağrıları özel test kopyasında taklit edilir. Gerçek API anahtarı veya ücretli/ücretsiz gerçek Groq tüketimi kullanılmaz. Ücretsiz kota/429 durumu taklitle sınanır.
- LiveChat URL'sine yerel test cevabı döndürülür. Gerçek müşteri veya gerçek müşteri hesabı açılmaz; mesaj gönderilmez.
- Üretim uzantısında test kancası veya taklit servis yoktur. Teste özel değişiklikler geçici kopyada kalır ve kurulum ZIP'ine girmez.
- İşlem sürerken Enter engellenir; sonradan otomatik gönderim olmaz. Kullanıcının gerçek klavye Enter'ı, hazır metni standart editörde gönderir ve oturum biter.
- Görüşme değiştiğinde geç gelen sonuç yeni alana yazılmaz. İç not ve elle değiştirilmiş metin kontrolleri editör testlerinde doğrulanır.
- İlk ses isteğine 503 cevabı verilir; ikinci istek 26 saniye bekletilir. Bu sırada yeni bir gereksiz istek oluşmaz, Enter göndermez; sonuç yalnızca bir kez eklenir. İki ses denemesinin de ücretsiz kota sayacına girdiği doğrulanır.
- Ağ hatalarında en fazla üç deneme, zaman aşımında önceki isteğin iptali, bekleme sırasında iptal ve 400/401/403/429 hatalarında tekrar yapılmaması birim testlerinde doğrulanır.
- Eski dört-parçalık kuyruk sınırını aşan gecikme taklidiyle yaklaşık iki dakikalık ses tamponunda mikrofonun kapanması ve iptalde geç sonuç eklenmemesi doğrulanır. Bu, sonsuz çevrimdışı kayıt iddiası değildir.
- %135 kazancın düşük sesi yükselttiği, yüksek örneklerin sınırda kaldığı ve ham VAD verisinin değiştirilmediği doğrulanır. Yeni eşik sessiz sesi algılar; düşük seviyeli yapay gürültüyü konuşma saymaz. Gerçek ortam gürültüsü ayrıca denenmelidir.
- Güncelleme sırasında API anahtarı ve kişisel sözlük korunur. Eski varsayılan eşik taşınır; diğer özel eşikler korunur.
- 10 MB'a yakın hafıza JSON yedeği aynı kapasite sınırında yeniden içe alınır. Anahtar bu yedekte yoktur.

## 0.1.2 görünüm değişikliği

- Sayfa boşta hiçbir panel veya düğme göstermez. Dinleme ve metin hazırlanırken sağ üstte 10 px kırmızı nokta görünür; nokta tıklamaları engellemez. Enter ile gönderim veya iptalde gizlenir.
- Eklenti simgesinden açılan küçük panelde logo, Başlat/Durdur/İptal, geri al, ayarlar, süre/seviye ve isteğe bağlı son metin kopyası doğrulanmıştır. Panel ekran görüntüleri ayrıca incelenmiştir.
- Gizli sayfa görünümünde işlem sürerken Enter koruması devam eder. Hazır dikte geri alınabilir; elle değiştirilmiş metin geri alınmaz.
- Konuşma, dil düzeltme, mikrofon ve ağ işlem dosyaları önceki sürümle bayt düzeyinde aynıdır. Bu güncelleme çalışma panelini değiştirir.
- Win + H, Chrome'un desteklemediği Windows tuşu nedeniyle yardımcı eşleştirmeyle sunulur. Manifestte çalışan Alt + H komutu korunur. AutoHotkey v2 yardımcısı yalnızca Chrome öndeyken tuş yönlendirir; otomatik kurulmaz/başlatılmaz. FastKeys yönergesi mevcut şablonların genel ayarlarını değiştirmez.

## Henüz ölçülmeyenler

- Kullanıcının kendi mikrofonunda Türkçe kelime hata oranı, şive/ortam gürültüsü ve gecikme.
- Güncel canlı LiveChat uygulamasının kendi Lexical durum yönetimiyle son kabul testi. Test sayfası gerçek editörün bilinen seçicilerini ve tarayıcı metin düzenlemesini kullanır; uygulamanın tüm iç mantığını çalıştırmaz.
- Gerçek Free Groq hesabının kişiye özgü kotaları, model erişimi veya canlı servis gecikmesi.
- Kullanıcının Workspace bağlantısının tüm kesinti/yeniden bağlanma biçimleri. Test kontrollü gecikme ve geçici hata üretir; kalıcı internet kesintisini giderdiği iddia edilmez.
- Windows üzerinde fiziksel Win + H yönlendirmesi, AutoHotkey v2 çalışma testi ve kullanıcının FastKeys yapılandırması henüz doğrulanmadı. Linux/Chromium kontrolleri bu dış Windows yardımcısını çalıştırmaz.
- Bütün tarayıcı/işletim sistemi kısayol çakışmaları. Alt + H manifest ve komut ataması olarak kontrol edilir; kullanıcının Chrome profilinde ayrıca kontrol edilir.

İlk kullanımda kontrollü test görüşmesinde kısa bir cümle dene. Tutar, özel ad ve işlem durumunu göndermeden önce oku. Bu rapor yüzde 100 doğruluk iddiası değildir.

## Paket kontrolü

Kurulum arşivi yalnızca 20 uzantı dosyası, dört yönerge/rapor belgesi ve iki Windows yardımcı/yönerge dosyası içerir. Paketleme betiği uzantı kaynaklarını ve ZIP içeriğini kimlik bilgisi desenleri için tarar; ZIP CRC kontrolü ve SHA-256 özeti üretir. Anahtar, token dosyası, oturum, kullanıcı hafızası, test profili veya ses dosyası paketlenmez.
