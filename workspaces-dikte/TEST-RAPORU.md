# Doğrulama — 0.4.2

28 Ekim 2026. Durdur düğmesi ve ikinci Win+H, son tanıma güncellemelerini bekleyen mevcut noktalama işleminin ardından tamamlanan metni otomatik panoya kopyalar. Metin kutuda kalır. Kopyala / Ctrl+C korunur.

## Bu sürüm

Paket izin listesi ve sabitlenmiş resmi AutoHotkey çalışma dosyası SHA-256 kontrol edilir. Windows testleri önceki kontrolleri, Durdur ve Win+H ile otomatik kopyalamayı, son kelimeleri beklemeyi, boş metinde panoyu korumayı ve hemen yeniden başlatınca bekleyen kopyanın iptalini kapsar. **151 kontrol geçti: 129 uygulama kontrolü ve 22 bağımsız EXE kontrolü.** Windows çalışması başarılıdır: [40706003605](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/40706003605). Doğrulanan uygulama kaynağı commit'i `34e8c75faedd06fc3f108771490ddbe1ab1b0a6a`.

Durdur düğmesi ve Win+H sonrası otomatik pano, son kelimelerin dahil edilmesi, metnin görünür kalması, boş metinde eski panonun korunması ve hemen yeniden başlatınca bekleyen kopyanın iptali geçti. Mevcut Ctrl+C, noktalama, imleç/seçim, panel taşıma ve yerleşim kontrolleri de başarılıdır.

Tek EXE için 22 bağımsız kontrol geçti: yalnız EXE bulunan Türkçe karakterli klasörden açılma, gömülü görseller, gerçek kopyalama, tek örnek, X ve native kapatmada sürecin tamamen sonlanması, yeniden açılma ve geçici görsel temizliği.

Windows'ta derlenen ve test edilen EXE: 1.627.648 bayt, SHA-256 `050f49757ac6bc44153eec850d9d1760d60f79646107e4f9b4794a6fffc1e8af`. İndirilen artifact ZIP SHA-256, izin listesi, CRC ve çıkarılan EXE SHA-256 yerelde tekrar doğrulandı. Resmi AutoHotkey ve derleyici hash kontrolleri değişmedi. Kaynak ve paket içerikleri literal credential / özel anahtar desenleri için denetlendi.

## Sınırlar

Kaynak testlerinde yerel mikrofon başlatma / durdurma istekleri sayaçlarla değiştirilir. Gerçek Windows 11 mikrofon tanıması ve WorkSpaces bağlantısı kullanıcı ortamında denenmelidir. Otomatik yapıştırma veya mesaj gönderme yoktur. Noktalama temel yerel kurallarla çalışır.
