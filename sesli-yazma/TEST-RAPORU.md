# Hızır Bey Sesli Yazma 0.1.6 — Doğrulama

18 Ekim 2026

| Kontrol | Sonuç | Kapsam |
| --- | --- | --- |
| Birim / DOM / oturum | **78 / 78 geçti** | Uzun taslak, tamamlanınca noktalama, kelime/sayı koruması, geç sonuç, şüpheli parça, mikrofon, kota, hafıza ve anahtar |
| ESLint | **Geçti** | Uygulama, testler ve yardımcılar |
| Sözdizimi / manifest / kaynak taraması | **Geçti** | 22 uzantı dosyası, Alt + H, dar host listesi ve kimlik bilgisi desenleri |
| Chromium arayüz / editör | **36 kontrol geçti** | Altı taslak güncellemesi, önceden yazılan metin, tek Enter, Shift + Enter, çift gönderim koruması, 20 px nokta ve arayüz |
| Gerçek MV3 / sahte mikrofon ve API | **28 kontrol geçti** | Ses isteği, 503/26 saniye bekleme, tek taslak, normal durdurma, uzun dikte, şüpheli parça ve 429 |

CI: [Sesli Yazma QA](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39138098796).
CI günlüğünde 78 test, 36 arayüz ve 28 MV3 kontrolünün başarı satırları ayrıca okunarak doğrulanmıştır.
Kaynak commit: `b1952e06cf9da539c11daa680f3757cf978a8625`.
Teslimdeki 22 uygulama dosyası bu kaynakla bayt düzeyinde eşleştirilir. Sonraki teslim commit'i yalnızca raporu, proje özetini ve kurulum arşivini ekler.

## Uzun dikte ve noktalama

- Birim testinde yaklaşık 36 saniyelik yapay PCM beş ses parçasına ayrılır. İlk dört parça sırasında noktalama çağrısı yapılmaz. Son durakta beş parça tek taslakta birikir ve bir kez bütün metin kontrol edilir. Son nokta mikrofonu kapatmaz.
- Ses tanımanın parça sonlarına koyduğu geçici nokta/virgüller taslakta cümle sınırı olarak kullanılmaz. Sayı ayırıcıları, saatler, URL ve e-posta örnekleri korunur. Noktalama sınırı, en az 1 saniyelik durak veya normal durdurmadır; 0,5 saniyelik taslak aktarımı ayrı kalır.
- Kelime ekleyen, eksilten, sıralayan veya değiştiren model çıktısı reddedilir. Büyük/küçük harf dışında harf değişimi, tutar ayırıcısı, eksi/artı ve yüzde değişimi de sınanır. Eksik cümleye zorla nokta eklenmez.
- Kullanıcı yeniden konuştuğunda bekleyen noktalama iptal edilir. Gecikmiş cevap yeni taslağı ezmez. Bütçe dolarsa temel taslak uyarıyla kalır; tahmini son nokta eklenmez.
- Editör testlerinde beş önizleme ve son noktalama aynı dikteyi yeniler; baştaki metin korunur, tekrar ekleme olmaz. Elle değiştirilmiş taslağı geç noktalama ezmez. Geri al, mevcut dikte taslağını kaldırır; yeniden eklenmesini önlemek için dinleme kapanır.
- Gerçek MV3 testinin uzun senaryosu, test kopyasındaki Segmenter'a yaklaşık 36 saniyelik PCM besler; diğer senaryolar gerçek offscreen AudioWorklet ve tarayıcının sahte mikrofonunu kullanır. Uzun senaryodaki gerçek mikrofon mesajları, yalnızca o test kopyasında kapatılır. Bu kanca dağıtılan uzantıda yoktur.

## Güvenlik, gönderim ve gecikme

- MK/altyazı ve düşük güven ölçümü denetimleri korunur. Bir şüpheli ses parçası yazılmaz, uyarı verilir ve dinleme sürer; kullanıcı o bölümü tekrar söylemelidir. Ardından temiz parçanın yazılabildiği sınanır. Art arda üç reddetmede mikrofon kapanır. Son aktarım sınırındaki uygunsuz metin hemen oturumu kapatır.
- Hazır dikte için kullanıcının gerçek Enter basışı aynı görüşmenin etkin Gönder düğmesini bir kez çalıştırır. Dinlemeyi normal bitirdikten sonra da taslağın Enter bağı korunur. Tuş basılı tutulduğunda çift gönderim olmaz; Shift + Enter göndermez. İlk metin gelmeden basılan Enter sonradan otomatik gönderime dönüşmez.
- Enter sonrası mikrofon bağlamının kapanması ve geç sonucun eklenmemesi sınanır. Görüşme/sekme değişimi, iç not, elle düzenleme ve farklı gönder düğmesi korumaları sürer.
- 503 sonrası ikinci ses isteği 26 saniye kasıtlı bekletilir; tekrar veya erken gönderim oluşmaması kontrol edilir. Bu 26 saniye gerçek servis gecikmesi ölçümü değildir. Her deneme yerel kotaya girer. 429 tekrar edilmez; başka sağlayıcı veya ücretli plana geçilmez.
- Dakikalık yerel kota beklemesi iptal edilebilir. Günlük/ses sınırı, yaklaşık iki dakikalık bekleyen ses, 90 saniye sessizlik, 15 dakika oturum ve 8.000 karakter taslak sınırları korunur.
- Anahtar, mikrofon izni ve sözlük güncellemede korunur. Yaklaşık 10 MB hafıza yedeği yeniden içe alınabilir; anahtar dışa aktarılmaz. Noktalamada kullanılan öğrenilmiş örnekler de kelime korumasından geçer.

## Doğrulamanın sınırları

- Testlerde gerçek kullanıcı sesi, gerçek Groq anahtarı veya gerçek müşteri görüşmesi kullanılmaz. LiveChat adresine yerel test sayfası döndürülür. Gerçek hesaba mesaj gönderilmez.
- Türkçe kelime doğruluğu, şive, ortam gürültüsü, özel adlar ve kullanıcının bildirdiği olayın kendi ses kaydıyla yeniden üretimi henüz ölçülmemiştir. Noktalama koruması, ses tanımanın kendisinin bütün kelime hatalarını tespit etmez.
- Durak, cümlenin anlam bakımından kesin bittiğini kanıtlamaz. Yeni konuşmada taslak yeniden değerlendirilir; bu sürüm bütün nokta ve virgüllerin kusursuzluğunu garanti etmez.
- Canlı LiveChat'in kendi Lexical durum yönetimi, kullanıcının Workspace kesintileri ve gerçek Free hesabının gecikme/kotaları için cihazda son kabul testi gerekir.
- Fiziksel Windows Win + H / FastKeys / AutoHotkey yönlendirmesi Linux testlerinde çalıştırılmaz. Chrome'un Alt + H komutu korunur.

## Paket

Arşiv 22 uzantı dosyası, dört yönerge/rapor ve iki Windows dosyası içerir. Kaynak ve ZIP içeriği kimlik bilgisi desenleri için taranır; CRC ve SHA-256 kontrol edilir. Kullanıcı anahtarı, hafızası, ses, test profili veya üretim test kancası paketlenmez.
