# CPU Ses Testi 0.1.0 — doğrulama

24 Ekim 2026. Bu sürüm canlı dikte güncellemesi değil, çevrimdışı ses ayırma + referansla kaynak seçimi denemesidir.

[Başarılı Windows çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/40081801473).
Test edilen kaynak commit: `9d104d35b1e6e78f8f2963fe22dd57be5967edb4`.

## Geçen kontroller

- 23 native Windows kontrolü: kaynak / runtime bulunmayan, boşluk ve Türkçe karakter içeren klasörden tek EXE açıldı. Sürüm, on büyük düğme, özel çizim, gerçek arayüz görüntüsü ve hazırlık yapılmadan ayırma isteğindeki mesaj doğrulandı.
- Gömülü motor dosyaları ve lisansları çıkarıldı. Hazırlık düğmesi ayrı bir PowerShell işlemi başlattı. Gerçek başlık çubuğu X tıklamasıyla EXE ve kendisine ait alt işlem kapandı. Aynı EXE hemen yeniden açıldı; native kapatma ve smoke çıkışı da geçti.
- Son kullanıcıyla aynı Windows PowerShell 5.1 hazırlık betiği, Türkçe / boşluk içeren ayrı klasörde çalıştırıldı. Resmî Python, yalnız CPU Torch / TorchAudio ve ses bağımlılıkları kuruldu. Python arşiv SHA-256 ve iki modelin sabit özeti doğrulandı.
- 7 Python testi: kaynak sırası, bilinmeyen / belirsiz / NaN puanlarda sessiz seçim, bozuk önbelleği yenileme, hatalı indirmenin kurulmaması, Git blob doğrulaması, stereo / örnekleme hızı dönüşümü, sessiz / kısa kaydı reddetme ve atomik UTF-8 rapor yazımı geçti. Aynı testler yerel Linux ortamında da geçti.
- Gerçek ConvTasNet ve Resemblyzer modelleri CPU'da yüklendi. Kamuya açık LibriSpeech kayıtlarından 6 saniyelik iki konuşmacı karışımı işlendi. Gerçek kaynak ayırma, referans benzerliği, karar mekanizması, WAV çıktı uzunluğu / örnekleme hızı, sonlu sayılar ve rapor doğrulandı.
- EXE, başarılı çalışmanın artifact'inden alındı. Artifact özeti, ZIP CRC / izin listesi ve çıkarılan EXE özeti yeniden kontrol edildi. Arayüzün native görüntüsü görsel olarak incelendi.

## Ölçüm ve kalite sınırı

Windows test bilgisayarında, 4 CPU iş parçacığıyla 6,0 saniyelik karışım için işleme süresi **1,483 saniye**, RTF **0,247** ölçüldü. Model yükleme / ilk referans hazırlığı bu süreden ayrıdır. 3 saniyelik pencere / 2 saniyelik adım kullanılır; bu ölçüm canlı mikrofon veya Win+H gecikmesi değildir. Kullanıcının i7-12700H bilgisayarındaki hız ölçülmedi.

**Bu örnekte üç bloktan yalnız biri referans eşiğini geçti.** Diğer bloklar belirsizlik nedeniyle sessiz bırakıldı. Çıktı RMS sıfırdan farklıydı; ancak bu, doğru konuşmacının her kelimesinin korunduğunu veya genel kalite başarısını kanıtlamaz. Sistem kelime kesebilir, benzer sesi yanlış seçebilir veya müziği ayıramayabilir. Kaliteyi kullanıcı mikrofonu / Türkçe / PC hoparlörü / TV ortamında ölçmek bu denemenin sonraki, gerekli adımıdır.

Referans koşullu SpeakerBeam ağı kullanılmadı. Yöntem iki konuşmacıyı ayırıp çıkan kaynakları referansla eşleştirmektir. Ayırıcı 8 kHz / Libri2Mix iki konuşma kaynağı alanında eğitilmiştir. Müzik, Türkçe ve kullanıcı ortamında genel doğrulama iddiası yoktur.

## Dosya bilgileri

- EXE: `Hizir-Bey-CPU-Ses-Testi-0.1.0.exe`, **1.508.352 bayt**.
- EXE SHA-256: `d7be99f5cf6dcb2d69df4b383972ee5cf69d2751dfaf4a8b58d73bdc5e3648fc`.
- Python 3.11.9 embeddable x64 SHA-256: `009d6bf7e3b2ddca3d784fa09f90fe54336d5b60f0e0f305c37f400bf83cfd3b`.
- TorchAudio ayırıcı SHA-256: `ddf97d8341f616c6d8d1a4b20dd51042760392c6543e9eaac276c9f96eba0f0e`.
- Resemblyzer model Git blob SHA-1: `47e405a459e4b97a21325dc78ba6f8270498ac06`, sabit kaynak commit `15d828edebe06bc72b9cabc8ef8ca5ab2cb457ce`.

Kaynak ve paket literal credential / özel anahtar desenleri için denetlenir. Kaynak ZIP yalnız 20 izinli kod / belge / lisans / marka dosyasını içerir. Mikrofon kayıtları, kişisel ses örnekleri / raporlar, ekran görüntüleri, model ağırlıkları, kurulan Python, token ve anahtar dosyaları dağıtıma dahil değildir.

Gerçek mikrofon kaydı / dinletme, kullanıcının odasındaki ses ayırma başarısı ve Win+H'ye ses aktarımı otomatik olarak doğrulanmadı. Win+H aktarımı bu sürümde uygulanmadı. Normal Yerel Dikte programının kaynakları, ayarları ve mikrofon seçimi değiştirilmedi.
