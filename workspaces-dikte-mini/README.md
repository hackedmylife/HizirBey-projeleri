# Hızır Bey · Mini Dikte 0.1.0

Eş için ayrı sürüm. Yerel Dikte 0.4.2'nin sesli yazma, noktalama, durdurunca otomatik kopyalama ve kısayol akışı korunur. Görünür pencere yalnız **212 × 100 piksel**: iki **160 × 40** düğme, üst sağda X ve altında durum noktası. Logo, başlık, durum satırı ve görünür metin alanı yoktur.

## Kullanım

1. Önceki Dikte programını X ile kapat; aynı bilgisayarda iki sürümün kısayolları çakışabilir.
2. **Hizir-Bey-WorkSpaces-Dikte-Mini-0.1.0.exe** dosyasına çift tıkla. Kurulum veya ayrı AutoHotkey gerekmez.
3. **Başlat / Win+H** ile yerel Windows diktesini aç. Windows'un Dinleniyor yazısını gördükten sonra konuş. Yedek kısayol **Ctrl+Alt+H**.
4. Dikte açıkken X'in altındaki nokta **kırmızı**, durdurulunca **yeşil** olur. Nokta uygulamanın Başlat/Durdur durumunu gösterir; Windows ses hizmetinin bağımsız olarak duraklamasını veya mikrofon arızasını ölçmez. Windows'un kendi araç çubuğu dinleme durumunda esas göstergedir.
5. **Durdur / ikinci Win+H** son kelimeleri bekler, temel noktalamayı tamamlar ve metni otomatik kopyalar. Genellikle yaklaşık bir saniye bekleyip doğru yazı alanında **Ctrl+V** kullan. Otomatik yapıştırma ve gönderme yoktur.
6. **Kopyala / Ctrl+C** tüm metni anında kopyalar; dinlemeyi kesmez. Dış uygulamalardaki Ctrl+C normal çalışır.
7. Yazı ekranda gösterilmez, yerel native giriş kutusunda bellekte tutulur. Devam edince mevcut taslağa eklenir. Yeni metin için panele tıklayıp **Ctrl+A → Delete** kullan. **Ctrl+Z** noktalama düzenlemesini geri alır.
8. Sağdaki boş şeritten (noktanın altından) sürükle. Bıraktığın konum hatırlanır. Mini sürümün konum dosyası bağımsızdır.
9. **X** bütün uygulama sürecini kapatır; yeniden çift tıklayarak açabilirsin. Başka AutoHotkey makroları kapatılmaz. Taslak kapanınca silinir.

Metin tanıma Windows / Microsoft hizmetidir; Windows 11 x64, mikrofon ve çalışan yerel Win+H gerekir. Uygulama ses kaydetmez, taslağı diske yazmaz, köprü veya API anahtarı kullanmaz. EXE yalnız tray simgesini geçici klasöre çıkarır; normal kapanışta temizler. Konum `%LOCALAPPDATA%\HizirBey\WorkSpacesDikteMini\panel.ini` içine yazılır. Kaynak ZIP ile çalıştırmak için tamamını çıkarıp BASLAT.cmd kullan.

Noktalama temel yerel kurallardır: Türkçe ilk harf, eksik nokta ve belirgin soru ekleri. Bağlamsal virgül üretmez; göndermeden önce yapıştırılan metni kontrol et. Boş metin eski panoyu silmez. Kopyalama hataları kısa bir bilgi balonuyla bildirilir; son durum tray simgesinin açıklamasında bulunur.

## Geliştirme

`python scripts/package.py --check` paket izin listesini ve resmi runtime hash'ini doğrular. `python scripts/package.py` kaynak ZIP üretir. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-exe.ps1` sabitlenmiş resmi Ahk2Exe ile tek EXE derler. Windows testleri `vendor\AutoHotkey64.exe /ErrorStdOut tests\windows-tests.ahk results.txt` ve `tests/compiled-tests.ahk` içindedir. Mikrofon çağrıları kaynak testinde sayaçlarla değiştirilir; gerçek Windows 11 diktesi kullanıcının bilgisayarında denenmelidir. Lisans GPL-2.0-or-later.
