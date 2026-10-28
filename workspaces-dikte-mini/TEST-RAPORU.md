# Mini Dikte 0.1.0 doğrulama

28 Ekim 2026. Yerel Dikte 0.4.2 tabanından ayrı ürün klasörü, EXE, ayar konumu ve test akışı oluşturuldu. Ana sürüm değiştirilmedi.

Paket izin listesi ve resmi AutoHotkey 2.0.30 x64 SHA-256 denetlenir. Windows testleri mini yerleşim, native girişin gerçek tuş kabulü, kırmızı/yeşil nokta, pano, noktalama, otomatik kopyalama, konum kaydı ve tam kapanmayı kapsar. **137 Windows kontrolü geçti: 113 uygulama kontrolü + 24 bağımsız EXE kontrolü.**

[Başarılı Windows çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/40707673541). Doğrulanan uygulama kodu commit'i: `785e4d01cac36f524b60ec369c90ecca9cfcf7d3`.

- Pencere 212 × 100, ana düğmeler 160 × 40 piksel. Logo, başlık ve durum yazısı kontrolü yoktur. Native metin hedefi görünür/enabled/focusable stilini korur, viewport'u 1 × 1 pikseldir. Gerçek klavye girdisi ve Ctrl+A/Delete bu hedefte doğrulandı.
- Kırmızı ve yeşil noktalar Windows PrintWindow görüntülerinde merkez piksel rengiyle doğrulandı. İki gerçek görüntü `docs` klasöründedir; görsel olarak da incelendi.
- Durdur ve ikinci Win+H sonrası otomatik pano, son kelimeleri bekleme, Türkçe noktalama, Ctrl+C ile bütün taslağı alma ve dikteyi sürdürme, boş metinde panoyu koruma, yeniden başlatınca bekleyen işlemi iptal etme geçti. Dış uygulamanın Ctrl+C'si ve metni korundu; otomatik yapıştırma/gönderim yoktur.
- Sağ boş şeritten gerçek fareyle sürükleme, bağımsız konum dosyası ve yeniden yükleme geçti.
- Tek EXE yalnız kendisinin bulunduğu boşluk ve Türkçe karakterli klasörden açıldı. Gömülü tray simgesi, görünür logo olmaması, gerçek native klavye girdisi, Ctrl+C ve Kopyala doğrulandı. İkinci açılış taslağı korudu. X ve native kapatma bütün süreci sonlandırdı; tekrar açılma ve geçici simge temizliği geçti.

Windows'ta derlenmiş ve test edilmiş EXE: **1.471.488 bayt**, SHA-256 `c435a379dc136fc5e37a4df98063450672826a2c73e150a549266223d03d1608`. İndirilen iki artifact ZIP'in SHA-256, yol izin listesi ve CRC'si, çıkarılan EXE'nin hash ve boyutu yeniden doğrulandı. Resmi AutoHotkey/Ahk2Exe hash sabitlemeleri korunmuştur. Kaynak, arşiv ve EXE literal credential / özel anahtar desenleri için tarandı.

Gerçek Windows 11 mikrofon tanıması ve tam ekran WorkSpaces kullanımı otomatik denenmez; kaynak testinde ses başlatma/durdurma istekleri sayaçlarla değiştirilir. Mini panelde odaklanabilir bir native Edit kontrolü 1 × 1 pikseldir; taslak görünmez, Windows metin giriş hedefi korunur. Bu yeni giriş yerleşimi gerçek Win+H ile kullanıcı bilgisayarında doğrulanmalıdır. Nokta uygulamanın başlat/durdur durumudur, ses hizmetinin bağımsız duraklamalarını veya mikrofon akışını ölçmez.
