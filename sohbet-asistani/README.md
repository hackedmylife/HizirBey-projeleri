# Hızır Bey Sohbet Asistanı — 0.2.0

LiveChat görüşmesindeki mesajları okuyup müşteriye gönderilebilecek üç profesyonel Türkçe yanıt hazırlar: **Kısa ve net**, **Açıklayıcı**, **Empati ve çözüm**. FastKeys arşivi bilgi kaynağıdır. Yapay zekâ özgün yanıt yazabilir; arşivde eşleşme bulunması yanıt üretiminin ön şartı değildir.

Panel yalnızca önerir ve kopyalar. Mesaj göndermez, LiveChat yazı alanını değiştirmez, FastKeys makrolarını çalıştırmaz. Süre takip eklentisi ayrı çalışır.

## Mevcut eklentiyi güncelleme

1. Eklentiyi Chrome'dan **kaldırmayın**.
2. ZIP içindeki `extension` klasörünün **içeriğini**, Chrome'a daha önce yüklediğiniz mevcut `extension` klasörünün içine kopyalayın; aynı adlı dosyaları değiştirin.
3. Mevcut klasörün yolunu koruyun. `chrome://extensions` ekranında Hızır Bey Sohbet Asistanı kartındaki yeniden yükle düğmesine basın.
4. LiveChat sekmesini yenileyin. Panel sürümü **0.2.0** olmalı.
5. Ayarlarda kayıtlı Groq anahtarının bulunduğunu kontrol edin. Gemini ve OpenRouter anahtarlarını ekleyip ilgili bağlantıları etkinleştirin ve kaydedin.

Aynı klasör ve eklenti kimliği korunursa önceki Groq anahtarı, içe aktarılan FastKeys arşivi ve Windows bağlantısı kullanılmaya devam eder. Yeni sağlayıcı ayarlarına geçiş eski anahtarı korur. Anahtar alanını boş bırakmak mevcut anahtarı silmez; silmek için o sağlayıcının ayrı kutusu gerekir. Windows yardımcısını yeniden kurmak gerekmez.

## İlk kurulum ve bağlantılar

1. ZIP'i kalıcı bir klasöre çıkarın. Chrome'da `chrome://extensions` açıp Geliştirici modunu etkinleştirin.
2. Paketlenmemiş öğe yükle ile `extension` klasörünü seçin.
3. Eklenti simgesinden ayarları açın. FastKeys `.fdb` dosyasını içe aktarın.
4. Yapay zekâ ile yanıt üretimini açın. Kullanacağınız sağlayıcılara anahtar ekleyin, servisleri etkinleştirin ve sırayı seçin.
5. Ayarları kaydedin. Her servis için **Kaydedilen bağlantıyı dene** düğmesi kullanılabilir. Bu test kısa bir gerçek API isteği yapar; kaydedilmiş anahtarı kullanır.
6. LiveChat sekmesini yenileyip bir görüşme açın. Son mesaj üyedense yanıtlar otomatik hazırlanır. Son mesaj temsilci/bottansa Yenile ile değerlendirin.
7. Cevabı kontrol edip Kopyala'ya basın. Arama kutusu FastKeys'in **orijinal metinlerini** gösterir.

| Sağlayıcı | Varsayılan model | Anahtar sayfası |
|---|---|---|
| Groq | `openai/gpt-oss-20b` | https://console.groq.com/keys |
| Gemini | `gemini-2.5-flash-lite` | https://aistudio.google.com/apikey |
| OpenRouter | `openrouter/free` | https://openrouter.ai/settings/keys |

Model erişimi ve API kotaları hesaplara bağlıdır. Gemini model kimliği değiştirilebilir. OpenRouter için belirli bir ücretsiz modelin `servis/model:free` kimliği kullanılabilir. `openrouter/free`, isteğin özelliklerine uygun ücretsiz modellerden seçer; hangi modelin seçileceği ve Türkçe yanıt kalitesi değişebilir. Aynı OpenRouter hesabının ortak limitleri model değiştirerek sınırsız hale gelmez.

## Kalıcı FastKeys bilgisi

- Düz metinler, kaynak koşullar ve konu indeksi tarayıcı profilinde saklanır. Anahtar gerekmeden yerel hazırlık yapılır.
- Yapay zekâ açık ve en az bir bağlantı hazır olduğunda arşiv **tam metinlerle küçük gruplar halinde** arka planda analiz edilir. Başlık, konu, eşanlamlılar ve kaynakta birebir bulunan koşul alıntıları saklanır. Makrolar ve iç not/komut kayıtları AI analizine alınmaz.
- Hazırlık ilerlemesi ayarlarda ve panelde gösterilir. Yanıt üretimi, tüm analizin bitmesini beklemez. Canlı yanıtlar önceliklidir; son değerlendirmeden sonra en az 30 saniye boşluk varsa arşiv analizi ilerler.
- Arşiv ve her kaydın SHA-256 özeti kullanılır. Aynı içerik yeniden içe aktarılırsa önceki analiz korunur. Değişen kayıtlar yeniden hazırlanır; diğer kayıtların analizi tekrar kullanılabilir.
- Hazırlığın kaldığı nokta kalıcıdır. Servis çalışanı veya tarayıcı yeniden açıldığında devam edebilir. Chrome alarmı duraklamış işi tekrar kontrol eder; tarayıcı kapalıyken hazırlık çalışmaz.
- Bu, modeli kalıcı eğitmek değildir. Uygulama bilgi tabanını saklar ve her yanıt isteğinde ilgili kaynakları sağlar. Tüm arşiv her görüşmede gönderilmez.

## Yanıt üretimi ve otomatik servis geçişi

- Tek sistem talimatı tüm sağlayıcılarda aynı üslubu uygular: saygılı, sakin, müşteri ve çözüm odaklı, doğal Türkçe.
- Üye, temsilci ve bot mesajları ayrı değerlendirilir. Üyenin talebi ve önceki bağlam korunur; verilmiş kupon/tur ID'si tekrar istenmemeye çalışılır.
- Arşivde uygun kaynak yoksa AI özgün yardım veya netleştirme yanıtı yazabilir. Kaynakta bulunmayan şirket kuralı ve işlem sonucu yazmasına izin verilmez.
- JSON biçimi, üç ayrı tamamlanmış yanıt, kaynak kimlikleri, sayılar, tutar/süre birimleri, bağlantılar, SMS tek kullanım şartı ve doğrulanmamış işlem iddiaları yerel olarak kontrol edilir. Geçersiz yanıt gösterilmeden sıradaki bağlantı denenir. Bu kontroller tüm anlam hatalarını tespit eden bir garanti değildir; temsilci incelemesi gerekir.
- Kota, zaman aşımı, servis hatası veya geçersiz yanıtta yalnızca etkin ve anahtarı kayıtlı bağlantılar seçilen sırada denenir. Her sağlayıcının bekleme/istek bütçesi ayrıdır. Bir değerlendirmede her sağlayıcı en fazla bir kez denenir.
- Kota beklemesi sonraki LiveChat sekmelerinde de uygulanır ve tarayıcı oturumunda korunur. Başarılı geçişte aradaki hata paneli kesmez; kullanılan sağlayıcı alt kısımda görünür.
- Başarılı aynı görüşme sonucu 5 dakika önbelleğe alınır. Arşiv veya ayar değişikliği önbelleği temizler. Görüşme değişince önceki istek iptal edilir; kopyalama anında görüşme tekrar kontrol edilir.
- Tüm bağlantılar kullanılamazsa üç **Hazır destek yanıtı** gösterilir. Bunlar yeni AI çıktısı değildir ve açıkça işaretlenir. Görünür, değişmemiş görüşmede 120 saniyeyi aşmayan beklemeler için en fazla üç otomatik yeniden deneme yapılır.
- Kontrol gerektiren önerilerde kopyalama, doğrulama kutusu işaretlenene kadar kapalıdır. Orijinal hesap sonucu kalıpları arşiv aramasında da bu korumayı kullanır.

## Ücretli OpenRouter seçeneği

Varsayılan ücretli geçiş **kapalıdır**. Ücretli model kimliği girilirse ayrı izin kutusunu açın ve 1–100 USD arasında aylık sınır seçin. OpenRouter anahtar sayfasında aynı anahtara bu tutarı aşmayan **aylık kredi sınırı** tanımlayın.

Ayar kaydedilirken ve her ücretli isteğin öncesinde anahtarın servis tarafındaki aylık limiti doğrulanır. Aylık limit yoksa, üst sınır seçilen bütçeden büyükse veya kalan kredi yoksa ücretli istek gönderilmez. Sınır OpenRouter tarafından uygulanır; uygulama hesabın limitini yükseltmez. Groq veya Gemini hesabında ücretli faturalama açıksa o servislerin kendi ücretleri/sınırları ayrıca geçerlidir. API erişimi ChatGPT/Gemini uygulama aboneliğiyle aynı ürün değildir.

## FastKeys dosyasını otomatik takip

Windows 10/11, Windows PowerShell 5.1 ve .NET Framework gerekir; Python gerekmez.

1. Ayarlardan eklenti kimliğini kopyalayın.
2. `windows/Kurulum.cmd` dosyasını çalıştırıp kimliği girin ve kullanılan **asıl** FastKeys `.fdb` dosyasını seçin.
3. Ayarlarda Bağlantıyı kontrol et düğmesine basın. Otomatik FastKeys bağlantısını kullan kutusunu açıp kaydedin.
4. FastKeys değişikliklerini kaydedin. Görünür LiveChat paneli yaklaşık 10 saniyede dosyayı kontrol eder; kaydedilmemiş değişiklikler okunmaz.

Yardımcı yalnızca seçilen dosyayı okur, dosyaya yazmaz. Dosya değişirken tutarsız okuma olursa veya bağlantı kurulamazsa son başarılı arşiv korunur. Başka klasöre taşınan eklentinin kimliği değişirse Windows bağlantısını yeni kimlikle tekrar kurun. Kaldırmak için `windows/Kaldir.ps1` kullanılabilir; asıl FastKeys dosyası silinmez.

## Veri ve saklama

AI analizi için kullanılabilir FastKeys metinleri; yanıt üretimi için son görüşme mesajları ve ilgili kaynaklar etkin API bağlantılarına gönderilir. Bir istek başarısız olduğunda aynı içerik sonraki etkin sağlayıcıya gidebilir. İsim/kullanıcı adı alanları DOM'dan ayrıca okunmaz; mesajdaki e-posta, uzun numara ve bağlantılar kısmen maskelenir. Bu tam anonimleştirme değildir.

Anahtarlar yalnızca güvenilen eklenti sayfalarına açık `chrome.storage.local` içinde saklanır; şifreli kasa değildir. Ayarlar ekranına bile anahtarın gerçek değeri geri verilmez; yalnızca kayıtlı olup olmadığı bildirilir. ZIP/GitHub'a anahtar, oturum, kullanıcı FastKeys dosyası veya oluşturulan kişisel bilgi tabanı eklenmez. Aynı kimlikle güncelleme yerel kayıtları korur; eklentiyi kaldırmak Chrome profilindeki kayıtlarını siler.

## Doğrulama ve sınırlar

`npm test` ile 52 Node testi geçer. Testlerde sahte API yanıtları kullanılır: servis geçişi, 429 beklemesi, zaman aşımı, bozuk çıktı, aylık ücret sınırı, anahtar geçişi, önbellek, iptal, kalıcı arşiv analizi, kaynak koruması ve özgün yanıt üretimi doğrulanır. Tüm JavaScript dosyaları sözdizimi kontrolünden geçer; ayar HTML kimlikleri ve script bağlantıları statik olarak kontrol edilir.

Gerçek API anahtarıyla Groq/Gemini/OpenRouter üretimi ve Türkçe model kalitesi **bu ortamda denenmedi**. Chrome çalıştırıcısı bulunmadığı için görsel tarayıcı kontrolü tamamlanamadı. Gerçek LiveChat DOM'u, pano erişimi, Chrome servis çalışanının yaşam döngüsü ve Windows native host kurulumu kullanıcının ortamında kontrol edilmelidir. Sınırsız ücretsiz kullanım, her durumda doğru cevap veya tamamen kesintisiz servis garantisi verilmez.

## Kaynaklar ve geliştirme

API sözleşmeleri: [Groq metin üretimi](https://console.groq.com/docs/text-chat), [Gemini generateContent](https://ai.google.dev/api/generate-content), [OpenRouter ücretsiz model yönlendirme](https://openrouter.ai/docs/guides/routing/routers/free-router), [OpenRouter kredi ve limitler](https://openrouter.ai/docs/api/reference/limits).

`core.js`: FastKeys ayrıştırma ve arama. `knowledge.js`: kalıcı bilgi hazırlığı. `retrieval.js`: konu ve koşul sıralaması. `composer.js`: profesyonel yanıt talimatı, doğrulama ve hazır destek yanıtları. `providers.js`: sağlayıcılar, geçiş, bekleme ve ücret kontrolü. `background.js`: güvenilen erişim ve hazırlık işleri. `reader.js`: LiveChat DOM okuma. `content.js`: öneri/kopyalama paneli. `windows/NativeHost.cs`: seçilen dosyanın yerel okunması.
