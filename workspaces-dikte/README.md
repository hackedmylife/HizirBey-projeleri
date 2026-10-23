# Hızır Bey · WorkSpaces Dikte 0.2.0

Konuşma önce **kendi bilgisayarındaki yerel kutuya** yazılır. Win+H / Ctrl+Enter ile bitirince tamamlanan metin, WorkSpaces içindeki LiveChat yazı alanına otomatik eklenir. Mesajın gönderilmesi kullanıcıya aittir.

## Bir kez yapılacak kurulum

1. Eski Hızır Bey WorkSpaces Dikte sürümünü sağ alttaki simgeden **Çıkış** ile kapat.
2. ZIP'in tamamını kendi bilgisayarında bir klasöre çıkar. Yerel **BASLAT.cmd** dosyasını kullan.
3. Aynı ZIP içindeki **livechat-kopru** klasörünü WorkSpaces'e aktar. Alternatif olarak ZIP'i WorkSpaces Chrome'undan indirip orada da çıkar.
4. **WorkSpaces içindeki Chrome'da** `chrome://extensions` sayfasını aç. **Geliştirici modu → Paketlenmemiş öğe yükle** ile `livechat-kopru` klasörünü seç. Dosya seçme penceresinde `manifest.json` dosyasını değil, onu içeren klasörü seç.
5. `chrome://extensions/shortcuts` sayfasında köprünün **Ctrl+Shift+Y** kısayoluna sahip olduğunu kontrol et. Kapsamı Chrome'da olsun. Yerel araç bu tuşları otomatik kullanır.
6. LiveChat sayfasını yenile ve bir görüşme seç.

Paketin doğrudan adresi: https://github.com/hackedmylife/HizirBey-projeleri/raw/refs/heads/main/paketler/Hizir-Bey-WorkSpaces-Dikte-0.2.0.zip

## Kullanım

- WorkSpaces tam ekrandayken LiveChat görüşmesini seç ve **Win+H**'ye bas. Yedek kısayol **Ctrl+Alt+H**.
- Araç önce açık görüşmenin yazı alanını köprüyle bağlar; ardından **yerel kutuyu** ve Windows diktesini açar. Windows'ta **Dinleniyor** yazısını bekle, sonra konuş.
- Konuşma sürerken metin yalnız yerel kutudadır. Kısa sessizlikler otomatik aktarım tetiklemez.
- İkinci kez **Win+H**, **Ctrl+Enter** veya **Bitir ve aktar** ile bitir. Son kelimeler beklenir, LiveChat alanı doğrulanır ve tamamlanmış metin otomatik eklenir.
- Mesajı kontrol edip göndermek için LiveChat'i kendin kullan. Köprü hiçbir gönder düğmesini tıklamaz ve Enter üretmez.
- LiveChat alanındaki önceden yazılmış metin korunur; yeni dikte sonuna eklenir.

## İnce panel

Panelin yüksekliği 100 fiziksel pikseldir; ekrandaki normal 930 × 104 piksel işaretli alana sığar. Genişlik, WorkSpaces pencere boyutuna göre 600–1080 piksel arasında hesaplanır. İlk yerleşim görseldeki üst orta alana göre ayarlanır; **HIZIR BEY** başlığından tutup sürükleyebilirsin. Konum aynı uygulama oturumunda korunur. İşlem tamamlandığında şerit yazı alanını kapatmadan görünür kalır ve odak LiveChat'e döner.

## Aktarımın korunması

- Başlangıçtaki görüşme, yazı kutusu ve mevcut taslak metni bağlanır. Sohbet, yazım modu veya taslak değişirse otomatik aktarım durur; yerel metin korunur.
- İç not alanına otomatik aktarım yapılmaz.
- Köprü yazı alanını odaklar, gelen yapıştırmayı aynı alana yönlendirir ve eklenen metni doğruladıktan sonra panodan yerel araca onay verir. Bu akış için WorkSpaces'in **iki yönlü metin panosu** açık olmalıdır.
- Bağlantı veya odak aksarsa taslak silinmez ve otomatik ikinci yapıştırma yapılmaz. **Onay gelmedi** durumunda önce LiveChat'i kontrol et.
- **Kopyala** tamamlanmış metni düz metin olarak panoya alır; gerektiğinde doğru alana elle Ctrl+V yapabilirsin. **Son metin** önceki dikteyi getirir.
- Yazı alanı değiştiği için köprü durduysa yerel taslağı koru; LiveChat'te doğru görüşmeyi seçip Chrome'daki köprü simgesine tıklayarak bağlantıyı sıfırla. Devam eden taslağı gerekiyorsa Kopyala ile elle aktar. Yeni dikte için yerel **Temizle**, ardından WorkSpaces'te Win+H kullan.
- Sağ alttaki simgeden aktarım beklemesi 1 / 2,5 saniye olarak değiştirilebilir. × şeridi gizler; programı kapatmaz.

## Veri ve gereksinimler

Windows 11 x64, çalışan yerel Win+H ve mikrofon/internet erişimi gerekir. Windows'un sesli yazması Microsoft hizmetine aittir. Bu araç ses kaydı yapmaz, taslağı diske veya başka sunucuya göndermez; API anahtarı, yerel web sunucusu veya ayrı AutoHotkey kurulumu istemez. Taşınabilir resmi AutoHotkey 2.0.30 x64 çalışma dosyası pakettedir. Köprü mikrofon veya pano okuma izni istemez; yalnız kullanıcı tarafından tetiklenen yapıştırma olayındaki metni işler ve aktarım onayı için panoya yazar.

Taslak ve bir önceki metin uygulama belleğinde tutulur; **Çıkış** ile kapanınca kaybolur. Pano bu akışta kullanıldığı için eski pano içeriği değişir. Kurum eklenti yüklemeyi veya pano aktarımını engelliyorsa bu işlemler kurum yöneticisi tarafından desteklenmelidir. Kurum korumaları aşılmaz.

## Doğrulama

`TEST-RAPORU.md` test sonuçlarını ve sınırlarını içerir. Windows testleri: `vendor\AutoHotkey64.exe /ErrorStdOut tests\windows-tests.ahk results.txt`. Chromium testi: Playwright yüklü bir ortamda `node tests/bridge-browser.mjs`. Paketleme: Python standart kütüphanesiyle `python scripts/package.py`. Son kullanıcı için Python gerekmez.

Gerçek Windows 11 mikrofon akışı ve kurumun tam ekran WorkSpaces / pano bağlantısı kullanıcı bilgisayarında denenmelidir. Denetimli Windows ve Chromium testleri bu uçtan uca denemenin yerine geçmez.

Lisans GPL-2.0-or-later. Resmi çalışma dosyasının lisansı ve kaynak adresi `vendor/license.txt` ve `vendor/PROVENANCE.txt` içindedir.
