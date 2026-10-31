# Mini Dikte 0.1.1 doğrulama

1 Kasım 2026. **145 Windows kontrolü geçti: 121 uygulama kontrolü + 24 bağımsız EXE kontrolü.**

[Başarılı Windows derleme ve test çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/41252370994). Test edilen kaynak commit'i: `948d5d38c6c6aff8bf03de5667856f856e627781`. [Kontrol sonuçları](docs/windows-0.1.1-results.txt).

- Durdur / ikinci Win+H sonrası son kelimeler beklenir, temel Türkçe noktalama uygulanır, metin panoya yazılıp doğrulanır, ardından gizli native edit temizlenir.
- Ctrl+Z önceki temizlenen oturumu geri getirmez. Sonraki dikte boş kutuyla başlar.
- Hızlı Stop -> Start önce eski oturumun kopyalanmasını ve temizlenmesini tamamlar; sonra yeni oturum açılır.
- Simüle edilen pano hatasında taslak ve önceki pano korunur, bekleyen başlatma iptal edilir. Yeniden deneme başarılı kopyadan sonra temizleyip başlatır.
- Kopyalama sırasında geç gelen yeni kelime silinmez; güncel tam metin yeniden kopyalandıktan sonra temizlenir.
- Boş oturum mevcut panoyu silmez. Dinleme sırasındaki Kopyala/Ctrl+C taslağı veya dinlemeyi kesmez.
- 212 × 100 panel, 160 × 40 düğmeler, görünür metin/logo olmaması, 1 × 1 görünür/enabled native edit, kırmızı/yeşil nokta, sürükleme ve konum kaydı denetlendi.
- Tek EXE ayrı runtime ve kaynak olmadan Unicode/boşluk içeren klasörde açıldı; kopyalama, tek örnek, X/native kapatma, tekrar açılış ve geçici simge temizliği doğrulandı.
- Resmi AutoHotkey/Ahk2Exe hash sabitlemeleri, izin listesi ve kaynak credential taraması geçti. İndirilen artifact ZIP'in SHA-256, üyeleri ve CRC'si; EXE'nin boyutu ve SHA-256'sı ayrıca doğrulandı.

Test edilen EXE: **1.473.024 bayt**. SHA-256:
`d0ced4902d27ee4cc798e8ac1724d1f4cb62f0e3f0c72f183e14e9bf2c176d7d`.

Windows testleri hosted Windows Server 2025 ortamında çalıştı. Mikrofon başlatma/durdurma istekleri kaynak testinde sayaçlarla değiştirilir; **gerçek Windows 11 mikrofon tanıması ve tam ekran WorkSpaces oturumu otomatik denenmez**. Nokta uygulama durumudur, gerçek dinleme onayı değildir.
