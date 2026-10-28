# Hızır Bey · Yerel Dikte 0.4.3

Sesli yazma kendi bilgisayarındaki metin kutusunda çalışır. Koyu zemin, altın vurgu ve mevcut Hızır Bey logosuyla kompakt yerel panel. İki büyük işlem düğmesi **Başlat / Durdur** ve **Kopyala**, üst sağda küçük bir **X** bulunur. X uygulamayı kendi AutoHotkey süreciyle birlikte tamamen kapatır; aynı EXE çift tıklanarak yeniden açılabilir.

![Gerçek Windows paneli](https://raw.githubusercontent.com/hackedmylife/HizirBey-projeleri/main/workspaces-dikte/docs/preview.png)

## Kurulum / güncelleme

1. Eski yerel Hızır Bey Dikte programını sağ alttaki simgesinden **Çıkış** ile kapat.
2. **Hizir-Bey-WorkSpaces-Dikte-0.4.3.exe** dosyasını kendi bilgisayarına indirip çift tıkla. Tek dosyadır; kurulum, yönetici yetkisi veya ayrı AutoHotkey gerekmez. Dosyayı istediğin klasöre koyabilirsin.
3. Kaynak kodla çalışmak istersen ZIP'in tamamını çıkarıp **BASLAT.cmd** kullanabilirsin; EXE kullanırken bu ZIP'e gerek yoktur.
4. Önceki sürümün **Hızır Bey · LiveChat Aktarım Köprüsü** eklentisini WorkSpaces Chrome'da `chrome://extensions` üzerinden kaldır veya kapat; LiveChat sekmesini bir kez yenile. Bu yeni uygulamanın Chrome eklentisi yoktur.

[Kaynak paketinin doğrudan adresi](https://github.com/hackedmylife/HizirBey-projeleri/raw/refs/heads/main/paketler/Hizir-Bey-WorkSpaces-Dikte-0.4.3.zip).

[Tek EXE indir](https://github.com/hackedmylife/HizirBey-projeleri/raw/refs/heads/main/paketler/Hizir-Bey-WorkSpaces-Dikte-0.4.3.exe).

## Kullanım

- **Başlat** veya **Win+H** Windows sesli yazmasını yerel kutuda açar. Windows'ta **Dinleniyor** yazısını bekle, sonra konuş. Yedek kısayol **Ctrl+Alt+H**.
- Aynı düğme **Durdur** olur. Düğme veya ikinci **Win+H** dikteyi durdurur. Son kelimeler için kısa bir sakinleşme aralığından sonra temel cümle sonları tamamlanır ve metin otomatik panoya kopyalanır. Başarılı kopyalamanın ardından kutu otomatik temizlenir; durum satırında **Kopyalandı · Yeni dikteye hazır** görünce Ctrl+V kullanabilirsin. Sonraki dikte boş kutuda başlar. Kopyalama başarısızsa veya kopyalama sırasında yeni metin geldiyse kutudaki metin korunur.
- **Kopyala**, kutudaki metnin tamamını seçmeye gerek kalmadan panoya alır. Kopyalanan son metne temel cümle sonu düzenlemesi uygulanır. Satırlar ve mevcut işaretler korunur; kelimeler yeniden yazılmaz.
- Yerel panelde yazarken **Ctrl+C** de aynı işi anında yapar. Kısmi metin seçili olsa bile kutunun tamamı kopyalanır. Dikte durdurulmaz; canlı kutu ve seçimin / imlecin yeri değiştirilmez. Yalnız kopyalanan anlık metin düzenlenir.
- Kopyalama, o anda kutuda görünen metnin bir kopyasını alır. Durdurunca son kelimeler ve noktalama tamamlandıktan sonra pano otomatik güncellenir; konuşma sürerken anlık kopya için yeniden **Kopyala** veya **Ctrl+C** kullan.
- LiveChat'e yapıştırmak için kendin doğru yazı alanına tıklayıp **Ctrl+V** kullan. Uygulama başka bir alana otomatik yapıştırmaz veya mesaj göndermez.
- Yeni bir metin için kutuda **Ctrl+A → Delete** kullan. Başlatma, **Kopyala** düğmesi ve **Ctrl+C** taslağı silmez. Yalnız **Durdur / ikinci Win+H** işleminin başarılı otomatik kopyasından sonra kutu temizlenir. Kopyalanmış metin panoda kalır; kutuyu temizleyen bu işlem geri alma geçmişini de sıfırlar.
- Diğer uygulamalarda **Ctrl+C** normal seçili metin kopyalama işini sürdürür. Dikte kısayolları yalnız bu panel, açık dikte araç çubuğu ve WorkSpaces içindeyken yakalanır.

## Noktalama kapsamı

Önceki 0.3.0 sürümü Windows'tan gelen metni aynen gösteriyordu; kendi noktalama işlemi yoktu. 0.4.3'ın yerel düzenlemesi:

- İlk harfi Türkçe **i → İ**, **ı → I** ayrımını koruyarak büyütür.
- Çok kelimeli metnin ve yaygın selamların sonunda eksik noktayı tamamlar. Açık soru ekiyle biten `miyim`, `misiniz`, `mi` ve `nasılsınız` gibi örneklerde soru işareti kullanır.
- Var olan `. ! ? … , : ;` işaretlerini çoğaltmaz. Satırları, para / sayı ayırıcılarını ve işaretlenmiş mevcut metni korur.
- Tek başına kod, URL, e-posta ve sayısal sonlar gibi belirsiz alanlarda temkinli davranır. Sayıyla biten bir cümlenin son işaretini kendin eklemen gerekebilir.

Örnek: `merhaba işleminizi kontrol ediyorum` → `Merhaba işleminizi kontrol ediyorum.`; `yardımcı olabilir miyim` → `Yardımcı olabilir miyim?`.

Bu, kurallarla çalışan hızlı bir **temel cümle sonu düzenlemesi**dir; bağlamı anlayan bir dil modeli değildir. Cümle içi virgülleri veya her soru cümlesini güvenilir biçimde çıkarmaz. Metni göndermeden önce kontrol et. Konuşma sırasında panel metni yeniden yazmaz; durdurunca veya kopyalanan anlık metinde uygular. Durdurma sonrası son kelimeleri bekler; yeniden Başlat'a basmak bekleyen düzenlemeyi ve otomatik kopyalamayı iptal eder.

Windows'un **Otomatik noktalama** seçeneği Win+H panelinin dişli menüsündeki ayrı bir ayardır; uygulama bunu veya kayıt defterini değiştirmez. Yalnız bitince düzenleme istiyorsan Windows'un konuşma sırasında işaret ekleyen seçeneğini kapatabilirsin. [Microsoft sesli yazma belgesi](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc).

## Panel

Panel 100 fiziksel piksel yüksekliğinde kalır. Genişlik ilk yerleşimde 600–1080 piksel arasında hesaplanır; normal tam ekran düzeninde yaklaşık 930 pikseldir. Sağda 160 × 40 piksel boyutunda iki özel çizimli düğme ve 24 × 24 piksel X, solda geniş metin kutusu vardır. Düğmelerde simge, kısayol etiketi, üzerine gelme / basma renkleri bulunur; dikteyi durdurma düğmesi kırmızı tonuna geçer. **YEREL DİKTE ↔** başlığından, logodan veya durum yazısından tutup sürükle. Bıraktığın konum program yeniden açıldığında hatırlanır. Sağ alttaki program simgesinde **Paneli aç**, **Kısayolu yeniden yakala**, **Konumu sıfırla** ve **Çıkış** bulunur.

## Veri ve gereksinimler

Windows 11 x64, çalışan yerel Win+H, mikrofon ve Windows sesli yazmasının gerektirdiği internet erişimi gerekir. Ses tanıma Windows / Microsoft hizmetine aittir; bu araç ses kaydetmez ve ayrıca bir sunucuya taslak göndermez. API anahtarı, Chrome eklentisi, LiveChat bağlantısı veya WorkSpaces'ten geri pano onayı gerekmez. Kullanıcının elle WorkSpaces'e yapıştırması için kurumun normal yerelden uzağa pano desteği kullanılabilir olmalıdır.

Taslak bellekte tutulur. Yalnız panelin X/Y konumu `%LOCALAPPDATA%\HizirBey\WorkSpacesDikte\panel.ini` içine yazılır; eski sürümden gelen konum korunur. Metin ve ses bu dosyaya kaydedilmez. EXE, içine gömülü iki marka görselini çalışma sırasında kendine ait geçici klasöre çıkarır; normal kapanışta bu klasörü temizler. EXE’nin yanına dosya yazmaz. Panel konumu eski sürümle aynı yerde tutulur. Boş kutuda kopyalama eski panoyu değiştirmez. **X**, pencereyi kapatma isteği ve sağ alttaki **Çıkış** uygulamanın tamamını kapatır. Onay penceresinde bekletmez; kapanınca bellekteki taslak silinir. Başka AutoHotkey makrolarının süreçlerine dokunulmaz. Kapatmadan önce gerekli metni kopyala.

## Geliştirme ve doğrulama

`python scripts/package.py --check` resmi çalışma dosyasının SHA-256 değerini ve paket izin listesini denetler. `python scripts/package.py` ZIP oluşturur. Son kullanıcı için Python gerekmez.

Tek EXE Windows üzerinde `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-exe.ps1` ile derlenir. Betik resmi Ahk2Exe 1.1.37.02a2 derleyicisini indirir; arşiv, derleyici ve AutoHotkey tabanının SHA-256 değerlerini doğrular. Derleyici sürümü v1 adını taşısa da resmi araç AHK v2 betiklerini destekler; uygulama tabanı AHK 2.0.30 x64 olarak sabitlenmiştir. Uygulama kodu ile logo / simge gömülür. EXE sıkıştırılmaz ve kod gizleme uygulanmaz. `LICENSE` kaynağına tam GPL lisansı eklenir. Derleme sonunda EXE yanında `.sha256` dosyası üretilir; çalıştırmak için bu dosya gerekmez. Resmi derleyici: https://github.com/AutoHotkey/Ahk2Exe/releases/tag/Ahk2Exe1.1.37.02a2 .

Windows kontrolleri: `vendor\AutoHotkey64.exe /ErrorStdOut tests\windows-tests.ahk results.txt`. Test, gerçek giriş betiğindeki kısayolları, gerçek Windows panosunu ve fare hareketlerini kullanır. Mikrofon başlatma / durdurma isteği sayaçlarla taklit edilir; gerçek Windows 11 mikrofon tanıması kullanıcı oturumunda denenmelidir. Derlenen EXE ayrıca kaynak / runtime / asset bulunmayan, boşluk ve Türkçe karakter içeren bağımsız klasörde `tests/compiled-tests.ahk` ile denenir. X, native kapatma, yeniden açma, tek örnek, pano, noktalama ve geçici görsel temizliği denetlenir. Ayrıntılar `TEST-RAPORU.md` içindedir.

Lisans GPL-2.0-or-later. Taşınabilir resmi AutoHotkey 2.0.30 x64 çalışma dosyası, lisansı ve kaynak bilgisi `vendor` klasöründedir.
