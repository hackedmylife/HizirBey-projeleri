# Doğrulama — 0.2.3

23 Ekim 2026. Kullanıcı ekranında Chrome köprüsü OK gösterirken yerel araç köprüyü doğrulayamadı. Bu, Chrome alan hazırlığı ile yerel pano onayının ayrı aşamalar olduğunu gösterir; ekran görüntüsü tek başına gecikmeyi veya yön kısıtlamasını kanıtlamaz.

Önceki köprü kontrol yanıtını navigator.clipboard.writeText / execCommand copy yoluyla uzak panoya yazıyordu. Yerel araç bu yazımın kendi panosuna kendiliğinden gelmesini bekliyordu. Yeni köprü onayı geçici, salt okunur bir alanda hazırlar; yerel araç aynı WorkSpaces penceresi odaktayken Ctrl+C ile onayı ister. Gerçek kopyalama olayından sonra geçici alan kaldırılır ve odak geri döner. Alan kullanılmazsa 10 saniyede kaldırılır. Köprü artık clipboardRead veya clipboardWrite izni kullanmaz; arka planda pano API'sine yazmaz.

**104 Windows kontrolü ve 112 Chromium kontrolü geçti.**

Yeni regresyon kapsamı:

- Native Windows hedefinde onay yalnız ayrı bir salt okunur Edit alanında tutuldu; yerel panoya programatik onay yazılmadı. Gerçek Ctrl+C onayı getirdi, doğru köprü oturumu bağlandı ve önceki yerel Türkçe pano içeriği geri yüklendi.
- Yerel panel öne geçince aynı kopyalama isteğinin hedef dışına gönderilmesi reddedildi; odak hatası açıkça kaydedildi.
- Chromium'da navigator.clipboard.writeText işlevi hata verecek şekilde kapatıldı. Köprü hazırlığı yerel panoyu değiştirmedi. Gerçek Ctrl+C, READY yanıtını getirdi; geçici alan kaldırıldı, odak mesaj kutusuna döndü ve mesaj kutusu boş kaldı.
- Aynı akışta hazırlık / aktarım / DONE onayı; Türkçe metnin doğru eklenmesi, geçici alanın kaldırılması ve odağın geri dönmesi doğrulandı.
- Onay kopyalandıktan sonra kullanıcının normal Ctrl+C işlemi kontrol koduyla değiştirilmedi. Süresi dolan geçici onay kopyalanmadı ve alandan temizlendi.
- Önceki 0.2.2 kapsamındaki hata kodlarını tüm köprü durumlarında engelleme, görüşme / konu / kutu / taslak değişimini reddetme, yerel pano kurtarma, gerçek Ctrl+V sonrası belirsiz onayda ikinci yapıştırma yapmama, yerel başlangıç, gerçek fareyle sürükleme ve kalıcı konum kontrolleri geçti.
- Tarayıcı testlerinde mesaj gönderim sayısı sıfır kaldı. Gönder düğmesi veya Enter üretilmez.

[Başarılı Windows ve Chromium çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39934811443).

Doğrulanan kaynak commit: `ca661676e7b15989d8c472db99f7de55a0cc6b48`.

Test ortamı Windows Server 2025 / 10.0.26100 ve yüklü Chrome'dur. Chromium testleri gerçek pano ve klavye olaylarıyla sentetik LiveChat sayfalarında çalışır; native testte ayrı pencere uzak onay alanını taklit eder. Gerçek Amazon WorkSpaces istemcisi, kurumun pano yönlendirmesi ve Windows 11 mikrofon hizmeti bu ortamda çalıştırılmadı. Bu sonuçlar gerçek WorkSpaces bağlantısında başarı garantisi değildir.

Yerel program ve WorkSpaces Chrome köprüsü birlikte **0.2.3** yapılmalı, köprü yeniden yüklenmeli ve LiveChat sekmesi yenilenmelidir. HAZ rozeti yalnız uzak alanın hazır olduğunu belirtir. Pano dönüşü gelmezse WorkSpaces'ten yerel bilgisayara normal Ctrl+C / Ctrl+V ayrıca denenmelidir. İki yönlü pano desteği gerekir; araç kurumun yönlendirme politikasını değiştirmez. [AWS pano yönlendirme belgesi](https://docs.aws.amazon.com/workspaces/latest/adminguide/group_policy.html).

Paket izin listesindeki 18 dosyayı içerir. Resmi AutoHotkey çalışma dosyası SHA-256 ile doğrulanır. Taslak, ses, ekran görüntüsü, panel.ini, token veya API anahtarı pakete eklenmez.
