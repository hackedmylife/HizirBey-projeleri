# Hızır Bey Sesli Yazma 0.1.0 — Doğrulama

15 Ekim 2026

| Kontrol | Sonuç | Kapsam |
| --- | --- | --- |
| Birim / DOM / oturum testleri | **33 / 33 geçti** | Türkçe düzeltme korumaları, WAV/VAD, iptal, anahtar erişimi, 10 MB yedek, hedef editör |
| ESLint | **Geçti** | Uygulama, testler ve JavaScript yardımcıları |
| Sözdizimi ve manifest | **Geçti** | Alt + H sözleşmesi, kaynaklar, dar host listesi ve kimlik bilgisi taraması |
| Chromium arayüz / editör | **13 kontrol geçti** | Logonun yüklenmesi, masaüstü/mobil taşma, form kaydı, metin ekleme, geç sonuç ve Enter davranışı |
| Gerçek MV3 uzantısı + sahte mikrofon / API | **11 kontrol geçti** | Offscreen AudioWorklet → ses isteği → düzeltme → editör → kullanıcının Enter'ı; tekrar başlatma, görüşme değişimi ve 429 |

Başarılı CI çalışması: [Sesli Yazma QA](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/38784953747).

Doğrulanan uygulama kaynak commit'i: `65c0d68dbc2b2b9bfac771bc314329be700d9d14`. Teslimdeki uygulama dosyaları bu kaynakla eşleştirilir; daha sonraki teslim commit'i yönerge, rapor ve kurulum arşivini ekler.

## Gerçek olarak doğrulananlar

- Chrome Manifest V3 uzantısı yüklenir; logolu ayarlar açılır, anahtar kaydı ve mikrofon izni akışı çalışır.
- Chrome offscreen belgesinde AudioWorklet mikrofon akışı işlenir. Test kaydı deterministik yapay sestir; canlı kullanıcı sesi değildir.
- Servis çağrıları özel test kopyasında taklit edilir. Gerçek API anahtarı veya ücretli/ücretsiz gerçek Groq tüketimi kullanılmaz. Ücretsiz kota/429 durumu taklitle sınanır.
- LiveChat URL'sine yerel test cevabı döndürülür. Gerçek müşteri veya gerçek müşteri hesabı açılmaz; mesaj gönderilmez.
- Üretim uzantısında test kancası veya taklit servis yoktur. Teste özel değişiklikler geçici kopyada kalır ve kurulum ZIP'ine girmez.
- İşlem sürerken Enter engellenir; sonradan otomatik gönderim olmaz. Kullanıcının gerçek klavye Enter'ı, hazır metni standart editörde gönderir ve oturum biter.
- Görüşme değiştiğinde geç gelen sonuç yeni alana yazılmaz. İç not ve elle değiştirilmiş metin kontrolleri editör testlerinde doğrulanır.
- 10 MB'a yakın hafıza JSON yedeği aynı kapasite sınırında yeniden içe alınır. Anahtar bu yedekte yoktur.

## Henüz ölçülmeyenler

- Kullanıcının kendi mikrofonunda Türkçe kelime hata oranı, şive/ortam gürültüsü ve gecikme.
- Güncel canlı LiveChat uygulamasının kendi Lexical durum yönetimiyle son kabul testi. Test sayfası gerçek editörün bilinen seçicilerini ve tarayıcı metin düzenlemesini kullanır; uygulamanın tüm iç mantığını çalıştırmaz.
- Gerçek Free Groq hesabının kişiye özgü kotaları, model erişimi veya canlı servis gecikmesi.
- Bütün tarayıcı/işletim sistemi kısayol çakışmaları. Alt + H manifest ve komut ataması olarak kontrol edilir; kullanıcının Chrome profilinde ayrıca kontrol edilir.

İlk kullanımda kontrollü test görüşmesinde kısa bir cümle dene. Tutar, özel ad ve işlem durumunu göndermeden önce oku. Bu rapor yüzde 100 doğruluk iddiası değildir.

## Paket kontrolü

Kurulum arşivi yalnızca uzantı dosyaları ve dört yönerge/rapor belgesi içerir. Paketleme betiği uzantı kaynaklarını ve ZIP içeriğini kimlik bilgisi desenleri için tarar; ZIP CRC kontrolü ve SHA-256 özeti üretir. Anahtar, token dosyası, oturum, kullanıcı hafızası, test profili veya ses dosyası paketlenmez.
