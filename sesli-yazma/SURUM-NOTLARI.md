# 0.1.9 — Arka plan müziği tetiklemelerini azaltma

18 Ekim 2026

- Varsayılan açık yerel konuşma denetimi: pakete dahil 15 KB WebRTC/libfvad WASM ve sürekli tek ton kontrolü, yalnızca RMS yüksekliğiyle konuşma sayan akışın önüne eklendi. İşlem cihazda yapılır; yeni ücretli servis / CDN veya model indirmesi yoktur.
- Arka planı ölç · 2 sn ve Ölçümü sıfırla kontrolleri eklendi. Müzik çalarken konuşmadan ölçülen seviye, arka planın üstündeki yakın konuşma için başlangıç eşiği sağlar. Ses tutulmaz; seviye ve mikrofon kimliği saklanır. Farklı mikrofonun eski ölçümü uygulanmaz.
- Koruma açıkken otomatik mikrofon kazancı istenmez. Normal yankı / gürültü bastırma istenir; giriş gerçekten destekliyorsa tüm yerel çalım için yankı giderme denenir. Desteklenmezse normal giderme kalır. Sistem sesi / ekran yakalanmaz, yeni host izni yoktur.
- Sessizlik süresi gerçek konuşma kararına göre işler; yalnızca yüksek müzik oturumu canlı tutmaz. Normal bitirmede son eksik 20 ms kare sıfırla tamamlanarak işlenir. Geri yazdırma, noktalama, anahtar, sözlük, kısayol ve 20 px merkez noktası korunur.
- Koruma, şarkıcıyı / başka konuşmacıyı kullanıcıdan kesin ayırmaz ve aynı anda konuşma içindeki müziği bütünüyle çıkarmaz. Yüksek arka plan için yakın kulaklık mikrofonu önerilir. Gerçek kullanıcının müziği ve mikrofonunda kabul testi gerekir.
- WASM, lisans / patent / atıf ve kaynak bilgileriyle sabit sürüm olarak paketlenir. Testlerde yalnızca kamuya açık ses örneği ve oluşturulmuş müzik sinyalleri kullanılır.

# 0.1.8 — Son dikteyi yeniden yazdırma

18 Ekim 2026

- Kontrol paneline Yeniden yazdır düğmesi eklendi. Son dikte aynı görüşmenin yazı alanına yerleştirilir; mevcut aynı metin ikinci kez eklenmez. Alan boşaltılmışsa veya dikte geri alınmışsa geri getirilebilir. Elle yazılmış farklı dolu metin korunur.
- İşlem yalnızca kullanıcının düğmeye basmasıyla başlar; önce dinleme ve bekleyen ses kapanır. Ek API çağrısı veya yeni ses tanıma yapılmaz; mevcut son metin geri konur. Kullanıcının gerçek Enter basışı gönderir.
- Son diktenin görüşme bağı, normal durdurmada ve servis işçisinin uyku / uyanmasında korunur. Gönderim, görüşme / sekme / sayfa değişimi ve yeni dikte bağı geçersiz kılar. Geç ses sonucu yeniden eklenmez.
- Son metin ve bağ yalnızca güvenilir chrome.storage.session alanındadır. Kalıcı ses saklanmaz. Anahtar, sözlük, logo, kısayol ve merkezdeki 20 px nokta korunur.

# 0.1.7 — Kısmi tanımada tekrar birikmesini ve üç ret sonrası durmayı düzeltme

18 Ekim 2026

- Kısa duraklarla süren aynı konuşmanın sesleri, en fazla 12 saniyelik tanıma penceresinde birleştirilir. Güncel sonuç yalnızca o pencerenin eski metnini yeniler; büyüyen kısmi tanımalar ayrı cümle gibi eklenmez. Gerçekte söylenen tekrarları benzer kelime diye silen bir metin filtresi kullanılmaz.
- Bağlantı gecikmesinde, aynı pencerenin henüz gönderilmemiş ara önizlemeleri en yenisiyle birleştirilir. Devam eden istek iptal edilip yeniden başlatılmaz. Aynı sesin tekrar değerlendirilen bağlamı da her isteğin ses kotasına sayılır. Ortak pencere kullanımı gerçek konuşma doğruluğu veya sabit gecikme garantisi değildir.
- Üç ret sonrası mikrofonu kapatan koşul kaldırıldı. Şüpheli bölüm yazılmaz; eksik bölüm sayısı ve ret nedeni gösterilir, dinleme sürer. Sonraki temiz ses yazılabilir. Aynı pencere daha fazla sesle temiz tanınırsa o pencerenin uyarısı kaldırılır; önceki pencerelerde atlanan bölümlerin uyarısı saklanır.
- Yüksek sessizlik olasılığı tek başına net tanınan konuşmayı reddetmez. Sıkıştırma oranı düşük güven veya belirgin tekrar döngüsüyle birlikte değerlendirilir. Eksik güven ölçümü, düşük çözüm güveni, MK/altyazı ve son aktarım korumaları sürer.
- Aynı metni döndüren önizleme editörü gereksiz yere yeniden yazmaz. Tamamlanan taslağın noktalama, kelime/sayı koruması, elle düzenleme, Enter, sekme/görüşme, süre ve kota sınırları korunur.
- 20 px merkez noktası, logo, Win + H yönlendirmesi, ayarlar, API anahtarı ve sözlük korunur. Gerçek kullanıcı sesiyle Türkçe doğruluk henüz ölçülmemiştir.

# 0.1.6 — Uzun dikte ve cümle tamamlanınca noktalama

18 Ekim 2026

- Her ses parçasına ayrı son nokta ekleyen akış kaldırıldı. Hızlı, noktalaması geçici taslak tek bir alanda birikir; her güncelleme önceki taslağın üstüne uygulanır, aynı metin tekrar tekrar eklenmez.
- Noktalama, en az 1 saniyelik durakta veya normal durdurmada bütün taslak üzerinden kontrol edilir. Ses parçası sınırı cümle sınırı sayılmaz. Yeni konuşma eski kontrolü iptal eder; geç gelen noktalama devam eden metni ezmez.
- Noktalama modelinin kelime ekleme, silme, sıralama veya değiştirmesi engellenir. Sayı, olumsuzluk ve işlem durumu denetimleri korunur. Uygun öğrenilmiş örnekler de aynı kelime koşuluyla sınanır.
- Tek bir şüpheli ses parçasında mikrofon hemen kapanmaz; o parça yazılmaz ve tekrar söyleme uyarısı verilir. Art arda üç reddetmede kayıt güvenle kapanır. Son aktarım koruması uygunsuz metinde hemen durmaya devam eder.
- Noktalama bütçesi dolarsa taslak korunur; zorla nokta eklenmez. 0.1.4 hız ve bağlantı politikası korunur. Nokta veya virgül dinlemeyi bitirmez.
- Geri al mevcut dikte taslağını kaldırır ve tekrar eklenmesini önlemek için dinlemeyi kapatır. Oturum başındaki metin korunur. Elle düzenleme, görüşme değişimi, Enter ile kullanıcı gönderimi ve geç sonuç korumaları sürer.
- Taslak 8.000 karakterle sınırlandırılır; mevcut metin korunur. Merkezdeki 20 px nokta, logo, Win + H yönlendirmesi, anahtar ve sözlük korunur.
- Kontrollü testler gerçek kullanıcının ses kaydı yerine geçmez; ses tanımanın bütün kelime hatalarının sıfırlandığı iddia edilmez.

# 0.1.5 — Büyük kırmızı nokta ve tek Enter ile gönderim

18 Ekim 2026

- Ekranın ortasındaki kırmızı noktanın çapı 10 pikselden 20 piksele çıkarıldı. Merkez ve tıklamaları geçirme davranışı korunur.
- Dikte yazıldıktan sonra kullanıcının gerçek Enter basışı, bağlı görüşmenin etkin Gönder düğmesini bir kez çalıştırır. LiveChat’in Enter/satır ayarından bağımsızdır; uygulamanın genel ayarını değiştirmez.
- Gönderim, kullanıcının ekranda gördüğü taslağı esas alır. Mikrofon oturumu ve bekleyen dikte kapanır; geç sonuçlar sonradan eklenmez. Hazır taslak varsa devam eden dinleme veya yeni sesin sırada olması Enter’ı engellemez.
- Alt + H ile normal bitirilen diktenin hazır taslağında da Enter çalışır. Bu bekleme görünmezdir; mikrofon kapanır, nokta gizlenir. Görüşme değişimi, iptal veya hata durumunda bu bağ korunmaz.
- İlk metin gelmeden veya editör hâlâ yazarken Enter koruması devam eder. Otomatik/ertelenmiş gönderim yoktur. Shift + Enter satır açar; tuşu basılı tutmak çift göndermez.
- Eksik, kapalı veya birden fazla Gönder düğmesinde metin korunur ve açıklama gösterilir. Başka görüşmenin düğmesine yönlenmez.
- 0.1.4 hız ayarları, şüpheli dikte denetimleri, anahtar ve sözlük korunur.

# 0.1.4 — Daha kısa bekleme ve ekran ortasında kırmızı nokta

17 Ekim 2026

- Aktif dinleme ve metin hazırlamada tek 10 px kırmızı nokta tam ekran merkezindedir. Ekran boyutu değişince merkezde kalır; tıklamaları engellemez. Kontroller yalnızca eklenti simgesindedir.
- Varsayılan cümle sonu duraklama 1 saniyeden 0,5 saniyeye düşürüldü. Uzun konuşma kısa doğal duraklarda daha erken, yaklaşık 8 saniyede parçalanır.
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
