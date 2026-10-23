# Doğrulama — 0.4.0

23 Ekim 2026. Yerel panelin koyu / altın teması, temel cümle sonu düzenlemesi ve uygulamayı tamamen kapatan X güncellemesi.

**123 Windows kontrolü geçti.**

Yeni doğrulamalar:

- Dağıtım giriş betiğindeki gerçek Win+H / Ctrl+C kısayolları ayrı test sürecinin klavye olaylarıyla çalıştırıldı. İki büyük işlem düğmesi, sürükleme, pano ve önceki 0.3.0 davranışları korunur.
- Türkçe i / ı büyük harf ayrımı, eksik nokta, açık soru ekleri, var olan işaretler, satır sonları ve tekrar uygulandığında değişmeme kontrolleri geçti. Kod, URL, e-posta, sayı ve para örneklerinde veriyi koruma doğrulandı.
- Dikte etkin görünürken Ctrl+C, kopyalanan metnin cümle sonunu tamamladı; canlı kutuyu değiştirmedi ve dinleme durumunu durdurmadı.
- Durdurma sonrası sakinleşme aralığında son metin düzenlendi. Yalnız büyük harf düzeltmesi gerektiğinde de uygulandı. Windows panosu kendiliğinden değiştirilmedi; yerel Ctrl+Z düzenlemeyi geri aldı.
- Yerel panel 600, 930 ve 1080 piksel genişliklerde 100 piksel yüksekliğe sığdı. İki büyük düğme 160 × 40, X 24 × 24 pikseldir; yazım alanıyla örtüşmez.
- Gerçek native düğmelerin özel çizim kullandığı ve bütün etkileşimlerden sonra bu biçimi koruduğu doğrulandı. Orijinal logo GDI+ ile yüksek kalitede ölçeklendi. Gerçek panel PrintWindow ile PNG olarak alındı ve görsel olarak incelendi; README'deki görüntü bu sentetik test oturumundandır.
- Dağıtılan giriş betiği ayrı bir süreçte gerçekten açıldı. Üst sağ X gerçek fare tıklamasıyla kapatıldı: pencere ve kendi AutoHotkey süreci sona erdi.
- Aynı program yeniden açıldı. Native pencere kapatma isteğiyle tekrar tamamen kapandı. Başka AutoHotkey süreçlerini sonlandıran bir komut kullanılmaz; testin kendi AutoHotkey süreci çalışmayı sürdürdü.
- Ana giriş betiği ayrıca açılıp hatasız kapandı. Resmi taşınabilir çalışma dosyasının SHA-256 değeri doğrulandı.

[Başarılı Windows çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39953666619).

Doğrulanan kaynak commit: `6b1f8b8f1dcb967cfa968efcdc0f49cad981f61f`.

Test ortamı Windows Server 2025 / 10.0.26100'dür. Gerçek Windows 11 mikrofon tanıması bu ortamda çalıştırılmadı; sesli yazmayı başlatma / durdurma çağrıları test sınıfında sayaçlarla değiştirildi. Pano, tuşlar, fare, düğmeler, uygulama kapatma / yeniden açma ve temel noktalama gerçek Windows kontrolleri üzerinde doğrulandı.

Noktalama sınırı: bu yerel, kurallı cümle sonu ve ilk harf düzenlemesidir. Genel Türkçe cümle çözümlemesi, bağlama göre virgül koyma veya her soru cümlesini tanıma yapmaz. Mevcut işaretleri korur; kod, bağlantı ve sayısal sonlarda temkinlidir. Windows'un kendi Otomatik noktalama ayarına veya kayıt defterine dokunulmaz. Metin gönderilmeden önce kontrol edilmelidir.

Kapatma sınırı: X, native kapatma ve Çıkış onay sormadan uygulamayı bitirir. Bellekteki taslak kapanınca kaybolur; gerekli metin önceden kopyalanmalıdır. Uygulama Chrome'a otomatik yapıştırma veya mesaj gönderme yapmaz.

ZIP izin listesindeki 18 dosyayı içerir. Taslak, ses, kullanıcı ekran görüntüleri, panel.ini, token ve API anahtarı dahil değildir. Marka görselleri önceki public proje varlıklarıdır. Önizleme yalnız belgelerde tutulur, dağıtım ZIP'ine eklenmez.
