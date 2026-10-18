# Hızır Bey Sesli Yazma

Chrome / LiveChat için logolu Türkçe dikte uzantısı. Güncel sürüm: **0.1.7**.

**Win + H (Windows yönlendirmesiyle) → konuş → metni oku → Enter ile gönder.**

Chrome’un doğrudan komutu Alt + H olarak kalır. Win tuşu Chrome uzantı komutlarında desteklenmediği için Windows’ta FastKeys veya paketteki ücretsiz AutoHotkey v2 yardımcısı gerekir. [Windows-Kisayol.txt](windows/Windows-Kisayol.txt) adımları içerir; yardımcı kendiliğinden kurulmaz veya başlatılmaz.

## Kurulum

Kurulum paketini sabit bir klasöre çıkar. Chrome'da `chrome://extensions` adresini aç, Geliştirici modu → Paketlenmemiş öğe yükle ile paketteki `extension` klasörünü seç. [KURULUM.txt](KURULUM.txt) ayrıntılı adımları içerir.

Groq hesabını **Free** planında tut, ödeme yöntemi ekleme ve Developer plana yükseltme. Anahtarı yalnızca eklentinin kendi ayar sayfasına bir kez gir. Free hesap ve ses işleme onaylarını kaydet, “Mikrofonu dene” ile mikrofon iznini tamamla. LiveChat sayfasını yenile. Kısayol başka eklentiye atanmışsa `chrome://extensions/shortcuts` sayfasından Alt + H ata.

## Davranış

- Başlatma/durdurma: Windows yönlendirmesi açıkken Win + H; doğrudan Chrome komutu Alt + H. Durdururken son ses parçası tamamlanır.
- Sayfada geniş çubuk yoktur. Dinleme veya metin hazırlanması sürerken ekranın tam ortasında tıklamaları engellemeyen 20 px kırmızı nokta görünür; işlem bitince kaybolur. Logolu Başlat/Durdur, geri al ve ayarlar paneli yalnızca Chrome eklenti simgesine tıklanınca açılır. Paneli kapatmak dikteyi durdurmaz.
- Ses, Whisper Large v3 (veya seçilirse Turbo) ile Türkçe taslağa çevrilir. Kısa duraklarla devam eden sesler, en fazla 12 saniyelik ortak tanıma penceresinde değerlendirilir. Aynı pencerenin yeni sonucu, kendi eski metnini yeniler; kısmi tanımalar art arda eklenmez. En az 1 saniyelik durak yeni pencere açar. Her parçanın sonuna nokta eklenmez. Metin hızlı görünür. Noktalama kontrolü en az 1 saniyelik durakta veya dinlemeyi bitirdiğinde, bütün taslak üzerinden yapılır. Konuşma yeniden başlarsa eski noktalama sonucu uygulanmaz.
- Ses tanıma sonucu, dil düzeltmesinden önce kalite denetiminden geçer. Segment güven verisi eksikse veya çözüm güveni düşükse parça otomatik yazılmaz. Yüksek sessizlik olasılığı tek başına ret nedeni değildir. Yüksek sıkıştırma oranı, düşük güven veya belirgin metin döngüsüyle birlikte değerlendirilir. Tamamen sessiz olduğu işaretlenen parça atlanır.
- Bilinen altyazı/video kapanış kalıpları, tek başına MK/M.K. ve sınırlı uygunsuz ifade listesi engellenir. Şüpheli ses parçasının tamamı yazılmaz; panel, o bölümü tekrar söylemeni ister. Art arda reddetmeler de mikrofonu kapatmaz. Panel, eksik ses bölümü sayısını ve ret nedenini gösterir; mikrofon/gürültü kontrolünü önerir. Aynı ses penceresi sonraki bağlamla temiz tanınırsa o bölümün uyarısı kalkar; önceki pencerelerdeki eksiklik uyarıları kalır. Yazı alanına son aktarım denetimi uygunsuz sonuç görürse kayıt hemen durur. Önceki yazı korunur; şüpheli sözcüğü silip kalanını otomatik birleştirme yapılmaz.
- Dil düzeltmesi yeni bir şüpheli ifade eklerse o düzeltme kullanılmaz; yalnızca denetlenmiş temiz temel metin korunur. Bu denetimler ek bir API çağrısı veya sabit bekleme eklemez.
- Bu filtreler bütün tanıma hatalarını yakaladığı anlamına gelmez. Gerçek kişi/kurum adları ve sayılar hâlâ okunmalıdır. MK gibi gerçek bir baş harf/kod amaçlanmışsa otomatik dikte reddedilebilir; gerektiğinde elle yazılabilir.
- Noktalama modelinin kelime eklemesi, silmesi, sıralaması veya değiştirmesi engellenir. Yalnızca noktalama ve büyük/küçük harf düzenlenebilir. Tutar, sayı, olumsuzluk ve işlem türü denetimleri de korunur. Bu denetim, ses tanımanın kendisindeki tüm kelime hatalarını yakalamaz.
- Gerçek LiveChat Lexical editörü hedeflenir. İç not modunda aktarım engellenir.
- Eklenti kendiliğinden göndermez. Dikte metni yazı alanına eklendikten sonra gerçek bir Enter basışı, aynı görüşmenin etkin Gönder düğmesini bir kez çalıştırır; LiveChat’in Enter/satır ayarını değiştirmek gerekmez. Gönderilen, ekranda gördüğün taslaktır. Mikrofon ve bekleyen dikte kapanır; sonradan gelen sonuç eklenmez. İlk metin henüz yazılmadıysa veya editör yazma işleminin ortasındaysa Enter engellenir; bekletilen tuş sonradan gönderime dönüşmez. Shift + Enter satır açar.
- Dinlemeyi Alt + H ile normal bitirdiğinde de hazır taslağın Enter kısayolu korunur; nokta gizlenir. Gönder düğmesi eksik, kapalı veya belirsizse metin korunur ve açıklama gösterilir. Başka görüşmenin düğmesi kullanılmaz.
- Taslak güncellemesi yalnızca bu oturumun diktesini yeniler; oturum başındaki yazının metni korunur. Geri al bütün mevcut dikte taslağını kaldırır ve yeniden eklenmesin diye mikrofonu kapatır. Kullanıcı alanı elle değiştirmişse geç gelen sonuç eklenmez; son metin popup'tan kurtarılabilir.
- Sohbet, sekme veya sayfa değişiminde mikrofon kapanır. 90 saniye sessizlikte ve 15 dakikalık oturum sınırında kayıt sonlandırılır.
- Ses tanıma isteği başına 45 saniyeye kadar beklenir. Ağ hatası, zaman aşımı veya geçici sunucu hatasında toplam en fazla 3 deneme yapılır. Yeniden denemeler de yerel ücretsiz kotaya sayılır; 400/401/403/429 hataları tekrar edilmez.
- Taslağı aktarma duraklaması varsayılan **0,5 saniye**. Uzun konuşma 4 saniyeden sonra kısa doğal duraklarda veya en geç 8 saniyede parçalanır. İstekler arasında sabit 3,5 saniyelik ara kaldırılmıştır. Yerel dakikalık sınır dolarsa uygun sıra beklenir; günlük veya sağlayıcı sınırında durulur.
- **Hızlı aktarım** varsayılan açıktır. Son noktalama kontrolünün toplam bütçesi 2,5 saniyedir; yetişmezse güvenlik denetiminden geçmiş taslak uyarıyla korunur, zorla son nokta eklenmez. Bu ayar kapatıldığında bütçe 10 saniyedir. Noktalama çağrısı tekrar edilmez. Ses tanıma ve ağ bağlantısının süresi bu bütçeden ayrıdır; sabit bir uçtan uca gecikme garantisi verilmez.
- Küçük panel, son parçanın konuşma bitişinden editöre aktarımına kadar yaklaşık süreyi gösterir. Ses sırada beklediyse bu süreye bekleme de dahildir.
- Ses pencereleri sırayla işlenir; tekrar teslim edilen aynı sonuç iki kez eklenmez. Bağlantı beklerken aynı pencerenin henüz gönderilmemiş eski önizlemeleri en yenisiyle birleştirilir. Söylenen gerçek tekrarlar benzer kelime diye silinmez. Yeniden tanınan pencerenin bütün ses süresi her denemede kotaya sayılır. Bekleme durumu ve sıradaki ses süresi eklenti panelinde görünür. İşlenen ve sıradaki ses pencerelerinin toplam süresi yaklaşık 106 saniyeye ulaştığında mikrofon kapanır; alınmış ses sırayla tamamlanır. Pencerelerde tekrar değerlendirilen bağlam da bu sayıya dahildir. RAM'deki bekleme yaklaşık iki dakikalık PCM ile sınırlanır. İptal için Alt + H kullanılabilir. Kalıcı internet kesintisini ortadan kaldırmaz; denemeler tükenirse eldeki yazı korunarak hata gösterilir.
- Mikrofon güçlendirme varsayılan **%135**, aralık **%100–200**. Yüksek seslerde yumuşak sınırlama uygulanır. Konuşma eşiği **0,005** ile daha hassastır. Gürültü bastırma, yankı giderme ve tarayıcı otomatik kazancı istenir; destek donanıma/tarayıcıya bağlıdır. Güçlendirme konuşma algılamasından sonra uygulanır; tek başına ortam gürültüsünü konuşma saydırmaz.
- Özel terim sözlüğü ve isteğe bağlı yerel düzeltme örnekleri vardır. Noktalamada yalnızca aynı kelimeleri aynı sırada koruyan öğrenilmiş örnekler kullanılabilir; diğer düzeltmeler yedekte saklanır. Öğrenme açıkken, boş alanla başlayan aktif dikteyi Enter ile gönderirken yapılan düzenlemeler örnek olarak kaydedilir. Alt + H ile dinleme bitirildikten sonra yapılan düzenlemeler bu sürümde otomatik kaydedilmez.
- Bir dikte taslağı 8.000 karaktere ulaşınca mevcut metin korunarak kayıt sonlandırılır. Hafıza 10 MB UTF-8 sınırıyla yönetilir; sabit 1000 örnek kesintisi yoktur. Dışa aktarma ve içe aktarma yalnızca sözlük/düzeltmeler içindir.

## Ücretsiz kullanım sınırı

Uygulama ücretli sağlayıcıya geçmez, kota satın almaz veya hesap yükseltmez. API anahtarı tek başına hesabın Free olduğunu kanıtlamaz; Free planını kullanıcı Groq panelinden kontrol eder. Ücretli hesaba ait anahtar kullanılmamalıdır.

Groq'un ses ve metin modellerinin ayrı ücretsiz kotaları vardır. Uygulama ayrıca daha düşük yerel istek sınırları uygular. Sağlayıcının 429 cevabında veya günlük uygulama sınırında işlem durur; dakikalık yerel sınırda ses sırası bekler. Metin düzeltme kotası dolmuşsa eldeki temel metin uyarıyla korunur. Bu sürümde başka sağlayıcıya veya Web Speech'e otomatik geçiş yoktur.

Ücretsiz bulut hizmetinin sürekli/sınırsız olması ve yüzde 100 doğruluk garanti edilmez. Sayı, özel isim ve işlem durumunu göndermeden önce kontrol et.

## Gizlilik ve anahtar politikası

- Anahtar `chrome.storage.local` içinde yalnızca güvenilir eklenti bağlamlarına açık tutulur. Şifreli kasa olarak tanıtılmaz; Chrome profilinin güvenliği önemlidir.
- Ses ve dikte, işlem için Groq'a gider. Müşteri mesajları / görüşme geçmişi servise eklenmez. Sağlayıcının koşulları: [Groq Your Data](https://console.groq.com/docs/your-data).
- Ses yalnızca geçici bellektedir. Son dikte kurtarma kopyası `chrome.storage.session` içindedir ve tarayıcı oturumu bitince silinir.
- Token, anahtar, ses arşivi ve kişisel sözlük/yedekler kod deposuna veya kurulum paketine konmaz.
- Güncellemeyi aynı klasörde, aynı Chrome uzantısına **Yenile** uygulayarak yap; uzantıyı kaldırma. Depolama anahtarları güncellemede sıfırlanmaz.
- Eski varsayılan 1 saniyelik cümle sonu bekleme 0,5 saniyeye taşınır. Diğer özel beklemeler korunur; 0.1.4 ile bilinçli seçilen 1 saniye de korunur. Hızlı aktarım varsayılan açıktır.
- 0.1.0'ın varsayılan 0,008 konuşma eşiği 0,005'e taşınır; diğer özel eşik seçimleri korunur. Anahtar, izinler, sözlük ve öğrenme tercihleri korunur. Yeni güçlendirme ayarı %135 ile başlar.

## Geliştirici kontrolleri

Node 22.13+ (veya 24) ve Python 3 kullan:

```sh
npm ci
npm run lint
npm test
npm run check
npm run package
```

Uygulama saf ES modülleridir; son kullanıcı için Node/Python veya build adımı gerekmez.

Tarayıcı kontrolleri (sahte LiveChat, sahte mikrofon, sahte API; gerçek hesap/mesaj yok):

```sh
npx playwright install chromium
node tests/browser.mjs
TEST_AUDIO=/absolute/path/to/test.wav node tests/extension.mjs
```

`PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `QA_OUTPUT` değişkenleri isteğe bağlıdır. DOM testleri emüle edilmiş DOM'da çalışır; gerçek Lexical uygulamasının durum güncellemesinin yerini tutmaz. Chromium başlatma kısıtları olan ortamlarda tarayıcı testleri ayrıca uyumlu bir ortamda çalıştırılmalıdır.

## Doğrulama durumu

Yerel birim/oturum/DOM kontrolleri ve lint, teslimden önce çalıştırılır. Gerçek kullanıcı mikrofonuyla Türkçe doğruluk ve kullanıcının canlı LiveChat hesabı henüz doğrulanmış sayılmaz. Ayrıntı için [TEST-RAPORU.md](TEST-RAPORU.md).
