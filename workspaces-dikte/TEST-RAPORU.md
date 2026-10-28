# Yerel Dikte 0.4.3 doğrulama

28 Ekim 2026. Durdur / ikinci Win+H son kelimeleri bekler, noktalamayı tamamlar ve panoya kopyalamayı doğruladıktan sonra metin kutusunu temizler. Kopyala / Ctrl+C metni silmez. Kopyalama başarısızsa veya kopyalama sırasında yeni metin geldiyse taslak korunur. Mini sürüm değişmedi.

Paket izin listesi, resmi AutoHotkey runtime hash'i ve arşiv içerikleri denetlenir. Windows kontrolleri otomatik kopyalama sonrası temiz kutuyu, sonraki diktenin boş başlamasını, son kelimeleri, hata halinde metni korumayı ve manuel kopyalamanın silmemesini kapsar. **157 Windows kontrolü geçti: 135 uygulama + 22 bağımsız EXE kontrolü.**

[Başarılı Windows çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/40709398026). Doğrulanan uygulama kaynağı commit'i `916e1f99d9354631546f4ce1273117fb8aef9460`.

Durdur düğmesi ve Win+H ile başarılı kopyadan sonra kutunun boşalması, sonraki diktenin boş başlaması ve imlecin başa dönmesi doğrulandı. Sonradan tamamlanan kelimeler ve Türkçe noktalama kopyaya dahil edildi. Boş kutuda durdurmanın sonradan girilen yeni metne dokunmaması, hata halinde tamamlanan taslağın korunması, manuel kopya tekrarının metni silmemesi ve kopyalama sırasında gelen yeni metnin korunması geçti.

Tek EXE, boşluk ve Türkçe karakterli bağımsız klasörde açılma, gömülü varlıklar, gerçek Ctrl+C/Kopyala, tek örnek, X ve native kapatma ile sürecin tamamen kapanması, yeniden açılma ve geçici varlık temizliği dahil 22 kontrolü geçti. Mevcut yerleşim, tema, kısayol ve konum kontrolleri başarılıdır.

Dağıtılan EXE: **1.627.648 bayt**, SHA-256 `3dbb7b2083a37d05cf70445bc68785067e7d969b3ebb562648213bcacbaad407`. Artifact ZIP hash'i, CRC ve izin listesi; çıkarılan EXE hash'i/boyutu/x64 mimarisi yeniden doğrulandı. Sabitlenmiş resmi AutoHotkey/Ahk2Exe hash'leri korunur. Kaynak, kaynak ZIP ve EXE literal credential/özel anahtar desenleri için tarandı.

Gerçek Windows 11 mikrofon tanıması ve WorkSpaces bağlantısı otomatik denenmez. Kaynak testlerinde mikrofon istekleri sayaçlarla değiştirilir. Pano hatası ve kopyalama esnasında gelen yeni kelime ayrı hata enjeksiyonlarıyla doğrulanır. Gerçek Windows panosu, yerel kısayollar, fare, taşıma, yerleşim ve tek EXE yaşam döngüsü test edilir. Otomatik yapıştırma veya mesaj gönderme yoktur. Metni temizleme geri alma geçmişini sıfırlar; kopyalanmış metin panoda kalır.
