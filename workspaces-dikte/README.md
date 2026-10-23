# Hızır Bey · WorkSpaces Dikte 0.2.3

Konuşma önce **kendi bilgisayarındaki yerel kutuya** yazılır. Win+H / Ctrl+Enter ile bitirince tamamlanan metin, WorkSpaces içindeki LiveChat yazı alanına otomatik eklenir. Mesajın gönderilmesi kullanıcıya aittir.

## 0.2.2'den güncelleme

Bu düzeltmede **yerel programı ve WorkSpaces Chrome köprüsünü birlikte güncelle**. Yalnız BASLAT.cmd ile yeni yerel programı açmak yeterli değildir.

1. Eski yerel programı sağ alttaki simgesinden **Çıkış** ile kapat. Yeni ZIP'i tamamen çıkar ve kendi bilgisayarında **BASLAT.cmd** çalıştır.
2. WorkSpaces'te kurulu köprünün `livechat-kopru` klasöründeki dosyaları bu paketteki yeni dosyalarla değiştir. Chrome `chrome://extensions` sayfasında **Hızır Bey · LiveChat Aktarım Köprüsü** kartının yenile düğmesine bas. Sürüm **0.2.3** olmalı. İlk kurulumsa aşağıdaki kurulum adımlarını kullan.
3. LiveChat sekmesini yenile. Yazı alanında önceki denemeden `HB-DIKTE…` yazısı kaldıysa onu bir kez elle sil. **Gönder** düğmesine basma.
4. Doğru görüşmeyi seçip Win+H ile dene: önce yerel kutu, bitirince LiveChat yazı alanı.

0.2.3, köprü onayının Chrome'daki programatik pano yazımından kendiliğinden yerel bilgisayara ulaşmasını beklemez. Köprü, geçici ve salt okunur bir onay alanı hazırlar. Yerel araç WorkSpaces'e gerçek **Ctrl+C** göndererek onayı alır; onay alanı kaldırılır ve odak geri döner. Bu hem hazırlık hem de ekleme onayı için kullanılır. Kopyalama yalnız aynı WorkSpaces penceresi odaktayken yapılır. Onay alanı 10 saniye içinde kullanılmazsa kaldırılır; mesaj kutusu bu alandan ayrıdır.

Chrome'daki **HAZ** rozeti yalnız LiveChat alanının hazır olduğunu gösterir. Yerel pano bağlantısının doğrulandığı anlamına gelmez. Onay alınamazsa program bunu **Pano dönüşü gelmedi** olarak belirtir; metni yanlış alana körlemesine yapıştırmaz. Önceki 0.2.2 sürümündeki `OK` rozeti bu ayrımı göstermiyordu. Mevcut ekran görüntüsü, pano dönüşünün gecikmesiyle yönetici tarafından kısıtlanmasını tek başına ayırt etmeye yetmez.

0.2.2'de eklenen görüşme adresiyle kimlik doğrulama, hata kodlarını yapıştırmayı engelleme ve yerel taslağı koruma sürer. Önceki sürümden kalan kontrol kodunun sonuna yeni konuşma eklenmez; kodun elle silinmesi istenir.

## Bir kez yapılacak kurulum

1. Eski Hızır Bey WorkSpaces Dikte sürümünü sağ alttaki simgeden **Çıkış** ile kapat.
2. ZIP'in tamamını kendi bilgisayarında bir klasöre çıkar. Yerel **BASLAT.cmd** dosyasını kullan.
3. Aynı ZIP içindeki **livechat-kopru** klasörünü WorkSpaces'e aktar. Alternatif olarak ZIP'i WorkSpaces Chrome'undan indirip orada da çıkar.
4. **WorkSpaces içindeki Chrome'da** `chrome://extensions` sayfasını aç. **Geliştirici modu → Paketlenmemiş öğe yükle** ile `livechat-kopru` klasörünü seç. Dosya seçme penceresinde `manifest.json` dosyasını değil, onu içeren klasörü seç.
5. `chrome://extensions/shortcuts` sayfasında köprünün **Ctrl+Shift+Y** kısayoluna sahip olduğunu kontrol et. Kapsamı Chrome'da olsun. Yerel araç bu tuşları otomatik kullanır.
6. LiveChat sayfasını yenile ve bir görüşme seç.

Paketin doğrudan adresi: https://github.com/hackedmylife/HizirBey-projeleri/raw/refs/heads/main/paketler/Hizir-Bey-WorkSpaces-Dikte-0.2.3.zip

## Kullanım

- WorkSpaces tam ekrandayken LiveChat görüşmesini seç ve **Win+H**'ye bas. Yedek kısayol **Ctrl+Alt+H**.
- Boş yerel kutunun içindeyken de **Win+H** veya **Başlat** kullanılabilir. Araç WorkSpaces hedefini bulmaya çalışır ve Windows diktesini **yerel kutuda** açar. Başlangıçtaki kısa köprü yoklamasına yanıt gelmemesi yerel dikteyi engellemez. Windows'ta **Dinleniyor** yazısını bekle, sonra konuş.
- Konuşma sürerken metin yalnız yerel kutudadır. Kısa sessizlikler otomatik aktarım tetiklemez.
- İkinci kez **Win+H**, **Ctrl+Enter** veya **Bitir ve aktar** ile bitir. Son kelimeler beklenir, LiveChat alanı doğrulanır ve tamamlanmış metin otomatik eklenir.
- Mesajı kontrol edip göndermek için LiveChat'i kendin kullan. Köprü hiçbir gönder düğmesini tıklamaz ve Enter üretmez.
- LiveChat alanındaki önceden yazılmış metin korunur; yeni dikte sonuna eklenir.

## İnce panel

Panelin yüksekliği 100 fiziksel pikseldir; ekrandaki normal 930 × 104 piksel işaretli alana sığar. Genişlik, WorkSpaces pencere boyutuna göre 600–1080 piksel arasında hesaplanır. İlk yerleşim görseldeki üst orta alana göre ayarlanır; **↔ Taşı** tutamacından veya başlıktan tutup sürükleyebilirsin. Bıraktığın konum programı kapatıp açınca da korunur. Monitör düzeni değişip kayıtlı konum ekran dışında kalırsa panel görünür bir alana döner. Sağ alttaki simgeden **Konumu sıfırla** varsayılan yerleşimi geri getirir. İşlem tamamlandığında şerit yazı alanını kapatmadan görünür kalır ve odak LiveChat'e döner.

## Aktarımın korunması

- Başlangıçtaki görüşme adresi, varsa sayfadaki görüşme kimliği, yazı kutusu ve mevcut taslak metni bağlanır. Sohbet veya konu adresi, yazım modu, kutunun kendisi veya taslak değişirse otomatik aktarım durur; yerel metin korunur.
- İç not alanına otomatik aktarım yapılmaz.
- Köprü yazı alanını odaklar, gelen yapıştırmayı aynı alana yönlendirir ve eklenen metni doğruladıktan sonra panodan yerel araca onay verir. Otomatik aktarım için WorkSpaces'in **iki yönlü metin panosu** açık olmalıdır. Dikte başlangıcında köprüye ulaşılamamışsa bitirme sırasında aynı oturuma yeniden bağlanılır; bağlantı ancak o anda ilk kez kurulmuşsa hedefi kontrol edip yeniden **Bitir ve aktar** kullanman istenir. Metin yerel kutuda kalır.
- Bağlantı veya odak aksarsa taslak silinmez ve otomatik ikinci yapıştırma yapılmaz. **Onay gelmedi** durumunda önce LiveChat'i kontrol et.
- **Kopyala** tamamlanmış metni düz metin olarak panoya alır; gerektiğinde doğru alana elle Ctrl+V yapabilirsin. **Son metin** önceki dikteyi getirir.
- **Pano dönüşü gelmedi** devam ederse, WorkSpaces'te Not Defteri'ne örnek bir kelime yazıp seçerek Ctrl+C yap; kendi bilgisayarındaki Not Defteri'ne Ctrl+V ile yapışıp yapışmadığını kontrol et. Bu yönde kopyalama çalışmıyorsa köprü onayı da dönemez. AWS, pano yönünü **Copy and Paste / Copy Only / Paste Only** olarak ayrı ayrı yapılandırmaya izin verir; kurum yöneticisi gerekli yönleri kontrol etmelidir. [AWS pano yönlendirme belgesi](https://docs.aws.amazon.com/workspaces/latest/adminguide/group_policy.html). Araç bu ayarları değiştirmez.
- Yazı alanı değiştiği için köprü durduysa yerel taslağı koru; LiveChat'te doğru görüşmeyi seçip Chrome'daki köprü simgesine tıklayarak bağlantıyı sıfırla. Devam eden taslağı gerekiyorsa Kopyala ile elle aktar. Yeni dikte için yerel **Temizle**, ardından WorkSpaces'te Win+H kullan.
- Sağ alttaki simgeden aktarım beklemesi 1 / 2,5 saniye olarak değiştirilebilir. × şeridi gizler; programı kapatmaz.

## Veri ve gereksinimler

Windows 11 x64, çalışan yerel Win+H ve mikrofon/internet erişimi gerekir. Windows'un sesli yazması Microsoft hizmetine aittir. Bu araç ses kaydı yapmaz, taslağı diske veya başka sunucuya göndermez; API anahtarı, yerel web sunucusu veya ayrı AutoHotkey kurulumu istemez. Taşınabilir resmi AutoHotkey 2.0.30 x64 çalışma dosyası pakettedir. Köprü mikrofon, pano okuma veya pano yazma izni istemez; yalnız tetiklenen gerçek kopyalama ve yapıştırma olaylarını işler. Onay için genel panoya arka planda yazan bir API kullanmaz.

Yalnız panelin X/Y konumu `%LOCALAPPDATA%\HizirBey\WorkSpacesDikte\panel.ini` içinde saklanır; taslak veya ses bu dosyaya yazılmaz. Taslak ve bir önceki metin uygulama belleğinde tutulur; **Çıkış** ile kapanınca kaybolur. Pano bu akışta kullanıldığı için eski pano içeriği değişir. Kurum eklenti yüklemeyi veya pano aktarımını engelliyorsa bu işlemler kurum yöneticisi tarafından desteklenmelidir. Kurum korumaları aşılmaz.

## Doğrulama

`TEST-RAPORU.md` test sonuçlarını ve sınırlarını içerir. Windows testleri: `vendor\AutoHotkey64.exe /ErrorStdOut tests\windows-tests.ahk results.txt`. Chromium testi: Playwright yüklü bir ortamda `node tests/bridge-browser.mjs`. Paketleme: Python standart kütüphanesiyle `python scripts/package.py`. Son kullanıcı için Python gerekmez.

Gerçek Windows 11 mikrofon akışı ve kurumun tam ekran WorkSpaces / pano bağlantısı kullanıcı bilgisayarında denenmelidir. Denetimli Windows ve Chromium testleri bu uçtan uca denemenin yerine geçmez.

Lisans GPL-2.0-or-later. Resmi çalışma dosyasının lisansı ve kaynak adresi `vendor/license.txt` ve `vendor/PROVENANCE.txt` içindedir.
