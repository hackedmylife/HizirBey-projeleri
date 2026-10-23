# Hızır Bey Sesli Yazma 0.1.10 — Doğrulama

23 Ekim 2026

| Kontrol | Sonuç | Kapsam |
| --- | --- | --- |
| Birim / DOM / oturum | **98 / 98 geçti** | Süre bağımsız dinleme, son sesin tamamlanması, oturum / sekme bağı, noktalama, müzik filtresi ve önceki korumalar |
| ESLint | **Geçti** | Uygulama, testler ve yardımcılar |
| Sözdizimi / manifest / kaynak taraması | **Geçti** | 28 uzantı dosyası, WASM özeti, lisanslar, kısayol, host listesi ve anahtar desenleri |
| Chromium arayüz / editör | **58 kontrol geçti** | Gerçek Space, basılı tutma / tekrar, geç durum, normal boşluğa dönüş, Enter, yeniden yazdırma ve görünüm |
| Gerçek MV3 / sahte mikrofon ve API | **53 kontrol geçti** | Space ile son parçanın boşaltılması, gerçek Enter, offscreen kapanması, WASM, müzik, gecikme, yeniden deneme ve kota |

CI: [Sesli Yazma QA](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39911513520).
Test edilen kaynak commit: `3919034bb7d907bc90d31f75a7c5570f17cc8a0b`.
98 test, 58 arayüz ve 53 MV3 başarı satırı CI günlüğünden ayrıca doğrulandı. Tüm iş adımları başarılıdır.

## Space ve dinleme süresi

- Birim / oturum testinde saat ve zamanlayıcılar kontrollü ilerletilir: önce 91 saniye sessizlik, ardından 16 dakika daha geçen süre altında mikrofon açık kalır. Sonrasında verilen konuşma, açık bitirme isteğiyle son kelimeleri ve noktalaması tamamlanarak yazılır. Bu, gerçek zamanda 17 dakika mikrofon deneyi değildir.
- Gerçek Chromium klavyesinde Space, editör dışında odak varken de bir kez bitirme isteği gönderir. Sahte klavye olayı ve değiştirici tuşlu Space bitirme başlatmaz. Basılı tutma / hazırlıkta tekrar basma taslağa boşluk eklemez ve dinlemeyi yeniden başlatmaz. Geç gelen kayıt açık durumu, bitirme durumunu geri alamaz.
- Son işleme sırasında son taslak güncellemesi kabul edilir. Tamamlandıktan sonra Space normal boşluk yazar; kullanıcı düzenleyip gerçek Enter ile gönderir. Başlangıç sırasında Space de aynı oturumu bitirme isteği verir.
- Gerçek MV3 uzantısında mikrofon / AudioWorklet ile ilk metin alınır; test kopyasındaki Segmenter'a son 0,512 saniyelik yapay konuşma eklenir. Gerçek Space basışı bu son parçayı işleyip sahte ASR cevabını mevcut taslağa ekler. Oturum tamamlanır, nokta gizlenir ve kullanıcı Enter ile bir kez gönderir. Son yapay parça konuşma tanıma doğruluğu ölçümü değildir.
- Yanlış oturum, başka sekme veya alt çerçeveden bitirme isteği kabul edilmez. Yinelenen isteğin mikrofonu yeniden başlatmadığı ve tek bitirme oluşturduğu arka plan testinde doğrulanır.

## Korunan davranış ve kapsam

- Yerel WASM konuşma denetimi; sessizlik / ton / oluşturulmuş müzik, kamuya açık konuşma ve müzik karışımıyla denenir. Yeni sürümde aynı 28 çalışma dosyasındaki filtre ve lisanslar korunur. Müzikte sıfır API isteği ve konuşma karışımının işlenmesi MV3 kontrolünden geçer.
- Ücretsiz kota, ağ yeniden denemesi, kelime / sayı koruması, MK / altyazı denetimi, geç cevap ve elle düzenlenmiş metni koruma kontrolleri geçer. Anahtar ve sözlük depolama anahtarları değiştirilmez.
- 90 saniyelik sessizlik ve 15 dakikalık oturum kapanması kaldırılmıştır. Gönderim, görüşme / sekme / sayfa değişimi, gerçek mikrofon / bağlantı hatası, ücretsiz kota, yaklaşık 106 saniyelik bekleyen ses belleği ve 8.000 karakter taslak koruması sürer. Space bir gönderim komutu değildir.
- Masaüstü ayar ekranı ve etkin popup görüntüleri incelendi; Space yönergesi, logo, sürüm ve aktarım süresi taşma olmadan görünür. Mobil yatay taşma kontrolü de geçer. Merkezdeki 20 px kırmızı nokta korunur.
- Gerçek kullanıcı sesi, gerçek Groq hesabı veya müşteri görüşmesi kullanılmaz. Kullanıcının Workspace ses yönlendirmesi, gerçek şarkısı / mikrofonu, canlı Lexical editörü ve fiziksel Win + H yönlendirmesi cihazda son kabul testi gerektirir. Müzik filtresi konuşmacı tanıma veya eksiksiz müzik ayırma sağlamaz.

## Paket ve kaynak eşleşmesi

34 paket dosyası yerel içerikle, 28 uzantı dosyası yukarıdaki başarılı kaynak commit'iyle bayt düzeyinde eşleştirilir. Son teslim commit'i yalnızca bu raporu, proje özetini, ZIP ve SHA-256 dosyasını ekler / günceller. Kaynak ve arşiv literal anahtar desenleri için taranır; ZIP CRC ve SHA-256 doğrulanır. API anahtarı, kişisel hafıza, ses arşivi, test profili veya test kancası pakete konmaz.
