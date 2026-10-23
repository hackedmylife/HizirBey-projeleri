# Doğrulama — 0.2.0

23 Ekim 2026. Akış: **yerel metin kutusu → kullanıcı bitirir → LiveChat yazı alanına otomatik aktarım**.

- **58 Windows kontrolü:** yerel panel açılışı; 100 fiziksel piksel yükseklik; görseldeki alan için 930 piksel genişlik; kontrol sınırları/çakışmama; Türkçe Unicode pano; gerçek yerel alana tek yapıştırma; yapay Enter olmaması; taslak korunması; odak yarışı; kapalı hedef; köprü oturum kimliği, hazır/aktarılabilir durumu ve onay zaman aşımı.
- **31 gerçek Chromium kontrolü:** yerel dikte sürerken LiveChat alanının değişmemesi; hazırlama ile metin eklemenin ayrılması; tamamlanan metnin yazı alanına eklenmesi; önceki metnin korunması; arama alanına odak kaymışken doğru mesaj alanına yönlendirme; sohbet kimliği değişimi; elle düzenlenmiş taslak; iç not ayrımı; sahte paste olayının reddi; textarea desteği; HTML'nin düz metin kalması; mesaj gönderim sayısının sıfır kalması.
- Ana AHK başlangıç dosyası ayrıca açılıp hatasız kapandı.
- JavaScript dosyaları sözdizimi kontrolünden geçti.
- Resmi AutoHotkey 2.0.30 arşivi ve paketteki x64 çalışma dosyası SHA-256 ile doğrulandı. Çalışma dosyası değiştirilmedi.
- Paket sabit dosya listesiyle hazırlanır; API anahtarı, token, kullanıcı taslağı, ses kaydı veya kişisel ayar içermez.

Kaynak commit: `c95ce10e66f9dbd77ccb9c8f2c140e5795da0b3f`.

[Windows ve Chromium doğrulama çıktısı](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39924734695).

Windows test ortamı Windows Server 2025 / 10.0.26100; tarayıcı ortamı bu runner'da yüklü Google Chrome'dur. Tarayıcı denemeleri gerçek müşteri görüşmeleri üzerinde değil, LiveChat'in bilinen yazı alanı seçicilerini kullanan denetimli bir sayfada yapıldı.

Gerçek Windows 11 Win+H mikrofon akışı, kurumun iki yönlü pano ilkesi ve tam ekran Amazon WorkSpaces üzerinden uçtan uca aktarım bu ortamda denenemedi. Son deneme kullanıcı bilgisayarında yapılacaktır. Uzantının yüklenebilirliği ve Ctrl+Shift+Y kısayolunun atanması kurulumda kontrol edilmelidir.
