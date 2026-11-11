# 0.3.0 geliştirme kontrol noktası

Bu bir kaynak yedeğidir; yeni APK henüz yayımlanmadı.

- Desteklenen dillerde Android RecognitionService yerine daima yerel Whisper.
- İngilizce için tiny.en Q5; diğer desteklenen diller için base Q5.
- Gerçek AudioRecord durumu ve ses seviyesi; örnek hızı geri dönüşleri.
- Dil değişiminde dinlemeyi yeniden başlatma ve eski görünüm olaylarını reddetme.
- Uygulamaya dahil Makedonca Tesseract fotoğraf modeli.
- İnternet yokken eksik çeviri modeli için hemen açıklama.
- eSpeak çevrimdışı eski dil seçme API'siyle uyumluluk.

Derleme, birim testleri ve uçak modu Android testleri tamamlanınca sonuçlar ayrı doğrulama dosyasında yazılacak. Samsung S20 FE ve Redmi Note 10 Pro üzerinde henüz fiziksel test yapılmadı.
