# Hızır Bey · WorkSpaces Dikte

**0.1.0 — Windows 11 için deneme sürümü.** WorkSpaces tam ekran kullanılırken konuşmayı yerel bir metin alanında toplar, ardından hedef pencereye bir kez yapıştırmayı dener. Windows'un kendi Win+H ses tanımasını kullanır. Ayrı API anahtarı veya AutoHotkey kurulumu gerekmez; doğrulanmış taşınabilir çalışma dosyası pakettedir.

## Deneme

1. ZIP'in **tamamını** bir klasöre çıkar. `BASLAT.cmd` dosyasını **kendi bilgisayarında** çalıştır.
2. WorkSpaces'i tam ekran aç ve konuşmanın yazılacağı boş alana tıkla.
3. **Win+H**'ye bas. Yerel panel ve Windows'un sesli yazma çubuğu açılmalıdır. **Dinleniyor** yazısını bekle, sonra konuş.
4. Bitirince yeniden **Win+H**, **Ctrl+Enter** veya paneldeki **Bitir ve aktar** düğmesini kullan.
5. Son kelimeler için en az 1 saniye ve pano eşitlemesi için seçilen süre beklenir. Uygulama WorkSpaces'i öne getirip **bir kez Ctrl+V** gönderir. Doğru sohbeti/metni kontrol edip gönderimi kendin yap.

Win+H yakalanmazsa **Ctrl+Alt+H** dene. Sağ alttaki uygulama simgesinden **Kısayolu yeniden yakala** seçeneği de kullanılabilir. Diğer kısayollar için bir yeniden eşleme yapılmaz; Win+H ve Ctrl+Alt+H yalnız WorkSpaces ve yerel panel bağlamında yakalanır.

## Aktarım ve kurtarma

- Tam ekran boyutu değiştirilmez. Yerel panel yalnız dikte sırasında WorkSpaces'in üzerinde görünür.
- Taslak, uygulama çalışırken bellekte korunur. Hedef kapanırsa, odak değişirse veya panoya yazılamazsa taslak silinmez.
- Metin panoda bırakılır; erken pano geri yüklemesiyle WorkSpaces eşitlemesi bozulmaz. Önceki pano içeriğinin yerine konuşma metni gelir.
- Yavaş bağlantıda **Aktarım beklemesi** değerini 1,5 veya 2,5 saniyeye çıkar. Gerekirse **Kopyala** ile doğru alana elle Ctrl+V yap.
- Uzak alana yapıştırmanın başarılı olduğu yerel bilgisayardan doğrulanamaz. Otomatik tekrar yoktur; bu, metnin iki kez yazılmasını önler.
- Yeni dikte önceki aktarılmış metni temizlerken bir önceki metni **Son metni getir** ile erişilebilir tutar. Henüz aktarılmamış taslak açılıp kapanınca silinmez.
- Gizle / pencerenin X düğmesi uygulamayı kapatmaz. Çıkmak için sağ alttaki simgeden **Çıkış** seçilir. Program kapanınca bellekteki taslaklar kaybolur.
- Taslak satır sonları yapıştırma sırasında boşluğa dönüşür; ek noktalama veya yapay Enter gönderilmez.

## Gereksinimler ve sınırlar

- Windows 11 x64 ve yerel Windows sesli yazma özelliğinin çalışması gerekir. ARM64 bilgisayarların x64 öykünmesi bu sürümde doğrulanmadı.
- Windows diktesi internet ve mikrofon erişimi gerektirir. Bu uygulama Microsoft'un ses tanıma hatalarını veya internet kesintisini gidermez; WorkSpaces'e ses taşıma gereksinimini ayırır.
- WorkSpaces'te yerel panodan uzak oturuma metin aktarımı kurum tarafından açık olmalıdır. Kapalıysa kurum yöneticisinin desteklemesi gerekir.
- Yerel Win+H'yi başlatma ve durdurma Windows arayüzündeki klavye işlemleriyle yapılır; sesli yazmanın sessizlikte durma süresi uygulamadan değiştirilemez. **Dikteye devam** yeniden başlatma talebi gönderir; Windows çubuğundaki mikrofon durumunu kontrol et.
- Uygulama hedef pencerenin HWND/PID'sini ve yapıştırmadan hemen önceki odağı denetler. Uzak oturumdaki sohbeti veya imleci okuyamaz. Dikte sırasında hedef sohbeti değiştirme; aktarmadan önce seçilen yazı alanını kontrol et.
- WorkSpaces istemcisinin kısayolu engellemesi, ayrı yetki düzeyleri veya kurumsal kısıtlar yerel panelin açılmasını engelleyebilir. WorkSpaces'e giriş yaptıktan sonra aracı başlatmak ve kısayolu yenilemek denenebilir. Sistem/kurum korumaları aşılmaz.
- Not Defteri ile bağımsız deneme için sağ alttaki simgeden **Not Defteri vb. için deneme modu** açılabilir. Bu seçenek açıkken Win+H diğer uygulamalarda da paneli açar; varsayılan kapalıdır.

## Veri

Uygulama ses dosyası kaydetmez, taslağı diske yazmaz, kendi sunucusuna veri göndermez ve anahtar istemez. Ses tanıma Windows'un mevcut Microsoft hizmetine aittir. Otomatik başlangıç, kayıt defteri değişikliği veya kurulum yapılmaz.

## Doğrulama ve yeniden paketleme

- `python scripts/package.py --check`: çalışma dosyasının SHA-256 kontrolü ve paket içerik denetimi.
- Windows'ta `vendor\AutoHotkey64.exe /ErrorStdOut tests\windows-tests.ahk results.txt`: süreç kapsamı, gerçek Unicode pano, gerçek yerel düzenleme alanına tek yapıştırma, odak yarışı, kapalı hedef, taslak korunması ve yerleşim testleri.
- `python scripts/package.py`: aynı kaynaklardan yeniden üretilebilir ZIP oluşturur.
- GitHub Actions: [Windows doğrulamaları](../.github/workflows/test-workspaces-dikte.yml).

Windows 11'de **gerçek Win+H mikrofon akışı ve tam ekran WorkSpaces uçtan uca denemesi kullanıcı bilgisayarında yapılmalıdır**. CI'daki yerel pencere/pano testleri bu denemenin yerine geçmez.

## Lisans

Bu araç GPL-2.0-or-later lisanslıdır. Paketteki değiştirilmemiş AutoHotkey çalışma dosyasının lisansı ve kaynak adresi `vendor/license.txt` ve `vendor/PROVENANCE.txt` içindedir.
