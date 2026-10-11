# Hızır Bey Sohbet Asistanı — 0.1.2

LiveChat açık görüşmesindeki mesajları okuyarak FastKeys düz metin cevaplarından öneri gösterir. Yalnızca **Kopyala** düğmesi vardır. Mesaj göndermez, yazı alanını değiştirmez, makro çalıştırmaz. Süre takip eklentisi ayrı olarak çalışmaya devam eder.

## 0.1.0 / 0.1.1 sürümünü güncelleme

Eklentiyi kaldırmayın. Bu ZIP içindeki `extension` klasörünün **içeriğini**, Chrome'a daha önce yüklediğiniz mevcut `extension` klasörünün içine kopyalayın ve dosyaları değiştirin. `chrome://extensions` ekranında Hızır Bey Sohbet Asistanı kartındaki yeniden yükle düğmesine basın, ardından LiveChat sekmesini yenileyin. Aynı klasör ve eklenti kimliği korununca mevcut API anahtarı, içe aktarılan arşiv ve Windows bağlantısı korunur. Yeni klasörü ayrı bir eklenti olarak yüklemeyin.

## 0.1.2 bağlam düzeltmeleri

- Selamlaşma, bekleme ve kullanıcı adı bildirimleri önceki asıl talebi düşürmez. Yeni açık konu eski bonus bağlamını değiştirir.
- SMS doğrulama bonusu ile geri dönüş bonusu kalıpları ayrılır. Genel SMS talebinde hesabı doğrulanmış gibi konuşan metin yerine arşivdeki genel şartlar seçilir.
- İkinci/tekrar SMS talebinde kalıptaki tek kullanım şartı okunur. Arşivde ilgili önceki kullanım cevabı varsa doğrulama kutusu ile gösterilir; genel koşul kalıbı da sunulur. Bu öneri üyenin gerçekten bonus almış olduğuna kanıt değildir.
- “Görmekteyim”, “tarafınıza tanımlıdır”, “yeterli yatırımınız mevcuttur” gibi hesap durumu iddiaları mevcut içe aktarılan arşivde de yeniden denetlenir. Önceki kullanım cevabı sen onaylamadan kopyalanamaz.
- Bu belirgin SMS talep örnekleri mevcut kalıplardan yerel kuralla seçilir; uzaktaki AI gerekmemesi hem alakasız seçimleri hem API kullanımını azaltır. Yeni cevap üretilmez, arşivdeki tam metin gösterilir.
- Kullanıcının gerçek 487 kalıplık arşivinde iki hata örneği yeniden üretildi ve düzeltmeden sonra ilgili SMS koşulu/tekrar kalıplarının seçildiği doğrulandı. Kullanıcı arşivi ve ekran görüntüleri pakete veya GitHub'a eklenmedi.

## 0.1.1 düzeltmeleri

- Aynı görüşmenin aynı mesajları için başarılı AI seçimi 5 dakika bellekte saklanır. Yenile veya sekmeye dönüş tekrar API çağrısı yapmaz. Arşiv veya ayar değişikliği önbelleği geçersiz kılar; servis çalışanı yeniden başladığında önbellek sıfırlanır.
- Eşzamanlı aynı istekler birleştirilir. Tüm LiveChat sekmeleri için istekler arasında en az 8 saniye bırakılır; aynı anda yalnızca bir AI isteği çalışır. Son 60 saniyelik tahmini metin bütçesi de kontrol edilir; başarılı yanıttaki gerçek token kullanımı tahminin yerini alır. Groq yanıtındaki kalan token ve günlük istek başlıkları düşükse bildirilen yenilenme süresi beklenir. Bu uygulama tedbiridir, Groq limit garantisi değildir.
- HTTP 429 durumunda `Retry-After` beklenir; başlık yoksa 60 saniye beklenir. Bekleme bilgisi tarayıcı oturumunda saklanır ve servis çalışanı yeniden başladığında korunur. Diğer HTTP hataları limit olarak etiketlenmez.
- Bekleme, ağ hatası, eksik anahtar, zaman aşımı veya bozuk AI yanıtında yerel adaylar otomatik gösterilir. Yerel adaylar anahtar kelime eşleşmesidir, temsilci kontrolü gerekir. 120 saniyeyi aşmayan beklemelerde görünür ve değişmemiş görüşme için en fazla 3 otomatik tekrar denenir; sonrasında Yenile kullanılabilir.
- Uzun istemler küçültüldü; yanıt üst sınırı 1.600 yerine 384 token. Modele gönderilen metin kısaltılabilir, kopyalanan kalıp her zaman arşivdeki tam metindir.
- SMS/telefon doğrulaması belirtilmeyen taleplerde SMS kalıpları otomatik aday olmaz. Jest bonusu talebinde diğer bonus kalıpları elenir. Bekliyorum/tamam gibi kısa mesajlar önceki asıl talebi korur. Elle arama tüm kalıplara erişmeye devam eder.
- Anahtar veya kullanıcı FastKeys dosyası pakete eklenmedi.

## İlk deneme

1. ZIP'i kalıcı bir klasöre çıkarın.
2. Chrome'da `chrome://extensions` açın ve **Geliştirici modu**nu etkinleştirin.
3. **Paketlenmemiş öğe yükle** ile bu paketteki `extension` klasörünü seçin.
4. Eklenti simgesine tıklayın. FastKeys bölümünden bilgisayarınızdaki `.fdb` dosyasını içe aktarın.
5. LiveChat sekmesini yenileyin. Bir görüşme açın. Sağ altta asistan paneli görünür.
6. Son mesaj üyeden ise otomatik adaylar gösterilir. Son mesaj temsilci/bottan ise **Yenile** düğmesiyle değerlendirin. Arama kutusu kısayol veya metne göre arşivi tarar.

API anahtarı olmadan **yerel kelime eşleşmesi** çalışır; bu mod yapay zekâ değildir ve bağlamı tam değerlendirmez. Yapay zekâ için ayarlara kendi Groq API anahtarınızı girin, modeli seçin, yapay zekâyı etkinleştirip kaydedin. Anahtarın ve API hesabının sınırları size aittir; sınırsız kullanım veya gecikmesiz cevap garantisi yoktur.

## FastKeys dosyasını otomatik takip

Windows 10/11, Windows PowerShell 5.1 ve .NET Framework gerekir; Python kurulumu gerekmez.

1. Eklenti ayarlarından eklenti kimliğini kopyalayın.
2. `windows/Kurulum.cmd` çalıştırın. Yönetici yetkisi gerekmez; kayıt yalnızca mevcut kullanıcı içindir.
3. Kimliği girin ve FastKeys'te gerçekten kullanılan `.fdb` dosyasını seçin. İndirilmiş eski bir kopyayı seçmeyin.
4. Eklenti ayarlarında **Bağlantıyı kontrol et** düğmesine basın, **Otomatik FastKeys bağlantısını kullan** seçeneğini açıp kaydedin.
5. FastKeys'teki değişiklikleri kaydedin. Açık ve görünür LiveChat paneli yaklaşık 10 saniyede kontrol eder; kaydedilmemiş değişiklikler okunmaz.

Yardımcı yalnızca yapılandırmada seçilen dosyayı okur. Dosya yolu sohbet sayfasından değiştirilemez. Dosya değişirken tutarsız okuma olursa önceki arşiv korunur. Bağlantı kurulamazsa son başarıyla yüklenen arşivle devam edilir ve panel uyarı verir. Başka klasöre taşınmış eklentinin kimliği değişirse kurulumu yeni kimlikle tekrarlayın. Yardımcı çalışırken yeniden kurulum yapacaksanız önce Chrome'u kapatın.

Bağlantıyı kaldırmak için Windows PowerShell'de `windows/Kaldir.ps1` çalıştırılabilir. Seçilmiş FastKeys dosyası silinmez. Eklenti kaldırıldığında profilindeki asistan arşivi ve anahtar da Chrome tarafından kaldırılır.

## İlk sürümün davranışı

- Üye, temsilci, bot ve sistem mesajları ayrı okunur. Görünür DOM'daki son 30 mesaj kullanılır; ekrana yüklenmemiş eski geçmiş okunamaz.
- Yeni görüşmeye geçiş veya yeni mesaj sonrasında eski öneriler temizlenir. Kopyalama anında görüşme tekrar kontrol edilir.
- AI yalnızca aday kalıp kimliklerini seçebilir; kopyalanan metin FastKeys arşivindeki metindir. AI gerekçesi ayrı gösterilir, cevap metnine katılmaz.
- Anahtar kelime sıralamasıyla en fazla 6 aday modele sunulur; aday metinleri toplam 3.800, görüşme metinleri toplam 3.360 karakter ile sınırlanır. Doğru kalıp adaylar arasında yoksa arşiv araması gerekir; hiçbir model seçiminin hatasız olduğu varsayılmaz.
- Karşılama ve bekletme tekrarlarını azaltmak için görüşme kontrol edilir. IP ve şifre blokesi ayrımı AI talimatına dahildir; doğruluğu gerçek kullanımda gözden geçirilmelidir.
- Makrolar, bilgi giriş alanları, seçim menüleri ve devre dışı kalıplar elenir. Metin tekrarları tekilleştirilir.
- İşlem tamamlandı iddiası ve belirli tarih içeren kalıplar AI seçiminden çıkarılır. İkinci SMS bonusu talebi için ilgili önceki kullanım metni, temsilci doğrulama kutusuyla ayrıca sunulabilir. Arşiv aramasında kopyalamak için **Bu metindeki işlem ve bilgileri doğruladım** kutusu gerekir. Bu sınıflandırma sezgiseldir; yeni kalıplar ayrıca gözden geçirilmelidir.
- AI açıkken son mesajlar ve aday metinler Groq'a gönderilir. İsim/kullanıcı adı alanları okunmaz; mesaj içindeki e-posta, uzun numara ve bağlantılar kısmen maskelenir. Bu tam anonimleştirme değildir.
- API anahtarı `chrome.storage.local` içinde, yalnızca güvenilen eklenti sayfalarına açık saklanır; şifreli kasa değildir. ZIP ve GitHub'a anahtar veya kullanıcı dosyası konmaz.

## Doğrulama ve sınırlar

27 Node testi `npm test` ile geçer; önbellek, aynı anda tekrar istek, 429 bekleme, 401 ayrımı, istem sınırı ve jest/SMS bağlamı doğrulanır. Parser ve DOM ayrımı sağlanan örneklerle yerel olarak doğrulanır. Paket, Windows ve gerçek LiveChat oturumunda henüz denenmemiştir; native host kurulumu, gerçek pano erişimi ve gerçek Groq çağrısı ilk denemede doğrulanmalıdır. Bu sürüm üretim onayı değil, kontrollü ilk deneme sürümüdür.

## Geliştirme

`extension/core.js`: FastKeys ayrıştırma ve aday sıralama. `reader.js`: DOM'dan mesaj okuma. `background.js`: güvenilen kaynak erişimi, Windows bağlantısı ve AI. `content.js`: salt okunur panel. `windows/NativeHost.cs`: çerçeveli stdio ile yerel dosya okuma. Kullanıcı verileri ve anahtarlar test fixture'ı veya paket içeriği olarak eklenmez.
