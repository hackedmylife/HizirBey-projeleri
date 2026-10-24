# Hızır Bey · Filtreli Dikte 0.1.0

Deneysel CPU ses filtresini, mevcut 100 piksel yüksekliğindeki yerel dikte paneline bağlar. Ana panelde iki büyük düğme **Başlat / Durdur** ve **Kopyala**, sağ üstte tamamen kapatan X bulunur. Win+H ve Ctrl+Alt+H ana panel / WorkSpaces içinden başlatır; Ctrl+C yerel kutunun tamamını kopyalar. Metin kutuda kalır, başka uygulamaya otomatik yapıştırılmaz veya gönderilmez.

## Bir kez kurulum

1. Eski Yerel Dikte / CPU Ses Testi uygulamalarını kendi X / Çıkış menülerinden kapat. `Hizir-Bey-Filtreli-Dikte-0.1.0.exe` aç. **Başlat** ilk kez **Filtre ayarları** penceresini açar. Daha sonra sağ alttaki simgenin menüsünden de açılır.
2. [VB-CABLE resmî sayfasından](https://vb-audio.com/Cable/) Windows paketini indir. ZIP'i çıkar, kurulum programını yönetici olarak çalıştır ve bilgisayarı yeniden başlat. Bu üçüncü taraf sürücü uygulama paketine dahil değildir; uygulama sessizce sürücü kurmaz veya sistem mikrofonunu değiştirmez. Her kullanılacak bilgisayarda bir kez kurulmalıdır. Yayıncının lisans koşulları geçerlidir.
3. Filtre ayarlarında **Motoru hazırla / Aygıtları bul** düğmesine bas. Önceki CPU denemesinin özel Python / CPU modelleri tekrar kullanılır. İlk kez kurulan bilgisayarda birkaç yüz MB indirme ve yaklaşık 1–2 GB alan gerekebilir. GPU / CUDA paketi kurulmaz. Yeni ses aktarımı için `sounddevice` eklenir.
4. Gerçek giriş olarak dahili mikrofonunu, temiz ses çıkışı olarak **CABLE Input** aygıtını seç. Ses referansın önceki denemenin `reference.wav` dosyasıdır; en son dahili kayıt bulunursa önerilir. Farklı dosya seçebilirsin. Bu dosyada yalnız senin sesin bulunmalı. Eşleşme sağlamak için sessiz ortamda alınmış 5–60 saniyelik kayıt gerekir.
5. **Win+H mikrofon seçimini aç** düğmesinden Windows sesli yazmanın dişli menüsüne gir. **Varsayılan mikrofon → CABLE Output** seç. Ayar penceresine dönüp bunu seçtiğini işaretle ve **Kaydet** düğmesine bas. **CABLE Input filtreden çıkan sesi alır; CABLE Output Windows'un dinleyeceği mikrofondur.** Bilgisayarın normal hoparlör çıkışını değiştirme.

Win+H'nin kendi mikrofon seçimi dış uygulamadır; bu seçim program tarafından doğrulanamaz. Başka mikrofon seçili kalırsa Windows filtreyi atlayabilir. Programın iç ses yolu ham mikrofona otomatik geri dönmez. Ayar onayı gerekli, ancak kusursuz otomatik doğrulama yerine geçmez.

## Kullanım

**Başlat / Win+H:** CPU motoru ve ses profili hazırlanır. Aynı uygulama açıkken modeller hazır tutulur; sonraki cümlelerde yeniden yüklenmez. Mikrofon ile sanal çıkış başarıyla açılmadan Windows diktesi başlatılmaz. Windows'ta Dinleniyor yazısını bekleyip konuş. İşlenen ses yaklaşık 3–4 saniyelik pencere / işlem gecikmesiyle sanal mikrofona gider; Windows'un kendi tanıma gecikmesi buna eklenir. Bu süre bütün bilgisayarlarda ölçülmüş bir garanti değildir.

**Durdur / ikinci Win+H:** Fiziksel giriş kapatılır; kuyruktaki son kelimeler işlenip aktarılır. **Bitiriliyor** sırasında bekle. Ses aktarımı bittikten sonra Windows diktesi kapatılır; temel cümle sonları kısa sakinleşme aralığından sonra tamamlanır. Son kelimeleri kaybetmemek için pencereyi kapatmak yerine Durdur kullan.

**Kopyala / Ctrl+C:** O anda kutuda görünen taslağın tamamını anında panoya alır. Dinlemeyi durdurmaz, canlı kutuyu veya seçimi değiştirmez. Yalnız kopyalanan anlık metne temel ilk harf / cümle sonu düzenlemesi uygulanır. Yeni metin için Ctrl+A → Delete. Diğer uygulamalarda Ctrl+C normal davranır. LiveChat'te kendin doğru alana tıkla → Ctrl+V → kontrol et → gönder.

Başlatma sırasında düğmeye tekrar basmak bekleyen başlatmayı iptal eder. Escape iptal / durdurma davranışıdır; kuyruk sonunu korumak için normal Durdur düğmesini tercih et. X / Alt+F4 / Çıkış uygulamanın ve kendine ait Python / PowerShell alt süreçlerinin tamamını kapatır; metin bellekte olduğu için gerekli taslağı önce kopyala. Başka AutoHotkey süreçlerini sonlandırmaz. Başlık / logo alanından sürüklenir; önceki Yerel Dikte panel konumu kullanılır.

## Sesine özel seçim ve sınırlar

Yöntem ConvTasNet ile iki ses kaynağını ayırıp, Resemblyzer ile kaynakları senin referansına göre seçmektir. Eşik 0,60 ve iki kaynak arasında fark 0,08'dir. Belirsiz bölümler sessize alınır; ham sesle doldurulmaz. Bu biyometrik güvenlik / kimlik doğrulaması değildir. Başka kişiyi yanlış seçebilir, sesini kesebilir veya müziği yeterince ayıramayabilir. PC hoparlörü ve TV için aynı mikrofon tabanlı yöntem kullanılır; PC'de çalınan sese özel bir yankı referansına bağımlı değildir.

Ayırıcı 8 kHz / iki konuşmacı alanında eğitilmiştir. Referansın, ortamın ve mikrofonun kalitesi etkilidir. Yeni sürüm, modelin büyük / ters işaretli çıktı ölçeğini karışık girişe göre en küçük kareler yöntemiyle dengeler. Sabit +6 dB ve yumuşak çıkış sınırlayıcı kullanılır; bir konuşmanın sonundaki en yüksek değere göre önceki sesi sonradan normalleştirmez. Pencere örtüşmesi ve durdurma kuyruğu tamamlanır. Akış kuyrukları sınırlıdır; motor yetişemez veya aygıt kapanırsa dikte durdurulur.

## Yerel veri ve gereksinimler

Windows 11 x64, çalışan Win+H, gerçek mikrofon, VB-CABLE, CPU motoru ve kendi ses referansın gerekir. Windows sesli yazma kendi internet gereksinimini korur; ses ayırma kurulumdan sonra yereldir. Program sürekli kayıt dosyası oluşturmaz; canlı ses RAM'de işlenir ve yalnız seçilen sanal aygıta verilir. Eşleşme için ses referansı okunur; profil özeti özel klasörde saklanır. Başka sunucuya ses / taslak yükleme, telemetri, API anahtarı veya LiveChat bağlantısı yoktur.

Uygulama / ayarlar / profil: `%LOCALAPPDATA%\HizirBey\FiltreliDikte\0.1.0`. Önceki CPU motoru / modeller: `%LOCALAPPDATA%\HizirBey\CpuSesTesti\0.1.0`. Önceki ses kayıtları değiştirilmez. Panel konumu eski `%LOCALAPPDATA%\HizirBey\WorkSpacesDikte\panel.ini` içindedir. Bu özel dosyalar GitHub / kaynak paketi içinde yoktur. EXE program kodunu ve marka varlıklarını içerir; CPU paketleri ve modeller ilk hazırlıkta indirilir. VB-CABLE ayrı sürücüdür.

## Derleme ve doğrulama

`scripts/build-exe.ps1` resmî SHA-256 doğrulanan AutoHotkey / Ahk2Exe ile tek EXE oluşturur. `scripts/package.py` açık izin listesiyle kaynak ZIP'i oluşturur. Kaynak, bağımlılıkların lisans / kaynak notlarıyla birlikte gelir. Kontroller, sabit dizi testleri, gerçek CPU modelleriyle kamuya açık ses örnekleri, native Windows paneli ve filtre başlat / kuyruk / hata durumlarını kapsar. Test ortamında gerçek VB-CABLE / mikrofon / Win+H hizmeti bulunmadığından bu aygıtlarla uçtan uca davranış kullanıcı bilgisayarında doğrulanmalıdır. Ayrıntılar `TEST-RAPORU.md` içindedir.
