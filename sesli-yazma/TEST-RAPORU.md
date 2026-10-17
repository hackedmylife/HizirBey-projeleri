# Hızır Bey Sesli Yazma 0.1.4 — Doğrulama

17 Ekim 2026

| Kontrol | Sonuç | Kapsam |
| --- | --- | --- |
| Birim / DOM / oturum testleri | **65 / 65 geçti** | Hız bütçesi, art arda hızlı aktarım, kota sırasında iptal/devam, MK/altyazı ve kalite denetimi, son aktarım koruması, Türkçe anlam, WAV/VAD/kazanç, iptal, tampon sınırı, anahtar ve yedek |
| ESLint | **Geçti** | Uygulama, testler ve JavaScript yardımcıları |
| Sözdizimi ve manifest | **Geçti** | Alt + H sözleşmesi, kaynaklar, dar host listesi ve kimlik bilgisi taraması |
| Chromium arayüz / editör | **27 kontrol geçti** | Logonun yüklenmesi, masaüstü/mobil taşma, simge paneli, gizli boşta görünüm, dinleme/işleme sırasında farklı pencere boyutlarında ortalı kırmızı nokta, aktarım süresi, hızlı mod, geri al, mikrofon ayarları ve Enter davranışı |
| Gerçek MV3 uzantısı + sahte mikrofon / API | **21 kontrol geçti** | Offscreen AudioWorklet → ses isteği → 503 sonrası tekrar → 26 saniye gecikme → düzeltme → tek ekleme → kullanıcının Enter'ı; kota sayacı, şüpheli altyazı cevabının engellenmesi/mevcut yazının korunması, ortalanmış kırmızı nokta, aktarım süresi, görüşme değişimi ve 429 |

Başarılı CI çalışması: [Sesli Yazma QA](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/38807935797). MV3 testinin çıktı günlüğü ayrıca okunmuş, 21 kontrolün tamamlandığı doğrulanmıştır.

Doğrulanan uygulama kaynak commit'i: `e2ceda349754b846f77fcec4058fba5f1ad06656`. Teslimdeki 22 uygulama dosyası bu kaynakla bayt düzeyinde eşleştirilmiştir; daha sonraki teslim commit'i rapor, proje özeti ve kurulum arşivini ekler.

## Gerçek olarak doğrulananlar

- Chrome Manifest V3 uzantısı yüklenir; logolu ayarlar açılır, anahtar kaydı ve mikrofon izni akışı çalışır.
- Chrome offscreen belgesinde AudioWorklet mikrofon akışı işlenir. Test kaydı deterministik yapay sestir; canlı kullanıcı sesi değildir.
- Servis çağrıları özel test kopyasında taklit edilir. Gerçek API anahtarı veya ücretli/ücretsiz gerçek Groq tüketimi kullanılmaz. Ücretsiz kota/429 durumu taklitle sınanır.
- LiveChat URL'sine yerel test cevabı döndürülür. Gerçek müşteri veya gerçek müşteri hesabı açılmaz; mesaj gönderilmez.
- Üretim uzantısında test kancası veya taklit servis yoktur. Teste özel değişiklikler geçici kopyada kalır ve kurulum ZIP'ine girmez.
- İşlem sürerken Enter engellenir; sonradan otomatik gönderim olmaz. Kullanıcının gerçek klavye Enter'ı, hazır metni standart editörde gönderir ve oturum biter.
- Görüşme değiştiğinde geç gelen sonuç yeni alana yazılmaz. İç not ve elle değiştirilmiş metin kontrolleri editör testlerinde doğrulanır.
- İlk ses isteğine 503 cevabı verilir; ikinci istek 26 saniye bekletilir. Bu sırada yeni bir gereksiz istek oluşmaz, Enter göndermez; sonuç yalnızca bir kez eklenir. İki ses denemesinin de ücretsiz kota sayacına girdiği doğrulanır.
- Ses tanımada ağ hatalarında en fazla üç deneme, zaman aşımında önceki isteğin iptali, bekleme sırasında iptal ve 400/401/403/429 hatalarında tekrar yapılmaması birim testlerinde doğrulanır.
- Eski dört-parçalık kuyruk sınırını aşan gecikme taklidiyle yaklaşık iki dakikalık ses tamponunda mikrofonun kapanması ve iptalde geç sonuç eklenmemesi doğrulanır. Bu, sonsuz çevrimdışı kayıt iddiası değildir.
- %135 kazancın düşük sesi yükselttiği, yüksek örneklerin sınırda kaldığı ve ham VAD verisinin değiştirilmediği doğrulanır. Yeni eşik sessiz sesi algılar; düşük seviyeli yapay gürültüyü konuşma saymaz. Gerçek ortam gürültüsü ayrıca denenmelidir.
- Güncelleme sırasında API anahtarı ve kişisel sözlük korunur. Eski varsayılan eşik taşınır; diğer özel eşikler korunur.
- 10 MB'a yakın hafıza JSON yedeği aynı kapasite sınırında yeniden içe alınır. Anahtar bu yedekte yoktur.

## 0.1.4 gecikme ve merkezdeki nokta

- Varsayılan 500 ms durakla cümle kapanması ve uzun konuşmanın kısa doğal durakta veya yaklaşık 8 saniyede parçalanması doğrulanır.
- Taklit API ile arka arkaya iki konuşma parçasının 1 saniyelik test sınırı içinde, sırayla ve sabit 3,5 saniyelik ara olmadan aktarıldığı doğrulanır. Bu rakam gerçek Groq yanıt süresi ölçümü değildir.
- Dil düzeltmesi taklitle bekletilir. Hızlı moddaki 2,5 saniyelik bütçe dolunca yalnızca denetlenmiş temel metnin uyarıyla bir kez aktarıldığı, sonradan gelen düzeltmenin yeniden yazılmadığı doğrulanır. Bütçe ses tanıma/ağ süresini sınırlamaz.
- Dakikalık yerel kota dolunca istek tüketmeden bekleme bilgisi döner; sıra açılınca aynı ses işlenir. Beklerken iptal edilirse sağlayıcıya istek ve editöre sonuç gitmez. Günlük/ses kullanım sınırları korunur.
- Noktanın yatay ve dikey merkezde olduğu hem gerçek MV3 uzantısında hem masaüstü/dar pencere boyutlarında ölçülür. Tıklamaları engellemez. Son aktarım süresi küçük panelde görünür; gerçek MV3 testinde kasıtlı ağ beklemesinin bu süreye dahil olduğu doğrulanır.
- Eski varsayılan beklemenin 500 ms'ye geçişinde anahtar, izin ve sözlük korunur; özel durak ve hızlı mod seçimleri saklanır.
- Gerçek kullanıcı mikrofonu, Groq hesabı ve Workspace bağlantısında uçtan uca gecikme ölçülmemiştir. Her koşulda birkaç saniyede bitme garantisi verilmez.

## 0.1.3 şüpheli dikte koruması

- Bilinen altyazı/kapanış kalıpları ile MK/M.K. varyantları, yüksek güven ölçümleriyle gelse bile otomatik yazılmaz. Şüpheli parçanın tamamı reddedilir; kısmen silinerek farklı metin kurulmaz.
- Ses tanıma cevabında segment güven verileri zorunlu tutulur. Ortalama log olasılığı < -1, konuşma olmama olasılığı > 0,6 veya sıkıştırma oranı > 2,4 olan tek bir segment bile karışık parçanın aktarımını durdurur. Bütün segmentler sessizlik koşulunu sağlıyorsa metin atlanır.
- Aynı metin denetimi dil düzeltmesi adayında ve editöre son aktarımda uygulanır. Şüpheli düzeltme yerine yalnızca temiz, denetlenmiş temel metin kullanılabilir.
- Gerçek MV3 uzantısı testinde API'ye bilinen altyazı hatası döndürülür. Mevcut yazının aynen kaldığı, bu sonucun hiç eklenmediği, mesaj gönderilmediği ve mikrofonun kapanarak uyarı ürettiği doğrulanır.
- Eski düzeltme uyarısı kritik reddetme mesajının önüne geçmez. Son sessizlik kırpması, yeni bir bulut isteği veya ek bekleme gerektirmez.
- Görseldeki kullanıcının orijinal ses kaydı mevcut değildir. Görselden hata biçimi teşhis edilmiştir; gerçek seste aynı olayın yeniden üretildiği iddia edilmez. Bu bir kelime doğruluğu garantisi değildir; özellikle özel adlar ve sayılar yine okunmalıdır.

## Panel ve görünüm kontrolleri

- Sayfa boşta hiçbir panel veya düğme göstermez. Dinleme ve metin hazırlanırken ekranın tam ortasında 10 px kırmızı nokta görünür; nokta tıklamaları engellemez. Enter ile gönderim veya iptalde gizlenir.
- Eklenti simgesinden açılan küçük panelde logo, Başlat/Durdur/İptal, geri al, ayarlar, süre/seviye ve isteğe bağlı son metin kopyası doğrulanmıştır. Panel ve merkezdeki noktanın ekran görüntüleri ayrıca incelenmiştir.
- Gizli sayfa görünümünde işlem sürerken Enter koruması devam eder. Hazır dikte geri alınabilir; elle değiştirilmiş metin geri alınmaz.
- Win + H, Chrome'un desteklemediği Windows tuşu nedeniyle yardımcı eşleştirmeyle sunulur. Manifestte çalışan Alt + H komutu korunur. AutoHotkey v2 yardımcısı yalnızca Chrome öndeyken tuş yönlendirir; otomatik kurulmaz/başlatılmaz. FastKeys yönergesi mevcut şablonların genel ayarlarını değiştirmez.

## Henüz ölçülmeyenler

- Kullanıcının kendi mikrofonunda Türkçe kelime hata oranı, şive/ortam gürültüsü ve gecikme; yeni kalite eşiklerinin gereksiz reddetme oranı. Gerçek bir MK baş harfi/kod veya video kalıbı amaçlanmışsa filtre fazla sıkı davranabilir.
- Güncel canlı LiveChat uygulamasının kendi Lexical durum yönetimiyle son kabul testi. Test sayfası gerçek editörün bilinen seçicilerini ve tarayıcı metin düzenlemesini kullanır; uygulamanın tüm iç mantığını çalıştırmaz.
- Gerçek Free Groq hesabının kişiye özgü kotaları, model erişimi veya canlı servis gecikmesi.
- Kullanıcının Workspace bağlantısının tüm kesinti/yeniden bağlanma biçimleri. Test kontrollü gecikme ve geçici hata üretir; kalıcı internet kesintisini giderdiği iddia edilmez.
- Windows üzerinde fiziksel Win + H yönlendirmesi, AutoHotkey v2 çalışma testi ve kullanıcının FastKeys yapılandırması henüz doğrulanmadı. Linux/Chromium kontrolleri bu dış Windows yardımcısını çalıştırmaz.
- Bütün tarayıcı/işletim sistemi kısayol çakışmaları. Alt + H manifest ve komut ataması olarak kontrol edilir; kullanıcının Chrome profilinde ayrıca kontrol edilir.

İlk kullanımda kontrollü test görüşmesinde kısa bir cümle dene. Tutar, özel ad ve işlem durumunu göndermeden önce oku. Bu rapor yüzde 100 doğruluk iddiası değildir.

## Paket kontrolü

Kurulum arşivi yalnızca 22 uzantı dosyası, dört yönerge/rapor belgesi ve iki Windows yardımcı/yönerge dosyası içerir. Paketleme betiği uzantı kaynaklarını ve ZIP içeriğini kimlik bilgisi desenleri için tarar; ZIP CRC kontrolü ve SHA-256 özeti üretir. Anahtar, token dosyası, oturum, kullanıcı hafızası, test profili veya ses dosyası paketlenmez.
