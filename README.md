# Hızır Bey Projeleri

Projelerin son erişilebilir kaynak sürümleri ve kurulum paketleri. Güncelleme tarihi: 15 Ekim 2026.

| Proje | Sürüm / durum | Dosyalar |
|---|---|---|
| Sesli yazma | 0.1.2; simgeden açılan küçük panel, yalnızca kırmızı etkinlik noktası ve Windows için Win + H yönlendirmesi | [Kaynak ve kurulum](sesli-yazma/) · [Paket](paketler/Hizir-Bey-Sesli-Yazma-0.1.2.zip) |
| Sohbet asistanı | 0.3.3; 10 MB / 20.000 örnek hafızası, kapasite göstergesi, hızlı yerel örnek seçimi ve büyük JSON yedeği; 108 test geçti | [Kaynak ve güncelleme](sohbet-asistani/) · [Paket](paketler/Hizir-Bey-Sohbet-Asistani-0.3.3.zip) |
| Yatırım / çekim hesaplayıcı | Logolu sürüm; alt düğme yerleşimi düzeltildi | [Kaynak ve EXE oluşturma](hesaplayici/) · [Paket](paketler/HizirBey_EXE_Olusturma.zip) |
| Sohbet tarayıcı | 1.1.0 | [Kaynak](sohbet-tarayici/) · [Paket](paketler/Hizir-Bey-Sohbet-Tarayici-1.1.0.zip) |
| RAM takip | 2.0.1 | [Kaynak](ram-takip/) · [Paket](paketler/Hizir-Bey-RAM-Takip-2.0.1.zip) |
| Spor analiz | v47; v40 tabanına v41–v47 güncellemeleri sırayla uygulandı | [Kaynak](spor-analiz/) · [Birleştirilmiş paket](paketler/Hizir-Bey-Spor-Analiz-v47.zip) |
| Anne TV | 0.4.3, mevcut proje deposunda | [Kaynak](https://github.com/hackedmylife/anne-tv) |
| SmartTube AI Dub | Mevcut kaynak deposu; yeni APK ile kaynak eşleşmesi ayrıca doğrulanmalı | [Kaynak](https://github.com/hackedmylife/smarttube-ai-dub) |

## Hesaplayıcıyı EXE yapma

`hesaplayici/EXE_OLUSTUR.bat` dosyasını Windows'ta çalıştırın. Python 3.9+ ve internet gerekir. Oluşan `dist/HizirBey_Hesaplayici.exe` Python veya ayrı logo dosyası istemez.

GitHub Actions ayrıca Windows üzerinde hesaplayıcı EXE'sini oluşturur. Başarılı çalışmanın **Artifacts** bölümünden `HizirBey-Hesaplayici-Windows` paketini indirin. ZIP oluşturma paketi hazır EXE değildir.

## Sürüm ve anahtar politikası

- Gelecek çalışmaların son kaynak kodu, varlıkları, kurulum/derleme dosyaları ve sürüm notları bu depoya eklenir.
- Token, API key, oturum, `.env`, özel imzalama anahtarı ve kullanıcı verileri yüklenmez.
- Güncellemeler mevcut yerel anahtarları silmez veya üzerlerine yazmaz.
- Anne TV ve SmartTube otomatik güncelleme akışları kendi mevcut depolarında kalır; bu depo ilgili projelere bağlantı verir.
- Spor analiz kaynakları sözdizimi kontrolünden geçti. GUI, canlı API sonuçları ve Windows EXE çalışma testi bu aktarım sırasında yapılmadı.
