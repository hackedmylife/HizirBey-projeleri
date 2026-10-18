# Hızır Bey Sesli Yazma 0.1.7 — Doğrulama

18 Ekim 2026

| Kontrol | Sonuç | Kapsam |
| --- | --- | --- |
| Birim / DOM / oturum | **84 / 84 geçti** | Aynı ses penceresinin güncellenmesi, ret sonrası devam, bağlamla kurtarma, kota, iptal, noktalama, editör, hafıza ve anahtar |
| ESLint | **Geçti** | Uygulama, testler ve yardımcılar |
| Sözdizimi / manifest / kaynak taraması | **Geçti** | 22 uzantı dosyası, Alt + H, dar host listesi ve kimlik bilgisi desenleri |
| Chromium arayüz / editör | **36 kontrol geçti** | Tek taslak, mevcut metin, Enter / Shift + Enter, çift gönderim koruması, 20 px merkez noktası ve arayüz |
| Gerçek MV3 / sahte mikrofon ve API | **37 kontrol geçti** | Ses isteği, 503 / 26 saniye bekleme, kısmi tanıma yenileme, uzun dikte, dört ret sonrası açık mikrofon, Enter ve 429 |

CI: [Sesli Yazma QA](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39155775058).
Kaynak commit: `460b3f1432ed824c86aa9cc2b2ad993b9181fe96`.
CI günlüğünde 84 test, 36 arayüz ve 37 MV3 kontrolünün başarı satırları ayrıca okunarak doğrulanmıştır.
Teslimdeki 22 uygulama dosyası test edilen kaynakla bayt düzeyinde eşleştirilir. Teslim commit'i yalnızca raporları, kurulum açıklamasını, proje özetini ve paketi günceller.

## Yeni regresyon senaryoları

- Kısa duraklarla gelen üç kısmi tanıma, örneğin “örnek” → “örnek com” → “örnek com tr”, aynı bölümün metnini günceller. Üç tanıma art arda eklenmez. Gerçek MV3 testinde, baştaki metin korunurken üç güncelleme ve son noktalama tek alanda doğrulanır; Enter bir kez gönderir.
- Model önceki sonucu silme talimatı almaz. Aynı konuşmanın sesi, en fazla 12 saniyelik ortak pencerede yeniden tanınır. Ses örneklerinin sırası, pencere sınırı, değişmez eski örnekler ve durakta yeni pencere açılması birim testinde kontrol edilir. Gerçek söylenmiş “evet evet” ifadesi korunur.
- Geciken ses isteğinde üç eski ara önizleme sırada birikmez; aynı pencerenin yalnızca son önizlemesi tutulur. İki gönderilen istek iki kota rezervasyonu yapar. Gönderilen pencerenin tam ses süresi, tekrar değerlendirilen bağlam dahil, kotaya girer. Devam eden istek sırf konuşma sürdü diye yeniden başlatılmaz.
- Şüpheli sonuçta neden ve yazılamayan bölüm sayısı gösterilir. Dört ret sonrası mikrofon açık kalır, uygunsuz metin yazılmaz ve sonraki temiz ses yazılabilir. Daha fazla bağlamla aynı pencere temiz tanınırsa o pencerenin uyarısı kalkar; geçmiş pencerelerdeki eksiklikler görünür kalır.
- Net çözümün yalnızca yüksek sessizlik olasılığı veya sıkıştırma oranı nedeniyle reddedilmemesi kontrol edilir. Eksik / geçersiz ölçüm, düşük çözüm güveni, düşük güvenle birleşen yüksek sıkıştırma ve belirgin tekrar döngüsü reddedilir. Karışık güvenilmez bölümü silip kalanını yazma yapılmaz.
- Aynı metni döndüren önizleme gereksiz editör yazımı oluşturmaz. Bütün taslak üzerinde noktalama, kelime / sayı koruması, yeni konuşmada eski düzeltmeyi iptal, zaman bütçesi ve elle düzenlemeyi koruma testleri sürer.

## Korunan davranışlar

- MK / altyazı / uygunsuz kalıp denetimleri, dil düzeltmesi ve son aktarım denetimi sürer. Son aktarım sınırında uygunsuz metin oturumu kapatır.
- Kullanıcının gerçek Enter basışı bağlı görüşmenin Gönder düğmesini bir kez çalıştırır; mikrofon kapanır ve geç sonuç eklenmez. Normal durdurmadan sonra da Enter çalışır. İlk sonuç öncesi basılan Enter sonradan gönderime dönüşmez; Shift + Enter göndermez.
- Görüşme / sekme / sayfa değişimi, iç not modu ve elle düzenleme korumaları sürer. Önceden yazılmış metin korunur. Geri al mevcut dikteyi kaldırır ve mikrofonu kapatır.
- 503 sonrası ikinci istek 26 saniye kasıtlı bekletilir; çift yazım / erken gönderim olmaması ve Enter sonrası offscreen bağlamının kapanması kontrol edilir. Bu, gerçek Groq gecikme ölçümü değildir. 429 tekrar edilmez ve ücretli sağlayıcıya geçilmez.
- Yerel dakikalık kota beklemesi iptal edilebilir. Günlük / ses kotası, yaklaşık 106 saniyelik işlenen ve sıradaki pencere sınırı, 90 saniye sessizlik, 15 dakika oturum ve 8.000 karakter sınırı sürer. Tekrar değerlendirilen ses bağlamı da bekleme sınırına dahildir.
- Anahtar, mikrofon izni, sözlük ve öğrenme tercihi güncellemede korunur. Hafıza yedeği anahtar içermez. Öğrenilmiş noktalama örnekleri aynı kelime korumasından geçer.

## Doğrulamanın sınırları

- Gerçek kullanıcı sesi, gerçek Groq anahtarı veya müşteri görüşmesi kullanılmaz. LiveChat adresinde yerel test sayfası vardır; gerçek müşteriye mesaj gönderilmez. Uzun ve kısmi tanıma senaryoları test kopyasının Segmenter'ına yapay PCM verir; diğer senaryolar gerçek offscreen AudioWorklet ve tarayıcının sahte mikrofonunu kullanır. Test kancası dağıtıma girmez.
- Paylaşılan ekran görüntüsü, kullanıcının o anda ne söylediğini ve sağlayıcının ret ölçümlerini içermez. Büyüyen kısmi tanıma senaryosu kontrollü testte yeniden üretilir; aynı ses kaydıyla olayın yeniden üretildiği iddia edilmez.
- Türkçe kelime doğruluğu, özel isimler, şive, gürültü, gerçek Free hesabının gecikmesi / kotası ve Workspace kesintileri cihazda son kabul testi gerektirir. Ortak ses penceresi ek bağlam sağlar; hatasız kelime veya sabit gecikme garantisi vermez. Sert pencere sınırlarında tüm kelime kesilmelerinin giderildiği iddia edilmez.
- Noktalama koruması ses tanımanın bütün kelime hatalarını yakalamaz. Durak, anlam bakımından cümle sonunu kanıtlamaz; modelin bütün nokta / virgülleri kusursuz yerleştirmesi garanti edilmez.
- Canlı LiveChat Lexical durum yönetimi ve fiziksel Windows Win + H / FastKeys / AutoHotkey yönlendirmesi bu Linux kontrollerinde sınanmaz.

## Paket

Arşiv 22 uzantı dosyası, dört yönerge / rapor ve iki Windows dosyası içerir. Kaynak ve ZIP içeriği kimlik bilgisi desenleri için taranır; CRC ve SHA-256 kontrol edilir. Ses, test profili, kullanıcı anahtarı / hafızası veya test kancası paketlenmez.
