# Doğrulama — 0.1.0

23 Ekim 2026. Deneme sürümü.

- Resmi AutoHotkey 2.0.30 ZIP SHA-256'sı upstream sürüm notlarıyla eşleştirildi.
- Paketteki değiştirilmemiş x64 EXE SHA-256'sı paketleme sırasında denetlenir.
- Paket sabit dosya listesiyle üretilir. Anahtar, token, ayar veya kullanıcı taslağı içermez.
- Windows Server 2025 (10.0.26100) üzerinde **39 kontrol geçti**. Başlangıç dosyası ayrıca açılıp hatasız kapandı.
- Doğrulananlar: WorkSpaces süreç kapsamı; diğer uygulamalarda varsayılan Win+H'nin korunması; Türkçe Unicode pano; gerçek yerel metin kutusuna tek Ctrl+V; yapay Enter olmaması; son kelimeleri bekleme; odak değişince aktarımın durması; kapalı hedefte taslak korunması; boş metnin panoyu değiştirmemesi; editör/düğme çakışmaması ve alt satırın görünürlüğü.
- Kaynak commit: `7539f2ddffd75e486e3ecff6a4fd89418c323d6e`.
- [Başarılı Windows doğrulaması ve test çıktısı](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39920555844).
- Gerçek Windows 11 Win+H mikrofon akışı, sessizlik davranışı ve tam ekran WorkSpaces aktarımı bu ortamda uçtan uca doğrulanmadı. Kullanıcı bilgisayarında denenecektir.
