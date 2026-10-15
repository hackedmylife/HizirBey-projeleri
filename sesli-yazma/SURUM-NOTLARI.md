# 0.1.4 — Daha kısa bekleme ve ekran ortasında kırmızı nokta

15 Ekim 2026

- Aktif dinleme ve metin hazırlamada tek 10 px kırmızı nokta tam ekran merkezindedir. Ekran boyutu değişince merkezde kalır; tıklamaları engellemez. Kontroller yalnızca eklenti simgesindedir.
- Varsayılan cümle sonu duraklama 1 saniyeden 0,5 saniyeye düşürüldü. Uzun konuşma kısa doğal duraklarda daha erken, en geç 8 saniyede parçalanır.
- Ses istekleri arasındaki sabit 3,5 saniyelik ara kaldırıldı. Mevcut dakikalık uygulama sınırında sıra açılana kadar iptal edilebilir bekleme uygulanır; ek istek sayılmaz. Günlük sınırlar ve sağlayıcının 429 cevabında durma korunur.
- Yeni Hızlı aktarım ayarı varsayılan açık. Dil düzeltmesine toplam 2,5 saniye bütçe verilir; yetişmezse yalnızca güvenlik denetiminden geçmiş temel metin uyarıyla aktarılır. Ayar kapatılırsa bütçe 10 saniyedir. Dil düzeltme isteği tekrar edilmez. Ses tanımanın ağ/yeniden deneme politikası ayrıdır.
- Geç tamamlanan veya iptal edilmiş düzeltme mevcut metni değiştirmez. Ses tanıma modeli, MK/altyazı koruması, tutar/olumsuzluk denetimleri ve Enter ile kullanıcı gönderimi korunur.
- Küçük panelde son konuşma parçasının bitişinden editöre kadar yaklaşık aktarım süresi gösterilir. Gerçek sağlayıcı/Workspace gecikmesi için sabit süre garantisi yoktur.
- Anahtar, mikrofon izni, sözlük ve öğrenme tercihleri korunur. Önceki varsayılan 1 saniyelik bekleme 0,5 saniyeye taşınır; özel beklemeler korunur.

# 0.1.3 — Şüpheli diktenin yazı alanına aktarılmasını engelleme

15 Ekim 2026

- Bilinen altyazı/kapanış kalıpları, tek başına MK/M.K. varyantları ve sınırlı uygunsuz ifade denetimi. Şüpheli parçanın tamamı reddedilir; kelime silerek yeni anlam kurulmaz.
- Whisper segmentlerinin ortalama log olasılığı, sessizlik olasılığı ve sıkıştırma oranı denetlenir. Eksik ölçüm veya karışık düşük güvenli segment, otomatik aktarımı durdurur. Tamamen sessiz sonuç atlanır.
- Dil düzeltmesi ve editöre son aktarımda ek çıktı denetimi. Temiz temele şüpheli ifade ekleyen dil düzeltmesi kullanılmaz.
- Şüpheli tanımada mikrofon kapanır, mevcut yazı korunur; açıklama panelde görünür. Eski düzeltme uyarısının kritik hata mesajını gizlemesi düzeltildi.
- Ses parçasının sonundaki uzun sessizlik kırpılır; kelime sonları için 0,25 saniyelik kuyruk korunur. Mikrofon güçlendirme ve hassasiyet ayarları korunur.
- Ek bir bulut çağrısı veya bekleme yoktur. Küçük panel, kırmızı nokta, Win + H yönlendirmesi, anahtar ve sözlük korunur.
- Koruma bütün ses tanıma/özel isim hatalarını sıfırlamaz; gerçek mikrofonda kabul testi gerekir.

# 0.1.2 — Küçük kontrol paneli ve sessiz sayfa görünümü

15 Ekim 2026

- Sayfadaki geniş kontrol çubuğu kaldırıldı. Dinleme veya metin hazırlanırken sağ üstte yalnızca 10 px kırmızı nokta görünür; tıklamaları engellemez.
- Logolu küçük panel yalnızca eklenti simgesine tıklanınca açılır. Başlat/Durdur, geri al, ayarlar, süre/seviye ve geçici son dikte kopyası buraya taşındı. Panelin kapanması dikteyi durdurmaz.
- Chrome'un Win tuşu kısıtı nedeniyle doğrudan komut Alt + H olarak korunur. Win + H için yalnızca Chrome öndeyken çalışan AutoHotkey v2 yardımcısı ve mevcut FastKeys ile eşleştirme yönergesi eklendi.
- Windows yardımcısı otomatik kurulmaz/başlatılmaz; başlangıç veya kayıt defteri değişikliği yapmaz. Windows/FastKeys ilk kabul testi kullanıcının cihazında yapılmalıdır.
- Konuşma modeli, ses güçlendirme, gecikme yönetimi, saklanan anahtar ve sözlük korunur.

# 0.1.1 — Bağlantı bekleme ve mikrofon güçlendirme

15 Ekim 2026

- Geçici ağ/sunucu hataları için iptal edilebilir, en fazla 3 deneme; her denemede 45 saniye yanıt süresi. Her yeniden deneme ücretsiz kota sayacına girer. Kota/anahtar hatalarında tekrar yoktur.
- Sıralı ses tamponu; uzun beklemede kayıt durdurularak mevcut ses tamamlanır. Bekleyen ses yaklaşık 2 dakikayla sınırlanır. İptal, sohbet değişimi ve geç yanıt korumaları korunur.
- Oturum ve parça kimliğiyle yinelenen metin aktarımını engelleme; işlem sırasında Enter koruması.
- %135 varsayılan mikrofon güçlendirme, %100–200 ayar ve yüksek sesleri yumuşak sınırlama. Ham ses üzerinden konuşma algılama ve daha hassas 0,005 varsayılan eşik.
- Yerel mikrofon testinde seçilen güçlendirme ve konuşma algısının gösterilmesi.
- Anahtar/sözlük/izinleri koruyan ses ayarı geçişi. Eski varsayılan eşik güncellenir; diğer özel eşikler korunur.
- Gecikme, zaman aşımı, yeniden deneme sırasında iptal, dolan tampon ve ses kazancı için ek testler.

# 0.1.0 — İlk kurulum sürümü

15 Ekim 2026

- Hızır Bey logosu, koyu/altın arayüz, kısa yol kartı ve üç adımlı kurulum.
- Alt + H ile mikrofonu başlatma/durdurma; aktif LiveChat Lexical editörüne aktarım.
- Türkçe Whisper Large v3 / Turbo ve isteğe bağlı kontrollü Türkçe yazım/noktalama düzeltmesi.
- Free hesap onayı; ücretsiz kota hatasında durma. Başka sağlayıcı, plan yükseltme veya ödeme işlemi yok.
- Kullanıcının Enter / Send eyleminde oturumu bitirme; geç yanıtları reddetme.
- İç not, farklı görüşme, değişmiş editör ve kullanıcının elle düzenlediği metin için koruma.
- Yerel mikrofon testi, mikrofon seçimi, hassasiyet ve cümle sonu aralığı.
- Özel terim sözlüğü, isteğe bağlı yerel düzeltme hafızası ve anahtar içermeyen JSON yedeği.
- Ayrı eklenti kimliği; mevcut Sohbet Asistanı / RAM Takip ayarlarına erişmez.

## İlk sürümün sınırları

- Canlı müşteri görüşmesinde veya kullanıcının kendi mikrofonuyla doğruluk ölçümü yapılmış sayılmaz. İlk deneme test görüşmesinde yapılmalı.
- Web Speech'e otomatik geçiş, profesyonelleştirme modu ve sesle düzenleme komutları bu sürümde yoktur.
- Aktif dikteyi Alt + H ile tamamen bitirdikten sonra yapılan elle düzeltmeler otomatik öğrenilmez. Aktif kayıt sırasında Enter ile gönderilen düzenlemeler, öğrenme açıksa yerel örnek olur.
- Free planını anahtardan güvenilir biçimde doğrulayamayız; hesap panelinde kullanıcı kontrolü gerekir.
- Eklenti ses kaydı tutmaz. Son dikte kurtarma kopyası geçici oturum belleğindedir.
