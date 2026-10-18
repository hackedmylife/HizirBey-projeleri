# Hızır Bey Sesli Yazma 0.1.9 — Doğrulama

18 Ekim 2026

| Kontrol | Sonuç | Kapsam |
| --- | --- | --- |
| Birim / DOM / oturum | **96 / 96 geçti** | Gerçek WASM konuşma denetimi, ton / oluşturulmuş müzik, konuşma karışımı, arka plan seviyesi, mikrofon ayarı ve önceki dikte korumaları |
| ESLint | **Geçti** | Uygulama, testler ve yardımcılar |
| Sözdizimi / manifest / kaynak taraması | **Geçti** | 28 uzantı dosyası, sabit WASM özeti, lisanslar, Alt + H, host listesi ve anahtar desenleri |
| Chromium arayüz / editör | **48 kontrol geçti** | Yeni koruma / ölçüm kontrolleri, masaüstü / mobil görünüm, yeniden yazdırma, Enter ve 20 px nokta |
| Gerçek MV3 / sahte mikrofon ve API | **51 kontrol geçti** | Gerçek yerel WASM, arka plan ölçümü / sıfırlama, müzikte sıfır API isteği, konuşma karışımı, gecikme, yeniden yazdırma ve 429 |

CI: [Sesli Yazma QA](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39159452786).
Kaynak commit: `190fbe9cdac3d5c2580cd7378476068bfb4c50f1`.
96 test, 48 arayüz ve 51 MV3 başarı satırı CI günlüğünden ayrıca okunmuştur.
Teslimdeki 28 uygulama dosyası test edilen kaynakla bayt düzeyinde eşleştirilir. Son teslim commit'i yalnızca rapor / açıklamalar, proje özeti ve paketi günceller.

## Müzik / arka plan denemeleri

- Sıfır ses ve 80 / 220 / 440 / 880 / 1760 Hz sürekli tonlar, gerçek paketlenmiş libfvad WASM ve tek ton denetiminden geçirilir. Ses tanımaya gönderilecek parça üretilmez.
- Üç sinüs bileşeninden oluşturulmuş kontrollü enstrümantal benzeri sinyal, konuşma parçası oluşturmaz. Ölçülmüş arka plana göre düşük seviyeye indirilen kamuya açık konuşma ile bu sinyalin karışımı da kapıyı açmaz. Bu bir seviye / konuşma deneyi olup şarkıcı veya kişi tanıma deneyi değildir.
- Aynı kamuya açık konuşma normal seviyede ve oluşturulmuş müzikle karışık halde denenir. Konuşma kareleri ve birkaç saniyelik ses parçası korunur. 137 ve 2048 örneklik farklı giriş bloklarında aynı karar sayısı alınır; son kısmi 20 ms kare bir kez tamamlanır.
- Gerçek MV3 denemesi, test kopyasındaki üretim PCM girişine önce oluşturulmuş müzik verir: Groq isteği sayısı sıfır kalır, mevcut taslak değişmez ve mikrofon açık kalır. Ardından normal seviyeli konuşma + aynı sinyal verilir; ses isteği oluşur ve sahte ASR cevabı editöre aktarılır. Bu senaryoda gerçek WASM / CSP yüklemesi kullanılır.
- İlk mikrofon / gecikme senaryoları gerçek offscreen AudioWorklet üzerinden, kamuya açık konuşmanın kısa kesitini kullanan tarayıcı sahte mikrofonuyla yürür. Eski saf 440 Hz ton, yeni kapının bilerek reddettiği bir sinyal olduğu için test girdisinden çıkarılmıştır.
- Uzun taslak ve ret sonrası devam gibi eski yapay PCM senaryoları, test kopyasında Segmenter'a doğrudan örnek verir. Bunlar konuşma filtresinin doğruluk ölçümü olarak sayılmaz. Üretim kopyasında test kancası / fetch değişikliği yoktur.

## Ölçüm ve mikrofon

- Ölçüm yaklaşık iki saniyede, ilk yerleşme süresinden sonraki seviyelerin yüzde 95 değeriyle hesaplanır. Az örnek / geçersiz değer reddedilir; tek yüksek aykırı örnek bütün ölçümü belirlemez. Başlangıçta ölçülen arka planın iki katı, sürmekte olan konuşmada daha düşük eşik kullanılır; mevcut alt seviye sınırı da korunur.
- Ölçüm sırasında mikrofon seçimi kilitlenir. Mikrofon kimliği ve yalnızca sayısal seviye saklanır; ölçüm sesi tutulmaz / gönderilmez. Seçim değişikliği ölçümü sıfırlar. Gerçek giriş kimliği ölçümle uyuşmazsa eski seviye uygulanmaz ve uyarı verilir.
- MV3 testinde gerçek ayar düğmeleriyle ölçüm ve sıfırlama yapılır. Test edilen mikrofon kimliğiyle kaydedilen arka plan seviyesi, filtreli dikte senaryosunda kullanılır.
- Koruma açıkken otomatik kazanç false, yankı / gürültü giderme true istenir. Giriş all yankı giderme modunu ilan ediyorsa, mevcut cihaz ve kazanç kısıtları da korunarak o mod istenir. İsteğe bağlı mod kabul edilmezse ilk mikrofon akışı kullanılabilir. İstek biçimi birim testinde doğrulanır; gerçek cihaz / Workspace desteği garanti edilmez.
- WASM dosyası yaklaşık 15 KB'dır; uzantıyla gelir. Kod / model CDN'den indirilmez. WASM çalıştırma ve kendi yerel dosyasına erişim için yalnızca uzantı CSP'si güncellenir; yeni host veya sistem sesi / ekran yakalama izni eklenmez.

## Korunan davranış ve sınırlar

- Yerel gürültü kapısı dışında ses tanıma / noktalama sağlayıcısı, ücretsiz kota sınırları, yeniden deneme, arka bellek sınırı, şüpheli MK / altyazı denetimi, kelime / sayı koruması ve geç cevap denetimi sürer.
- Yalnız yüksek ses seviyesi yerine konuşma kararı 90 saniyelik sessizlik sayacını yeniler. Normal bitirmede son kare işlenir ve ses kaynağı kapatılır. Yeniden yazdır, elle düzenlemeyi koruma, bağlı görüşmede gerçek Enter ve 20 px merkez noktası önceki testlerde de doğrulanır.
- Masaüstü ve mobil ayar ekranları açılarak yeni kontrollerin yerleşimi incelenmiştir. Yatay taşma kontrolü geçmiştir. Mevcut anahtar, sözlük, güçlendirme ve kısayol korunur.
- Testler gerçek kullanıcı sesi, gerçek Groq hesabı veya müşteri görüşmesi kullanmaz. Yeni filtre şarkı vokalini / başka konuşmacıyı kullanıcıdan kesin ayırmaz; aynı anda konuşmanın içindeki müziği tamamen çıkarmaz. Oluşturulmuş sinyal sonucu tüm müzik türlerine genellenemez.
- Çok sessiz konuşma / uzak mikrofon filtreye takılabilir. Müzik / sistem mikrofon seviyesi değişince yeniden ölçüm gerekir. Yüksek arka planda yakın kulaklık mikrofonu önerilir. Kullanıcının gerçek şarkısı, Workspace ses yönlendirmesi, canlı Lexical editörü ve fiziksel Windows kısayolu cihazda son kabul testi gerektirir.

## Paket ve kaynak

Arşiv 28 uzantı dosyası, dört yönerge / rapor ve iki Windows dosyası içerir. 34 dosya yerel içerikle; 28 uzantı dosyası başarılı CI kaynağıyla eşleştirilir. Kaynak ve ZIP anahtar desenleri için taranır; CRC ve SHA-256 doğrulanır.

libfvad WASM 2.0.7, gerçek BSD-3-Clause LICENSE / PATENTS / AUTHORS ve kaynak / özet bilgileriyle birlikte paketlenir. Sabit ikili özeti check komutunda doğrulanır. Kamuya açık test WAV'ı kaynak açıklamasıyla yalnızca test klasöründedir ve kurulum ZIP'ine alınmaz. Kullanıcı anahtarı / hafızası, gerçek ses kaydı, test profili ve kancalar paketlenmez.
