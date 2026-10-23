# Hızır Bey · Yerel Dikte 0.3.0

Sesli yazma kendi bilgisayarındaki metin kutusunda çalışır. Panelde yalnız iki büyük düğme vardır: **Başlat / Durdur** ve **Kopyala**. Durdurduğunda metin kutuda bekler. Kopyalama kullanıcı isteğiyle yapılır.

## Kurulum / güncelleme

1. Eski yerel Hızır Bey Dikte programını sağ alttaki simgesinden **Çıkış** ile kapat.
2. ZIP'in tamamını kendi bilgisayarında bir klasöre çıkar. **BASLAT.cmd** çalıştır. Ayrı AutoHotkey kurulumu gerekmez.
3. Önceki sürümün **Hızır Bey · LiveChat Aktarım Köprüsü** eklentisini WorkSpaces Chrome'da `chrome://extensions` üzerinden kaldır veya kapat; LiveChat sekmesini bir kez yenile. Bu yeni uygulamanın Chrome eklentisi yoktur.

[Paketin doğrudan adresi](https://github.com/hackedmylife/HizirBey-projeleri/raw/refs/heads/main/paketler/Hizir-Bey-WorkSpaces-Dikte-0.3.0.zip).

## Kullanım

- **Başlat** veya **Win+H** Windows sesli yazmasını yerel kutuda açar. Windows'ta **Dinleniyor** yazısını bekle, sonra konuş. Yedek kısayol **Ctrl+Alt+H**.
- Aynı düğme **Durdur** olur. Düğme veya ikinci **Win+H** dikteyi durdurur; metin kutuda kalır.
- **Kopyala**, kutudaki metnin tamamını seçmeye gerek kalmadan panoya alır. Türkçe karakterler, satırlar, boşluklar ve noktalama korunur.
- Yerel panelde yazarken **Ctrl+C** de aynı işi anında yapar. Kısmi metin seçili olsa bile kutunun tamamı kopyalanır. Dikte durdurulmaz; seçimin / imlecin yeri değiştirilmez.
- Kopyalama, o anda kutuda görünen metnin bir kopyasını alır. Sonradan gelen kelimeleri almak için yeniden **Kopyala** veya **Ctrl+C** kullan.
- LiveChat'e yapıştırmak için kendin doğru yazı alanına tıklayıp **Ctrl+V** kullan. Uygulama başka bir alana otomatik yapıştırmaz veya mesaj göndermez.
- Yeni bir metin için kutuda **Ctrl+A → Delete** kullan. Başlatma, durdurma veya kopyalama mevcut taslağı kendiliğinden silmez.
- Diğer uygulamalarda **Ctrl+C** normal seçili metin kopyalama işini sürdürür. Dikte kısayolları yalnız bu panel, açık dikte araç çubuğu ve WorkSpaces içindeyken yakalanır.

## Panel

Panel 100 fiziksel piksel yüksekliğinde kalır. Genişlik ilk yerleşimde 600–1080 piksel arasında hesaplanır; normal tam ekran düzeninde yaklaşık 930 pikseldir. Sağda 160 × 40 piksel boyutunda iki düğme, solda geniş metin kutusu vardır. **HIZIR BEY ↔** başlığından veya durum yazısından tutup sürükle. Bıraktığın konum program yeniden açıldığında hatırlanır. Sağ alttaki program simgesinde **Paneli aç**, **Kısayolu yeniden yakala**, **Konumu sıfırla** ve **Çıkış** bulunur.

## Veri ve gereksinimler

Windows 11 x64, çalışan yerel Win+H, mikrofon ve Windows sesli yazmasının gerektirdiği internet erişimi gerekir. Ses tanıma Windows / Microsoft hizmetine aittir; bu araç ses kaydetmez ve ayrıca bir sunucuya taslak göndermez. API anahtarı, Chrome eklentisi, LiveChat bağlantısı veya WorkSpaces'ten geri pano onayı gerekmez. Kullanıcının elle WorkSpaces'e yapıştırması için kurumun normal yerelden uzağa pano desteği kullanılabilir olmalıdır.

Taslak bellekte tutulur. Yalnız panelin X/Y konumu `%LOCALAPPDATA%\HizirBey\WorkSpacesDikte\panel.ini` içine yazılır; eski sürümden gelen konum korunur. Metin ve ses bu dosyaya kaydedilmez. Boş kutuda kopyalama eski panoyu değiştirmez. Çıkış sırasında kopyalanmamış taslak varsa hatırlatma gösterilir.

## Geliştirme ve doğrulama

`python scripts/package.py --check` resmi çalışma dosyasının SHA-256 değerini ve paket izin listesini denetler. `python scripts/package.py` ZIP oluşturur. Son kullanıcı için Python gerekmez.

Windows kontrolleri: `vendor\AutoHotkey64.exe /ErrorStdOut tests\windows-tests.ahk results.txt`. Test, gerçek giriş betiğindeki kısayolları, gerçek Windows panosunu ve fare hareketlerini kullanır. Mikrofon başlatma / durdurma isteği sayaçlarla taklit edilir; gerçek Windows 11 mikrofon tanıması kullanıcı oturumunda denenmelidir. Ayrıntılar `TEST-RAPORU.md` içindedir.

Lisans GPL-2.0-or-later. Taşınabilir resmi AutoHotkey 2.0.30 x64 çalışma dosyası, lisansı ve kaynak bilgisi `vendor` klasöründedir.
