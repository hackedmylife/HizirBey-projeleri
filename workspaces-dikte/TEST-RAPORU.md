# Doğrulama — 0.3.0

23 Ekim 2026. Yalnız yerel sesli yazma ve elle kopyalama sürümü.

**63 Windows kontrolü geçti.**

- Gerçek dağıtım giriş betiği testlere dahil edildi; aynı Win+H ve Ctrl+C tanımları, ayrı bir süreçten üretilen klavye olaylarıyla çalıştırıldı.
- Win+H yerel dikte başlatma isteğine yönlendi. İkinci Win+H ve büyük Durdur düğmesi durdurma isteğine yönlendi; taslak görünür kaldı ve otomatik kopyalanmadı.
- Dikte etkin görünürken gerçek Ctrl+C, kısmi seçim bulunmasına rağmen kutunun tamamını Windows panosuna aldı. Türkçe karakterler, paragraf, boşluk ve noktalama korundu; başlatma / durdurma isteği üretilmedi. Seçim ve imleç yeri korunurken dikte etkin kaldı.
- Sonradan gelen kelimeler panodaki önceki kopyayı kendiliğinden değiştirmedi; sonraki Ctrl+C yeni tam metni aldı.
- Büyük Kopyala düğmesi gerçek fare tıklamasıyla çalıştı ve odağı metin kutusuna döndürdü.
- Başlatma / durdurma, taslağı ve yazma konumunu korudu. Başlatma panoya dokunmadı; boş kutuda kopyalama eski panoyu korudu.
- Yerel işlem meşgulken de Ctrl+C anında kopyaladı. Başka uygulamada Ctrl+C normal seçili metni kopyaladı; yerel taslak değişmedi.
- Ayrı bir alıcı pencerenin metni bütün başlat / durdur / kopyala akışı boyunca değişmedi.
- Panelde tam olarak iki düğme olduğu doğrulandı. 600, 930 ve 1080 piksel genişliklerde tüm kontroller 100 piksel yüksekliğindeki panel içine sığdı. Sağdaki düğmeler 160 × 40 piksel; metin kutusuyla örtüşmedi.
- Gerçek fare basma / hareket / bırakma ile başlıktan sürükleme, X/Y konumunu INI dosyasına yazma, yeni örnekte aynı konuma dönme ve taslağı koruyarak konumu sıfırlama kontrolleri geçti.
- Dağıtım giriş betiği ayrıca açılıp hatasız kapandı. Resmi taşınabilir AutoHotkey çalışma dosyasının SHA-256 değeri doğrulandı.

[Başarılı Windows çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39947116924).

Doğrulanan kaynak commit: `edfcef85f62535fa81d410bbd99d0fd9dfa33b25`.

Test ortamı Windows Server 2025 / 10.0.26100'dür. Windows 11 mikrofon tanıması test ortamında çalıştırılmadı; yerel mikrofon başlatma ve durdurma istekleri sayaçlarla değiştirildi. Pano, kısayollar, düğmeler ve fare hareketleri gerçek Windows kontrolleri üzerinde test edildi. Kullanıcı bilgisayarında çalışan Win+H / mikrofon gereklidir.

Yeni kaynak ve ZIP içinde Chrome köprüsü, görüşme doğrulaması, kontrol kodu alışverişi ve otomatik yapıştırma akışı yoktur. Önceki Chrome köprüsü kullanıcı tarafından kapatılmalı / kaldırılmalı, açık LiveChat sekmesi yenilenmelidir. Paket 14 izinli dosya içerir; ses, taslak, ekran görüntüsü, panel.ini, token ve API anahtarı içermez.
