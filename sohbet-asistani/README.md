# Hızır Bey Sohbet Asistanı — 0.3.3

LiveChat görüşmesindeki mesajları okuyup müşteriye gönderilebilecek üç profesyonel Türkçe yanıt hazırlar: **Kısa ve net**, **Açıklayıcı**, **Empati ve çözüm**. FastKeys arşivi isteğe bağlı bilgi kaynağıdır; bu sürümde otomatik yanıtlarda kapalıdır. Yapay zekâ özgün yanıt yazabilir; arşivde eşleşme bulunması yanıt üretiminin ön şartı değildir.

Panel yalnızca önerir ve kopyalar. Mesaj göndermez, LiveChat yazı alanını değiştirmez, FastKeys makrolarını çalıştırmaz. Süre takip eklentisi ayrı çalışır.

## 0.3.3 geniş öğrenme hafızası

- Olumlu yanıt örnekleri için bütçe **10.000.000 bayt (10 MB)** oldu. 1.000 kayıt sınırı **20.000** olarak yükseltildi. İki sınırdan önce dolan uygulanır; üye bağlamı ve yanıt uzunluğuna göre gerçek örnek sayısı değişir. Bu, her koşulda 20.000 kayıt saklama garantisi değildir.
- Güncelleme kayıtları başka yere taşımaz, hafızayı temizlemez ve örnek şemasını değiştirmez. Önceki 1.000 örnek, aynı Chrome profili ve eklenti kimliği korunarak kullanılmaya devam eder. Yeni örnekler eski kapasitede durmaz.
- Chrome'un eklenti depolama kotasına takılmamak için `unlimitedStorage` izni eklendi. Uygulamanın kendi 10 MB / 20.000 olumlu örnek sınırı uygulanmaya devam eder. Arşiv, ayarlar, API anahtarları ve geri bildirimler ayrıca saklanır; iznin eklenmesi bunları silmez.
- Ayarlarda kullanılan MB, örnek sayısı ve kapasite çubuğu görünür. Panelde de kullanılan alan gösterilir. Yüzde 95'e yaklaşıldığında yedek alma bilgisi gösterilir. Kapasite dolduğunda önceki davranış devam eder: düzeltilmiş/onaylı örnekler önceliklidir, eski otomatik örnekler yenileriyle değişebilir. Tam arşiv gerektiğinde JSON yedeğini saklayın.
- Boyut bütçesi, her elemede bütün hafızayı tekrar metne dönüştürmek yerine tek geçişte hesaplanır. Değişmeyen kayıt boyutları ve arama bilgileri önbelleğe alınır. Örnek seçimi konu ve kelime indeksinden yapılır; konu kontrolleri ve düzeltme önceliği korunur. İndeks servis çalışanında yereldir, API'ya gönderilmez.
- Her AI yanıtına yine en fazla üç ilgili yazım örneği ve bir olumsuz örnek eklenir; 2.400 karakterlik örnek bütçesi büyütülmedi. Daha büyük hafıza daha çok görüşme durumunu kapsayabilir; tek başına doğru cevap veya daha hızlı API yanıtı garantisi değildir.
- Yedek dosyası kabul sınırı **25 MB** oldu; bu, 10 MB olumlu hafızanın biçimlendirilmiş JSON'una ve geri bildirimlere yer bırakır. Eski sürüm yedekleri de aynı alandan içe aktarılabilir. Örneklerin 10 MB / 20.000 sınırı geri yüklemede ayrıca doğrulanır.

## 0.3.2 öğrenilmiş örneklerle yanıt ve hafıza yedeği

- **FastKeys’i otomatik yanıtlara kaynak olarak ekle** bu sürümde varsayılan kapalıdır; eski ayarlarda bu alan yoksa güncellemeden sonra kapalı kabul edilir. Mevcut arşiv ve API anahtarları korunur. Otomatik yanıtlar güncel görüşme ve ilgili öğrenilmiş yazım örnekleri üzerinden hazırlanır. FastKeys kapalıyken metinleri AI yanıt isteğine eklenmez ve arşiv için AI analizi yapılmaz. Arşivde açıkça yapılan kalıp araması ayrı bir elle arama işlemidir; kutu istenirse yeniden açılabilir.
- Hesap kapatma, kumarı bırakma/ara verme ve sürekli kaybetme mesajları ayrı niyetlerdir. Kapatma talebi bekleme, öfke veya kayıp anlatımı arasında korunur; açık yeni bir işlem konusuna geçilirse yeni konu değerlendirilir. “Hesabım kapandı” veya kupon sonucu itirazı kapatma talebi sayılmaz.
- Bu konularda alakasız öğrenilmiş örnekler elenir; eski sürümde genel olarak sınıflanmış örnekler de güncel talep üzerinden değerlendirilir. AI'ya kapatma talebini yeniden genel bir soruya dönüştürmemesi ve üyeyi bonus/yeniden oynamaya yönlendirmemesi söylenir. Bu anlam kontrolleri hatasız bir dil anlayışı garantisi değildir.
- AI bağlantısı yanıt veremediğinde üç **Hazır destek yanıtı** gösterilir. Bu sürümde kapatma, bırakma ve kayıp şikâyetlerinde konuya uygun ayrı yanıtlar vardır. Bunlar model tarafından o anda üretilmiş cevap değildir. Anahtar/model/bütçe ayarı sorununda hangi bağlantının kontrol edileceği bildirilir; eklenti hatalı API anahtarını kendisi düzeltemez.
- **Ayarlar → Öğrenme yedeği → Öğrenme yedeğini indir**, JSON dosyası indirir. Üye bağlamı, öğrenilmiş yanıtlar, düzeltme/onay bilgileri, uygun bulunmayan yanıtlar ve silinmiş örneklerin kimlikleri dahil edilir. Yedek model ağırlıkları veya tüm görüşme arşivi değildir. API ayarları, anahtarlar, FastKeys arşivi ve oturum dahil edilmez.
- Aynı bölümde JSON seçip **Birleştirerek yükle** ile başka bir profil veya sonraki kuruluma geri yüklenebilir. Dosya en fazla 25 MB olabilir; şema, alanlar, roller ve kapasite doğrulanır, kişisel bilgi filtresi yeniden uygulanır. Geçersiz dosyada kayıtlar değiştirilmez. Aynı örnek çoğaltılmaz; mevcut düzeltme/onaylar ve silinmiş kayıt tercihleri korunur. 20.000 olumlu örnek / 10 MB ve geri bildirim sınırları geri yüklemede de uygulanır.
- Yedek konuşma parçaları içerir. Temizleme sezgiseldir; dosyayı kendi cihazında saklayın. Yedek alma ayrıca API çağrısı yapmaz ve kişisel yedek ZIP/GitHub sürüm paketine eklenmez.

## 0.3.1 arama alanında asistan ve birlikte öğrenme

- **Hızır Bey** düğmesi LiveChat'in üst orta **Search** alanının yanına yerleşir. Yer yoksa aynı alanın hemen altında görünür. Arama alanı erişilebilir etiket, metin ve ekran konumuyla bulunur; bulunamazsa üst orta konum kullanılır. LiveChat'in Search alanı ve Ctrl+K kısayolu kullanılmaya devam eder.
- Düğmeye basınca panel açılır/kapanır. Paneldeki **×** yalnızca asistanı gizler; görüşmeyi kapatmaz ve mesaj yazma alanını değiştirmez. Panel sayfayı kilitlemez; arka plan perdesi ve odak tuzağı yoktur. Mesaj alanının sınırına göre yüksekliği ayarlanır; mesaj yazma bölümünün üzerinde sona erer. Panelin içeriği kendi içinde kaydırılır.
- Kapalı durumda yeni yanıt üretimi başlatılmaz ve bekleyen asistan yanıtı iptal edilir. Aynı sekmede sayfa yenilense de panelin kapalı durumu korunur; **Hızır Bey** ile yeniden açılır. Bu görüntü tercihi diğer sekmelerin panelini kapatmaz. FastKeys takibi görünür sekmede devam eder.
- **Paneli kapatmak öğrenmeyi durdurmaz.** Üstte kalan **Öğrenmeyi durdur / başlat** düğmesi bütün sekmeler için otomatik toplamayı ayrıca yönetir.
- Öğrenme yalnızca temsilci yanıtı değildir: **üye talebi + önceki üye/temsilci mesajları + gönderilmiş temsilci yanıtı** birlikte değerlendirilir. Yanıttan önceki en fazla 20 yüklü mesaj taranır; anlamlı üye talebi korunarak en fazla sekiz temizlenmiş bağlam mesajı saklanır. Temsilci art arda birkaç mesaj göndermiş olsa da erişilebilir üye talebi örnekten düşürülmez. Bunlar görüşmenin tamamını kaydeden bir arşiv değildir.
- AI'ya verilen örnekte üye talebi ayrı `request` alanında ve rolü belirtilmiş kısa bağlamda yer alır. Böylece cevap, hangi talebe verildiğiyle birlikte bir yazım örneği olur. Ayarlarda **Kaydedilmiş örnekleri göster → Üye mesajları ve konuşma bağlamı** bölümünden kayıt gözden geçirilebilir. Eski örneklerde yalnızca önceki sürümün kaydettiği bağlam bulunur.
- “Merhaba, ikinci SMS bonusu istiyorum” gibi selamla başlayan gerçek talepler artık sıradan selamlama diye elenmez. Bu iyileştirme yalnızca SMS için değildir; diğer konulara da uygulanır.

## Otomatik görüşme örnekleri

- Görüşmelerden öğrenme bu sürümde varsayılan açıktır. Eklentinin erişebildiği **tüm LiveChat sekmelerinde**, DOM'a yüklenmiş görüşme alanları okunur. İlk kullanımda yüklenmiş geçmişten de uygun örnekler alınabilir. Ekrana hiç yüklenmemiş görüşmeler ve sunucudaki kapalı arşiv bu yöntemle okunamaz; LiveChat API bağlantısı eklenmedi.
- Temsilcinin gerçekten gönderilmiş yanıtı, öncesindeki kısa konuşma bağlamıyla yazım örneği olur. Bot mesajları ve asistanın son önerilerinin değişmeden gönderilmiş halleri otomatik örnek sayılmaz. Aynı örneğin tekrarı yeni bir eğitim sinyali olarak çoğaltılmaz.
- Panelde **Öğrenme açık · N örnek** ve **Durdur / Başlat** kontrolü görünür. Bir sekmeden durdurma bütün sekmeler için geçerlidir ve tarayıcı yeniden açıldığında korunur. Paneli kapatmak örnek toplamayı kapatmaz; öğrenme düğmesi üstteki asistan kontrolünde görünür kalır.
- Yeniden başlatmada açık görüşmelerin başlangıç durumu alınır; durdurma sırasında gelen mesajlar sonradan otomatik örneğe dönüştürülmez. Yeni açılan bir sekmede de ilk geçmiş, durdurma/başlatma sonrasında yeniden toplama kaynağı yapılmaz. Mesaj yükleme sınırları ve tarayıcı arka plan zamanlayıcıları nedeniyle her olayın yakalanması garanti değildir.
- **Durdur** yalnızca otomatik toplama içindir. Önceden öğrenilmiş örnekler kullanılabilir; ayarlardaki **Kaydedilmiş örnekleri yanıt üretiminde kullan** kutusu bu kullanımı ayrıca kapatır. Elle yapılan düzeltme veya onay, açık bir örnek ekleme işlemidir ve otomatik toplama durdurulmuşken de kullanılabilir.
- Yanıt kartlarında **Beğendim**, **Uygun değil** ve **Düzelt ve öğret** bulunur. Düzeltme alanı yalnızca örneği kaydeder; LiveChat'e mesaj göndermez veya yazı alanını değiştirmez. Düzeltmeler/onaylar otomatik örneklerden önceliklidir. Beğenilmeyen cevap yaklaşımı ilgili sonraki değerlendirmeye olumsuz örnek olarak taşınır.
- Ayarlardan örnekler görülebilir, tek tek silinebilir veya hafıza temizlenebilir. Silinen aynı örneğin pasif okumayla yeniden eklenmesi engellenir. Açık bir Beğendim/düzeltme işlemi örneği yeniden ekleyebilir. Hafıza temizliği API anahtarlarını ve FastKeys arşivini silmez.
- En fazla 20.000 olumlu örnek ve olumlu örnekler için 10 MB tutulur; ayrıca en fazla 100 olumsuz örnek ve silinmiş örneklerin sınırlı kimlik listesi saklanır. Kapasite dolduğunda otomatik eski örnekler önce elenir; düzeltilmiş/onaylı örnekler korunmaya çalışılır.
- Bilinen isim/kimlik alanları, iletişim bilgileri, uzun tanımlayıcılar, şifre alanları ve sayılar saklamadan önce maskelenir. Hesap sonucu iddiaları ayıklanır; değişken şirket koşulları yer tutucuya çevrilir. Bu sezgisel işlemler tam anonimleştirme veya hatasız sınıflandırma garantisi değildir. Kaydedilen metinler ayarlardan gözden geçirilebilir ve silinebilir.
- Benzer bağlamdan seçilen en fazla üç sınırlı örnek ve bir uygun bulunmayan yanıt, yeni cevap isteğine yazım verisi olarak eklenir. Örnek toplamak ayrıca bir AI isteği yapmaz; örneklerin cevap istemine eklenmesi token kullanımını artırabilir. FastKeys açık olduğunda şirket kuralları için esas kaynak olur. Kapalıyken geçmiş yazım örneklerinden yeni şirket koşulu veya işlem sonucu üretilmez. Örnekler modele kalıcı eğitim/fine-tuning uygulamaz; uygulama geçmiş örnekleri saklar ve gerektiğinde sağlar.

## Mevcut eklentiyi güncelleme

1. Eklentiyi Chrome'dan **kaldırmayın**.
2. ZIP içindeki `extension` klasörünün **içeriğini**, Chrome'a daha önce yüklediğiniz mevcut `extension` klasörünün içine kopyalayın; aynı adlı dosyaları değiştirin.
3. Mevcut klasörün yolunu koruyun. `chrome://extensions` ekranında Hızır Bey Sohbet Asistanı kartındaki yeniden yükle düğmesine basın.
4. LiveChat sekmesini yenileyin. Panel sürümü **0.3.3** olmalı.
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
- FastKeys kaynak olarak açık, yapay zekâ açık ve en az bir bağlantı hazır olduğunda arşiv **tam metinlerle küçük gruplar halinde** arka planda analiz edilir. Başlık, konu, eşanlamlılar ve kaynakta birebir bulunan koşul alıntıları saklanır. Makrolar ve iç not/komut kayıtları AI analizine alınmaz.
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
4. FastKeys değişikliklerini kaydedin. Görünür LiveChat sekmesi yaklaşık 10 saniyede dosyayı kontrol eder; kaydedilmemiş değişiklikler okunmaz.

Yardımcı yalnızca seçilen dosyayı okur, dosyaya yazmaz. Dosya değişirken tutarsız okuma olursa veya bağlantı kurulamazsa son başarılı arşiv korunur. Başka klasöre taşınan eklentinin kimliği değişirse Windows bağlantısını yeni kimlikle tekrar kurun. Kaldırmak için `windows/Kaldir.ps1` kullanılabilir; asıl FastKeys dosyası silinmez.

## Veri ve saklama

AI analizi için kullanılabilir FastKeys metinleri; yanıt üretimi için son görüşme mesajları, ilgili kaynaklar ve seçilmiş öğrenilmiş örnekler etkin API bağlantılarına gönderilir. Bir istek başarısız olduğunda aynı içerik sonraki etkin sağlayıcıya gidebilir. İsim/kullanıcı adı alanları DOM'dan ayrıca okunmaz; mesajdaki e-posta, uzun numara ve bağlantılar kısmen maskelenir. Bu tam anonimleştirme değildir.

Anahtarlar yalnızca güvenilen eklenti sayfalarına açık `chrome.storage.local` içinde saklanır; şifreli kasa değildir. Ayarlar ekranına bile anahtarın gerçek değeri geri verilmez; yalnızca kayıtlı olup olmadığı bildirilir. ZIP/GitHub'a anahtar, oturum, kullanıcı FastKeys dosyası veya oluşturulan kişisel bilgi tabanı eklenmez. Aynı kimlikle güncelleme yerel kayıtları korur; eklentiyi kaldırmak Chrome profilindeki kayıtlarını siler.

## Doğrulama ve sınırlar

`npm test` ile 108 Node testi geçer. Testlerde sahte API yanıtları kullanılır: servis geçişi, 429 beklemesi, zaman aşımı, bozuk çıktı, aylık ücret sınırı, anahtar geçişi, önbellek, iptal, kalıcı arşiv analizi, kaynak koruması ve özgün yanıt üretimi doğrulanır. Otomatik örnek toplama, tüm sekmelerde durdurma, eski isteklerin reddi, durdurulmuş mesajların geri toplanmaması, gizlilik filtreleri, düzeltme/onay/silme, örneklerin isteme eklenmesi ve kaydedilen örneklerin şirket kaynağı sayılmaması da test edilir. Arama alanına yerleşim, mesaj yazma alanının geometrik olarak korunması, panel kapalıyken üretimin durması ve öğrenmenin devam etmesi, kapalı tercihin yenilemede korunması ve selamla başlayan gerçek talepler de test edilir. Panel davranışı sahte DOM ve zamanlayıcılarla doğrulanır; gerçek tarayıcı görünümü bu testlere dahil değildir. Eski 1.000 örneğin korunarak 1.001. örneğe devam etmesi, 20.000 kayıt sınırı, 10 MB UTF-8 bütçesi, kapasite sayaçları, büyük korpusta ilgili örnek seçimi ve 6 MB üzeri yedeğin geri yüklenmesi de doğrulanır. FastKeys kapalıyken kaynak ve analiz isteği gönderilmemesi, ilgili destek niyetleri, yedek turu, hatalı dosyanın atomik reddi, alan izin listesi ve güvenli birleştirme de test edilir. Tüm JavaScript dosyaları sözdizimi kontrolünden geçer; ayar HTML kimlikleri ve script bağlantıları statik olarak kontrol edilir.

Gerçek API anahtarıyla Groq/Gemini/OpenRouter üretimi ve Türkçe model kalitesi **bu ortamda denenmedi**. Chrome çalıştırıcısı bulunmadığı için görsel tarayıcı kontrolü tamamlanamadı. Geniş hafıza ve depolama izni gerçek Chrome profilinde ölçülmedi; büyük korpus ve yedek kontrolleri Node ortamında yapıldı. Gerçek LiveChat DOM'u, pano erişimi, Chrome servis çalışanının yaşam döngüsü ve Windows native host kurulumu kullanıcının ortamında kontrol edilmelidir. Sınırsız ücretsiz kullanım, her durumda doğru cevap veya tamamen kesintisiz servis garantisi verilmez.

## Kaynaklar ve geliştirme

API sözleşmeleri: [Groq metin üretimi](https://console.groq.com/docs/text-chat), [Gemini generateContent](https://ai.google.dev/api/generate-content), [OpenRouter ücretsiz model yönlendirme](https://openrouter.ai/docs/guides/routing/routers/free-router), [OpenRouter kredi ve limitler](https://openrouter.ai/docs/api/reference/limits).

`backup.js`: kimlik bilgileri içermeyen örnek yedeği ve doğrulanmış birleştirme. `learning.js`: maskelenmiş örnek hafızası ve bağlama göre örnek seçimi. `capture.js`: görüşme bazında yeni temsilci mesajlarını takip etme. `core.js`: FastKeys ayrıştırma ve arama. `knowledge.js`: kalıcı bilgi hazırlığı. `retrieval.js`: konu ve koşul sıralaması. `composer.js`: profesyonel yanıt talimatı, doğrulama ve hazır destek yanıtları. `providers.js`: sağlayıcılar, geçiş, bekleme ve ücret kontrolü. `background.js`: güvenilen erişim ve hazırlık işleri. `reader.js`: LiveChat DOM okuma. `dock.js`: üst arama alanına yerleşim ve yalnızca asistana ait konumlandırma. `content.js`: öneri/kopyalama paneli. `windows/NativeHost.cs`: seçilen dosyanın yerel okunması.
