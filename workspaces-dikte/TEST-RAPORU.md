# Doğrulama — 0.2.1

23 Ekim 2026. Boş yerel kutudan Win+H başlangıcı düzeltildi; açık Taşı tutamacı ve kalıcı konum eklendi.

**75 Windows kontrolü ve 31 Chromium kontrolü geçti.**

Yeni regresyon denemeleri:

- Boş yerel panelde ilk kısayol dikte başlangıcına yönlenir; ikinci kısayol bitirme işlemine yönlenir.
- Tamamlanmış yerel panelden yeni dikte başlatılır; önceki metin kurtarılabilir kalır.
- Hedef pencere bulunamaması veya köprü yanıtının gelmemesi yerel dikte başlangıç isteğini engellemez.
- Ayrı bir test süreci gerçek fare basma / hareket / bırakma olaylarıyla Taşı tutamacını sürükledi. Pencere 60 × 35 piksel hareket etti.
- Hareket bitince gerçek pencere koordinatları geçici INI dosyasına kaydedildi. Yeni uygulama örneği aynı konumu geri yükledi.
- Konum sıfırlama taslak metni korudu. Panel ve bütün düğmeler 100 piksel yüksekliğindeki şerit içinde kaldı.
- Mevcut Unicode pano, odak yarışı, kapalı hedef, taslak korunması ve köprü oturum kimliği kontrolleri geçti.
- Chromium'da tamamlanmış metnin LiveChat alanına eklenmesi, mevcut metnin korunması, değişmiş görüşme / taslak kontrolü ve mesaj gönderim sayısının sıfır kalması doğrulandı.

[Başarılı Windows ve Chromium çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39928863276).

Doğrulanan kaynak commit: `a42f9cd5dc7c816442f327647b8663795559c4c0`.

Test ortamı Windows Server 2025 / 10.0.26100 ve yüklü Chrome'dur. Başlangıç yönlendirme testlerinde mikrofon yerine başlangıç isteğini sayan test sınıfı kullanıldı; ana başlangıç dosyası ayrıca açılıp hatasız kapandı. Gerçek Windows 11 Win+H mikrofon akışı ve kurumun tam ekran WorkSpaces bağlantısı kullanıcı bilgisayarında tekrar denenmelidir.

LiveChat köprüsü 0.2.0 protokolüyle uyumludur; mevcut köprü bu masaüstü güncellemesiyle kullanılabilir. Yalnız panel koordinatları kullanıcı bilgisayarındaki panel.ini dosyasında tutulur; taslak, ses, token veya API anahtarı pakete eklenmez. Resmi AutoHotkey çalışma dosyası SHA-256 ile doğrulanır.
