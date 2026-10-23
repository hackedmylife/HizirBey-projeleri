# Doğrulama — 0.4.1 tek EXE

23 Ekim 2026. Mevcut koyu / altın yerel panel, noktalama, iki büyük düğme ve tamamen kapatan X, tek bir taşınabilir Windows x64 EXE olarak derlendi.

**145 Windows kontrolü geçti: 123 mevcut uygulama kontrolü + 22 bağımsız EXE kontrolü.**

[Başarılı Windows çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39957489690).
Doğrulanan kaynak commit: `e90a2a106b546d8846447f33005ad6fb6a370f28`.

## Tek EXE doğrulaması

- Dağıtılan EXE, yalnız kendisinin bulunduğu, boşluk ve Türkçe karakter içeren ayrı bir klasöre kopyalandı. Kaynak, AutoHotkey veya harici görseller olmadan açıldı.
- Sürüm bilgisi 0.4.1.0 ve pencerenin gerçekten bu EXE sürecine ait olduğu doğrulandı. Panel 100 piksel yüksekliğinde kaldı.
- Gömülü logo native bitmap olarak yüklendi. İki marka görseli kendine ait benzersiz geçici klasöre çıktı; EXE yanına dosya yazılmadı.
- Gerçek Ctrl+C ve gerçek fare ile Kopyala: Türkçe ilk harf, soru işareti ve nokta doğru sonuç verdi. Canlı metin kutusu kopyalamayla değiştirilmedi.
- Aynı EXE ikinci kez başlatılınca ikinci süreç kapandı; açık panel ve taslak korundu.
- X gerçek fare ile tıklandı: pencere ve EXE süreci tamamen kapandı. Geçici görsel klasörü temizlendi.
- Aynı EXE hemen yeniden açıldı. Native pencere kapatma isteği de süreci kapattı ve geçici dosyaları temizledi.
- Derlenmiş `--smoke` girişinin açılıp çıkması ve temizliği ayrıca doğrulandı.

## Korunan 123 kontrol

Gerçek giriş betiğinin Win+H / Ctrl+C kısayolları, gerçek Windows panosu, seçimin ve imlecin korunması, tüm taslağı kopyalama, dış uygulamada normal Ctrl+C, kopyalamanın dikteyi durdurmaması, otomatik yapıştırmama / göndermeme doğrulandı. Türkçe i / ı ayrımı, temel cümle sonu, açık soru ekleri, mevcut işaretler, URL / e-posta / kod / sayı koruması, satır sonları ve tekrar uygulandığında değişmeme kontrolleri geçti. Durdurma sonrası sakinleşme aralığı, yalnız büyük harf düzeltmesi ve native Ctrl+Z geri alma doğrulandı. 600 / 930 / 1080 genişliklerde yerleşim, özel çizimli düğmeler, yüksek kaliteli logo, gerçek sürükleme / kayıtlı konum ve X sonrası yeniden açılma kontrolleri geçti.

## Derleme ve paket denetimi

- Resmi AutoHotkey 2.0.30 x64 tabanı: SHA-256 `2eab99848ebc07f8ab0cc448bf69af8c700b2fc7fcd1ff8794df743dcc58da51`.
- Resmi Ahk2Exe 1.1.37.02a2 arşivi: SHA-256 `c29b8c3a5124850d79fc9e66e2ca79677c377d7f31631ad3022ba159c5d9e3be`.
- Resmi derleyici EXE: SHA-256 `e54a599b19baa5c1688849bbae7a9cf049eefccd4f704c67941b40da13a625b2`.
- Dağıtılan EXE: **1.627.648 bayt**, SHA-256 `6a2491fd278b2e23e0bb0101ba08f939a499546af69b9f9a77a02458cffc4a3d`.
- Windows'ta geçen dosya artifact olarak alındı. Artifact ZIP SHA-256, izin listesi, CRC ve çıkarılan EXE SHA-256 yeniden doğrulandı.
- PE kaynakları ayrıca incelendi: x64 mimari, uygulama kodu, tam GPL lisansı ve orijinal iki marka görseli gömülüdür. Metin kaynakları ve EXE kaynakları literal credential / özel anahtar desenleri için tarandı.
- Kaynak ZIP yalnız izin listesindeki 21 dosyayı içerir. Kullanıcı taslağı, ses, panel.ini, token / API anahtarı, kullanıcı ekran görüntüsü ve derleme geçici dosyaları dahil değildir.

## Sınırlar

Test ortamı Windows Server 2025 / 10.0.26100'dür. Gerçek Windows 11 mikrofon tanıması otomatik çalıştırılmadı; kaynak testinde başlatma / durdurma çağrıları sayaçlarla değiştirilir. Derlenmiş uygulamanın pano, fare, kısayol, başlatma / kapanma ve dosya gömme davranışları gerçek Windows oturumunda doğrulandı. Windows ses tanımasının kullanıcı mikrofonuyla denemesi kullanıcı bilgisayarında yapılmalıdır.

Noktalama yerel, temel cümle sonu ve ilk harf düzenlemesidir; bağlama göre virgül çıkaran bir dil modeli değildir. Windows'un Otomatik noktalama ayarına dokunulmaz. Metin kullanıcı tarafından kontrol edilir.

X / Çıkış onay beklemeden kendi uygulama sürecini bitirir; başka AutoHotkey makrolarını sonlandırmaz. Bellekteki taslak kapanınca silinir. EXE'nin zorla sonlandırılması veya bilgisayarın kapanması halinde geçici görsel klasörü kalabilir; taslak ve ses bu klasöre yazılmaz. Kalıcı ayar yalnız eskiyle aynı yerdeki panel X / Y konumudur.
