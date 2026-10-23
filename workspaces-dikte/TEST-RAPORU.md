# Doğrulama — 0.2.2

23 Ekim 2026. LiveChat'e düşen `HB-DIKTE-2|ERROR|…|identity` konuşma tanıma çıktısı değil, köprünün kontrol yanıtıydı. Önceki kod görüşme kimliğini yalnız sayfadaki belirli DOM niteliklerinden arıyor, bu nitelikler bulunmayınca başarısız oluyordu. Kontrol yanıtları başarısız yoklama sonrasında panoda kalabiliyor, köprü oturumu yokken yapılan yapıştırma da bunları engellemiyordu. Görsel tek başına bu yapıştırmayı hangi tuş veya ara katmanın tetiklediğini kanıtlamaz.

**97 Windows kontrolü ve 95 Chromium kontrolü geçti.**

Yeni regresyon kapsamı:

- Sayfada `chat-feed` veya `data-chat-id` bulunmayan düzende, `/chats/<görüşme>/<konu>` adresi ve tek görünür mesaj kutusuyla bağlanma ve Türkçe metin ekleme.
- Aynı kutu yerinde kalırken görüşme veya konu adresinin değişmesi ve kutunun başka bir DOM öğesiyle değiştirilmesi durumunda aktarımı durdurma.
- Sohbet adresi ve DOM kimliği birlikte bulunmadığında aktarımı reddetme; mevcut taslak ve iç not kontrollerini koruma.
- Köprü oturumu yokken, kimlik hatasından sonra, hazırlıkta, aktarım açıkken, tamamlandıktan ve ekleme hatasından sonra ERROR / READY / DONE / WAIT kontrol metinlerini gerçek Ctrl+V olayında engelleme. Bozuk kimlikli ve gelecekteki protokol sürümü önekleri de engellendi. LiveChat'i taklit eden sayfanın yapıştırma işleyicisi bu kodları almadı.
- Önceki sürümden kalmış hata kodu zaten taslaktaysa sonuna konuşma eklemeyi reddetme; normal elle yapıştırmayı koruma.
- Yerel Windows panosunda kimlik hatası, başarı onayı, zaman aşımı ve kısayol istisnasından sonra önceki Unicode içeriğini geri getirme. Boş pano ve önceden kalmış kontrol kodu temizliği; kullanıcı o sırada başka metin kopyaladıysa onu koruma.
- Bitirme sırasında köprü hatasında asıl konuşma metnini panoda ve panelde koruma; hedef alana hiçbir hata kodu yazmama.
- Gerçek yerel Ctrl+V sonrasında ekleme onayı hatası simülasyonu: bir kez yapıştırma, ikinci yapıştırma yapmama, ERROR yanıtını panoda asıl konuşmayla değiştirme ve kontrol için paneli açık tutma.
- Önceki yerel başlangıç, fareyle sürükleme, konumu hatırlama, odak yarışı, Unicode, mevcut taslağa ekleme ve mesaj gönderim sayısının sıfır kalması kontrolleri.

[Başarılı Windows ve Chromium çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/39931458714).

Doğrulanan kaynak commit: `01a2ef4fc3309b21996b7b1eb00136edcbcfb8c3`.

Test ortamı Windows Server 2025 / 10.0.26100 ve yüklü Chrome'dur. Chromium kontrolleri gerçek pano ve güvenilir Ctrl+V olaylarıyla, sentetik LiveChat sayfalarında çalışır; gerçek LiveChat oturumu veya Amazon WorkSpaces bağlantısı değildir. Yerel mikrofon başlangıç testlerinde istekleri sayan test sınıfı kullanılır. Gerçek Windows 11 Win+H mikrofonu ve kurumun tam ekran WorkSpaces pano bağlantısı kullanıcı ortamında tekrar denenmelidir.

Bu güncelleme için yerel programla birlikte **WorkSpaces Chrome köprüsü 0.2.2** kurulmalı, köprü yeniden yüklenmeli ve LiveChat sekmesi yenilenmelidir. Önceki denemeden yazı alanında kalan HB-DIKTE kodu elle silinmelidir. İki yönlü WorkSpaces metin panosu hâlâ gereklidir.

Paket yalnız izin listesindeki 18 dosyayı içerir. Resmi AutoHotkey çalışma dosyası SHA-256 ile doğrulanır. Taslak, ses, ekran görüntüsü, panel.ini, token veya API anahtarı pakete eklenmez.
