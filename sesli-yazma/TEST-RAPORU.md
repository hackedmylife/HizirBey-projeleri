# Hızır Bey Sesli Yazma 0.1.8 — Doğrulama

18 Ekim 2026

| Kontrol | Sonuç | Kapsam |
| --- | --- | --- |
| Birim / DOM / oturum | **89 / 89 geçti** | Geri yazdırma, tekrar / elle düzenleme / görüşme koruması, geç sonuç, worker yeniden başlatma, dikte, kota, hafıza ve anahtar |
| ESLint | **Geçti** | Uygulama, testler ve yardımcılar |
| Sözdizimi / manifest / kaynak taraması | **Geçti** | 22 uzantı dosyası, Alt + H, dar host listesi ve kimlik bilgisi desenleri |
| Chromium arayüz / editör | **47 kontrol geçti** | Yeni düğme, boş alanı geri doldurma, art arda yazdırma, elle düzenleme, Enter, görüşme ve 20 px merkez noktası |
| Gerçek MV3 / sahte mikrofon ve API | **43 kontrol geçti** | Mikrofon, gecikmeli ASR, yerel geri yazdırma, değişmeyen API kullanım sayacı, Enter, uzun dikte, ret sonrası devam ve 429 |

CI: [Sesli Yazma QA](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39156711355).
Kaynak commit: `eed51c8ebab5e768f8fb37c5f7811a8aa1dd9238`.
Başarı satırları CI günlüğünden ayrıca okunmuştur: 89 test, 47 arayüz ve 43 MV3 kontrolü.
Teslimdeki 22 uygulama dosyası bu kaynakla bayt düzeyinde eşleştirilir. Son teslim commit'i yalnızca rapor, proje özeti ve kurulum paketini günceller.

## Yeniden yazdır

- Paneldeki düğme, son dikteyi aynı görüşmenin mesaj alanına geri koyar. Yeni ses tanıma / dil düzeltmesi veya ek API çağrısı yapmaz. Dikte hazırlanırken devre dışıdır. Tıklama dinlemeyi ve bekleyen sesi kapatır; geç ses yanıtı eklenmez.
- Metin zaten yazı alanındaysa yeniden eklenmez. Boşaltılmış alan ve geri alınmış dikte geri getirilebilir. Geri alma sonrası başlangıç metni korunur; kullanıcı alanın tamamını bilerek silmişse o başlangıç metni geri getirilmez.
- Elle yazılmış farklı dolu metin değiştirilmez. Kullanıcı alanı boşaltabilir veya son dikteyi panelden kopyalayabilir. Görüşme / sekme / sayfa değişimi ve yeni dikte önceki yazdırma bağını geçersiz kılar.
- Geri yazdırma kendiliğinden göndermez. Kullanıcının gerçek Enter basışı aynı görüşmenin Gönder düğmesini bir kez çalıştırır. Gönderim sonrası düğme devre dışı kalır; eski mesaj yeniden yazdırılamaz. Shift + Enter davranışı korunur.
- Gerçek MV3 testinde metin hazırken, alan boşaltıldıktan sonra ve art arda yeniden yazdırma denenir. Editör içeriği doğrulanır; API kullanım sayacı tamamen aynı kalır. Enter bir kez gönderir ve eski dikte bağı kapanır.
- Servis işçisinin yeniden başlatılması birim testinde taklit edilir: geçici son metin ve görüşme bağı geri yüklenir; kayıt açılmaz. Chrome'un gerçek otomatik worker askıya alma döngüsü bu senaryoda zorlanmamıştır.
- Yeni düğmenin etkin / kapalı halleri ve tek RPC üretmesi Chromium'da sınanır. Hazır panel ekran görüntüsü açılarak logo, düğme ve alt metnin yerleşimi kontrol edilmiştir.

## Korunan kontroller

- 0.1.7'nin aynı ses penceresinde kısmi tanıma yenilemesi, geciken ara önizlemeleri birleştirmesi, gerçek sözel tekrarları koruması ve dört ret sonrasında dinlemeye devam etmesi sınanır. MK / altyazı, düşük güven, kelime / sayı ve son aktarım denetimleri sürer.
- Bütün taslak üzerinde son noktalama, yeni konuşmada iptal, zaman bütçesi, önceki metni koruma, iç not / farklı görüşme / elle düzenleme, gerçek Enter ve geç yanıt korumaları sürer.
- 503 sonrası ses isteği 26 saniye kasıtlı bekletilir. Çift yazım ve erken gönderim oluşmaması kontrol edilir. Bu süre gerçek servis gecikmesi ölçümü değildir. 429 tekrar edilmez; ücretli sağlayıcıya veya plana geçilmez.
- Yerel kota, bekleyen ses, süre ve taslak uzunluğu sınırları korunur. Anahtar, izinler, sözlük, öğrenme tercihi ve yedek anahtar dışlama kontrolleri sürer.

## Sınırlar ve paket

Gerçek kullanıcı sesi, gerçek Groq anahtarı veya gerçek müşteri görüşmesi kullanılmaz. Testler yerel LiveChat benzeri editör, yapay PCM, tarayıcının sahte mikrofonu ve sahte API yanıtlarını kullanır. Yeni düğme, önceden tanınmış son metni geri koyar; konuşmanın doğru anlaşıldığını ayrıca doğrulamaz. Türkçe kelime doğruluğu, canlı Lexical editörünün kendi durumu, Workspace kesintileri ve fiziksel Windows Win + H yönlendirmesi cihazda son kabul testi gerektirir.

Arşiv 22 uygulama dosyası, dört yönerge / rapor ve iki Windows dosyası içerir. Tüm arşiv içeriği kaynakla eşleştirilir; kimlik bilgisi desenleri, CRC ve SHA-256 kontrol edilir. Kullanıcı anahtarı / hafızası, ses, test profili ve test kancaları paketlenmez. Son metin / görüşme bağı yalnızca güvenilir geçici tarayıcı oturumunda tutulur.
