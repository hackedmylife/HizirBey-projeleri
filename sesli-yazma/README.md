# Hızır Bey Sesli Yazma

Chrome / LiveChat için logolu Türkçe dikte uzantısı. Güncel sürüm: **0.1.3**.

**Win + H (Windows yönlendirmesiyle) → konuş → metni oku → Enter ile gönder.**

Chrome’un doğrudan komutu Alt + H olarak kalır. Win tuşu Chrome uzantı komutlarında desteklenmediği için Windows’ta FastKeys veya paketteki ücretsiz AutoHotkey v2 yardımcısı gerekir. [Windows-Kisayol.txt](windows/Windows-Kisayol.txt) adımları içerir; yardımcı kendiliğinden kurulmaz veya başlatılmaz.

## Kurulum

Kurulum paketini sabit bir klasöre çıkar. Chrome'da `chrome://extensions` adresini aç, Geliştirici modu → Paketlenmemiş öğe yükle ile paketteki `extension` klasörünü seç. [KURULUM.txt](KURULUM.txt) ayrıntılı adımları içerir.

Groq hesabını **Free** planında tut, ödeme yöntemi ekleme ve Developer plana yükseltme. Anahtarı yalnızca eklentinin kendi ayar sayfasına bir kez gir. Free hesap ve ses işleme onaylarını kaydet, “Mikrofonu dene” ile mikrofon iznini tamamla. LiveChat sayfasını yenile. Kısayol başka eklentiye atanmışsa `chrome://extensions/shortcuts` sayfasından Alt + H ata.

## Davranış

- Başlatma/durdurma: Windows yönlendirmesi açıkken Win + H; doğrudan Chrome komutu Alt + H. Durdururken son ses parçası tamamlanır.
- Sayfada geniş çubuk yoktur. Dinleme veya metin hazırlanması sürerken sağ üstte tıklamaları engellemeyen 10 px kırmızı nokta görünür; işlem bitince kaybolur. Logolu Başlat/Durdur, geri al ve ayarlar paneli yalnızca Chrome eklenti simgesine tıklanınca açılır. Paneli kapatmak dikteyi durdurmaz.
- Ses, Whisper Large v3 (veya seçilirse Turbo) ile Türkçe yazıya çevrilir. Metin düzeltme açıksa Groq'taki GPT OSS 20B, kontrollü yazım/noktalama düzeltmesi yapar.
- Ses tanıma sonucu, dil düzeltmesinden önce kalite denetiminden geçer. Segment güven verisi eksikse; düşük güven, yüksek sessizlik olasılığı veya aşırı tekrar varsa parça otomatik yazılmaz. Tamamen sessiz olduğu işaretlenen parça atlanır.
- Bilinen altyazı/video kapanış kalıpları, tek başına MK/M.K. ve sınırlı uygunsuz ifade listesi engellenir. Şüpheli parçanın tamamı reddedilir, mikrofon kapanır; önceki yazı korunur ve panelde uyarı gösterilir. Şüpheli sözcüğü silip kalanını otomatik birleştirme yapılmaz. Aynı denetim yazı alanına aktarımın son adımında da uygulanır.
- Dil düzeltmesi yeni bir şüpheli ifade eklerse o düzeltme kullanılmaz; yalnızca denetlenmiş temiz temel metin korunur. Bu denetimler ek bir API çağrısı veya sabit bekleme eklemez.
- Bu filtreler bütün tanıma hatalarını yakaladığı anlamına gelmez. Gerçek kişi/kurum adları ve sayılar hâlâ okunmalıdır. MK gibi gerçek bir baş harf/kod amaçlanmışsa otomatik dikte reddedilebilir; gerektiğinde elle yazılabilir.
- Tutar, sayı, olumsuzluk ve işlem türü değişimleri denetlenir. Şüpheli düzeltmede temel metin korunur ve eklenti panelinde uyarı gösterilir.
- Gerçek LiveChat Lexical editörü hedeflenir. İç not modunda aktarım engellenir.
- Eklenti mesaj göndermez. Kullanıcının normal Enter / Send eylemi sırasında mikrofon oturumu kapanır. İşlem sürerken Enter engellenir; hazır olduğunda yeniden basılır. İlk basış daha sonra kendiliğinden gönderime dönüşmez.
- Mevcut yazıyı silmez. Kullanıcı alanı elle değiştirmişse geç gelen sonuç eklenmez; son metin popup'tan kurtarılabilir.
- Sohbet, sekme veya sayfa değişiminde mikrofon kapanır. 90 saniye sessizlikte ve 15 dakikalık oturum sınırında kayıt sonlandırılır.
- Bağlantı isteği başına 45 saniyeye kadar beklenir. Ağ hatası, zaman aşımı veya geçici sunucu hatasında toplam en fazla 3 deneme yapılır. Yeniden denemeler de yerel ücretsiz kotaya sayılır; 400/401/403/429 hataları tekrar edilmez.
- Ses parçaları sırayla işlenir; tekrar teslim edilen aynı parça iki kez eklenmez. Bekleme durumu ve sıradaki ses süresi eklenti panelinde görünür. Bekleyen ses yaklaşık 106 saniyeye ulaştığında mikrofon kapanır; alınmış ses sırayla tamamlanır. Böylece RAM'deki bekleme yaklaşık iki dakikayla sınırlanır. İptal için Alt + H kullanılabilir. Kalıcı internet kesintisini ortadan kaldırmaz; denemeler tükenirse eldeki yazı korunarak hata gösterilir.
- Mikrofon güçlendirme varsayılan **%135**, aralık **%100–200**. Yüksek seslerde yumuşak sınırlama uygulanır. Konuşma eşiği **0,005** ile daha hassastır. Gürültü bastırma, yankı giderme ve tarayıcı otomatik kazancı istenir; destek donanıma/tarayıcıya bağlıdır. Güçlendirme konuşma algılamasından sonra uygulanır; tek başına ortam gürültüsünü konuşma saydırmaz.
- Özel terim sözlüğü ve isteğe bağlı yerel düzeltme örnekleri vardır. Öğrenme açıkken, boş alanla başlayan aktif dikteyi Enter ile gönderirken yapılan düzenlemeler örnek olarak kaydedilir. Alt + H ile dinleme bitirildikten sonra yapılan düzenlemeler bu sürümde otomatik kaydedilmez.
- Hafıza 10 MB UTF-8 sınırıyla yönetilir; sabit 1000 örnek kesintisi yoktur. Dışa aktarma ve içe aktarma yalnızca sözlük/düzeltmeler içindir.

## Ücretsiz kullanım sınırı

Uygulama ücretli sağlayıcıya geçmez, kota satın almaz veya hesap yükseltmez. API anahtarı tek başına hesabın Free olduğunu kanıtlamaz; Free planını kullanıcı Groq panelinden kontrol eder. Ücretli hesaba ait anahtar kullanılmamalıdır.

Groq'un ses ve metin modellerinin ayrı ücretsiz kotaları vardır. Uygulama ayrıca daha düşük yerel istek sınırları uygular. 429 / kota durumunda işlem durur. Metin düzeltme kotası dolmuşsa eldeki temel metin uyarıyla korunur. Bu sürümde başka sağlayıcıya veya Web Speech'e otomatik geçiş yoktur.

Ücretsiz bulut hizmetinin sürekli/sınırsız olması ve yüzde 100 doğruluk garanti edilmez. Sayı, özel isim ve işlem durumunu göndermeden önce kontrol et.

## Gizlilik ve anahtar politikası

- Anahtar `chrome.storage.local` içinde yalnızca güvenilir eklenti bağlamlarına açık tutulur. Şifreli kasa olarak tanıtılmaz; Chrome profilinin güvenliği önemlidir.
- Ses ve dikte, işlem için Groq'a gider. Müşteri mesajları / görüşme geçmişi servise eklenmez. Sağlayıcının koşulları: [Groq Your Data](https://console.groq.com/docs/your-data).
- Ses yalnızca geçici bellektedir. Son dikte kurtarma kopyası `chrome.storage.session` içindedir ve tarayıcı oturumu bitince silinir.
- Token, anahtar, ses arşivi ve kişisel sözlük/yedekler kod deposuna veya kurulum paketine konmaz.
- Güncellemeyi aynı klasörde, aynı Chrome uzantısına **Yenile** uygulayarak yap; uzantıyı kaldırma. Depolama anahtarları güncellemede sıfırlanmaz.
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
