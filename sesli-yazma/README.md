# Hızır Bey Sesli Yazma

Chrome / LiveChat için logolu Türkçe dikte uzantısı. İlk sürüm: **0.1.0**.

**Alt + H → konuş → düzeltilmiş metin LiveChat yazı alanına eklenir → oku → Enter ile gönder.**

## Kurulum

Kurulum paketini sabit bir klasöre çıkar. Chrome'da `chrome://extensions` adresini aç, Geliştirici modu → Paketlenmemiş öğe yükle ile paketteki `extension` klasörünü seç. [KURULUM.txt](KURULUM.txt) ayrıntılı adımları içerir.

Groq hesabını **Free** planında tut, ödeme yöntemi ekleme ve Developer plana yükseltme. Anahtarı yalnızca eklentinin kendi ayar sayfasına bir kez gir. Free hesap ve ses işleme onaylarını kaydet, “Mikrofonu dene” ile mikrofon iznini tamamla. LiveChat sayfasını yenile. Kısayol başka eklentiye atanmışsa `chrome://extensions/shortcuts` sayfasından Alt + H ata.

## Davranış

- Başlatma/durdurma: Alt + H. Durdururken son ses parçası tamamlanır.
- Ses, Whisper Large v3 (veya seçilirse Turbo) ile Türkçe yazıya çevrilir. Metin düzeltme açıksa Groq'taki GPT OSS 20B, kontrollü yazım/noktalama düzeltmesi yapar.
- Tutar, sayı, olumsuzluk ve işlem türü değişimleri denetlenir. Şüpheli düzeltmede temel metin korunur ve durum çubuğunda uyarı gösterilir.
- Gerçek LiveChat Lexical editörü hedeflenir. İç not modunda aktarım engellenir.
- Eklenti mesaj göndermez. Kullanıcının normal Enter / Send eylemi sırasında mikrofon oturumu kapanır. İşlem sürerken Enter engellenir; hazır olduğunda yeniden basılır. İlk basış daha sonra kendiliğinden gönderime dönüşmez.
- Mevcut yazıyı silmez. Kullanıcı alanı elle değiştirmişse geç gelen sonuç eklenmez; son metin popup'tan kurtarılabilir.
- Sohbet, sekme veya sayfa değişiminde mikrofon kapanır. 90 saniye sessizlikte ve 15 dakikalık oturum sınırında kayıt sonlandırılır.
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
