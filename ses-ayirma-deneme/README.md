# Hızır Bey · CPU Ses Testi 0.1.0

GPU kullanmadan, referans ses örneğiyle karışık kayıttan hedef sesi seçmeyi denemek için ayrı bir Windows x64 uygulaması. **Bu, çalışan Yerel Dikte uygulamasının güncellemesi değildir. Win+H mikrofonuna ses vermez ve metin yazdırmaz.** Önce ses ayırma kalitesi ve işlemci süresi ölçülür.

## Kullanım

1. `Hizir-Bey-CPU-Ses-Testi-0.1.0.exe` aç. **Modeli hazırla** düğmesine bas. İlk hazırlık resmî Python, CPU PyTorch / TorchAudio, ses bağımlılıkları ve iki modeli internetten indirir; birkaç yüz MB indirme ve yaklaşık 1–2 GB disk alanı gerekebilir. Sonraki kayıt testleri yereldir. Yönetici yetkisi, sistem Python'u, GPU, hesap veya API anahtarı gerekmez.
2. Windows'un varsayılan giriş aygıtı olarak kendi mikrofonunu seç. Test bu mikrofonu kullanır. Sessiz ortamda **Sesimi kaydet · 20 sn** ile doğal sesinle konuş. Okuma örneği: “Merhaba, şu anda sesimi tanıtıyorum. İşleminizi kontrol ediyorum. Size nasıl yardımcı olabilirim? Bugün farklı uzunluklarda cümleler kurarak deneme yapıyorum.” Metni tekrarlayabilir veya başka şeyler söyleyebilirsin.
3. PC hoparlöründen veya televizyondan normal kullandığın düzeyde ses aç. **Karışık kayıt · 15 sn** ile konuş. İstersen konuşmanın arasına birkaç saniye sessizlik bırak; yalnız TV / müzik varken sistemin başka sesi geçirip geçirmediğini de kontrol edebilirsin. Önceden alınmış PCM WAV dosyaları da seçilebilir: referans 5–60 sn, karışık kayıt 3–60 sn.
4. **Ayır ve ölç** düğmesine bas. **Ham kaydı dinle** ve **Ayrılmışı dinle** ile karşılaştır. **Sonuç klasörü** içinde `ham.wav`, `ayrilmis.wav` ve `rapor.json` bulunur. Kıyas yaparken temizlenen seste kendi kelimelerin kesiliyor mu, TV / şarkıcı sesi kalıyor mu bak.
5. Farklı ortamlar için yeni karışık kayıt alabilirsin. Yeni kayıt veya dosya seçimi önceki sonucu geçersiz kılar; eski ses yeni sonuçmuş gibi oynatılmaz. **Kaydı bitir** erken durdurur. X / Alt+F4 kayıt aygıtını serbest bırakır ve uygulamanın kendine ait PowerShell / Python / pip alt süreçlerini kapatır.

## Yöntem ve sınırlar

Yöntem **iki kaynağı ayırma + referansla kaynak seçimi**dir. TorchAudio'nun `CONVTASNET_BASE_LIBRI2MIX` ağı iki konuşma kaynağı üretir; Resemblyzer bu kaynakların referans konuşmaya benzerliğini değerlendirir. Sadece karışık kaydın tamamına “bu kişi mi?” diye bakıp geçirmek değildir. Belirsiz kaynaklar ham sesle doldurulmaz, sessize alınır. Eşikler 0,60 benzerlik / 0,08 fark olarak deneyseldir; sesini kesebilir veya yanlış kişiyi seçebilir.

Bu model SpeakerBeam değildir ve gerçek zamanlı, genel amaçlı bir ses izolasyonu olarak doğrulanmamıştır. Ayırıcı **8 kHz, iki konuşmacı** verisinde eğitilmiştir. Müzik, TV, yankı, Türkçe, farklı mikrofonlar ve birden fazla çevre konuşmacısındaki kalite kullanıcı kaydıyla değerlendirilmelidir. Enstrüman / şarkıcı / konuşmacı karışımını iki kaynağa bölmek başarılı olmayabilir. Sonuçta konuşma bant genişliği düşer. Bu ilk deneyin amacı bu sınırları görmek, başarıyı varsaymak değildir.

İşlem 3 saniyelik pencereler ve 2 saniyelik adımla kayıt tamamlandıktan sonra yapılır. `RTF = işlem süresi / kayıt süresi`; 1'in altında olması yalnız bu çevrimdışı işlem hızını gösterir. Canlı ses gecikmesi veya Win+H'ye uçtan uca aktarım hızı değildir. Hazırlık / model yükleme ayrıca zaman alır. CPU en fazla 4 iş parçacığı kullanır. CUDA paketleri kurulmaz ve cihaz seçimi daima CPU'dur.

## Veri ve konum

Dosyalar `%LOCALAPPDATA%\HizirBey\CpuSesTesti\0.1.0` altında tutulur. Mikrofon yalnız kayıt düğmesine basılınca açılır. Ses örnekleri, sonuç WAV'ları ve raporlar bilgisayarda kalır; yükleme / telemetri kodu yoktur. `kayitlar` klasörü kişiseldir; kaynak veya GitHub paketine dahil edilmez. Kayıtları temizlemek için uygulamayı kapatıp bu klasörü silebilirsin. Model / Python önbelleği aynı ana klasördedir; silersen yeniden indirilir. Çalışan dikte programı ve onun ayarları değiştirilmez. Dışa aktarılmış raporlar ses benzerliği puanları içerir; kullanıcı tarafından paylaşılmadıkça yerelde kalır.

## Geliştirme

`scripts/build-exe.ps1` resmî, SHA-256 doğrulanan Ahk2Exe ve AutoHotkey 2.0.30 x64 ile tek EXE üretir. EXE küçük başlatıcı / arayüz / kaynakları içerir; ilk kullanımda indirilen CPU motoru ve modeller EXE'nin içinde değildir. Modeller güvenilir yayıncı URL'lerinden alınır. Ayırıcı SHA-256 ve Resemblyzer modeli sabit commit'in Git blob özetiyle doğrulanır; model dosyaları `torch.load(..., weights_only=True)` ile yüklenir.

`tests/test_worker.py` kaynak seçimi ve WAV doğrulamasını; `tests/model_check.py` gerçek CPU modellerini kamuya açık LibriSpeech örnekleriyle; `tests/windows-tests.ahk` native pencere / düğme / derlenmiş başlatıcı / alt süreç kapanmasını denetler. Kullanıcı mikrofonu ve PC / TV ortamındaki gerçek ayırma kalitesi otomatik test değildir. Doğrulama sonucu `TEST-RAPORU.md` içindedir.

Lisans ve kaynak atıfları `NOTICE.txt`, `licenses/Resemblyzer-APACHE.txt` ve bağımlılıkların kendi lisanslarındadır. Derleme AutoHotkey GPL lisansını EXE'ye ekler. Kaynak paketi model ağırlıkları, Python motoru, ses kayıtları, kullanıcı ekran görüntüleri, token / anahtar dosyaları içermez.
