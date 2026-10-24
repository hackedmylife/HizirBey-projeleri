# Filtreli Dikte 0.1.0 · Doğrulama

24 Ekim 2026. Windows CI kaynak adayı: `55830bb671ea5e31077e6263c46f50fad3370c11`.
[Kontrol çalışması](https://github.com/hackedmylife/HizirBey-projeleri/actions/runs/40093317000).

## Windows uygulaması

- 123 panel / kısayol / panoya kopyalama / konum / noktalama / X kapanış kontrolü geçti. Win+H sistem çağrısı bu testte sayaçla değiştirilir; gerçek klavye olayları ayrıca sürülür.
- 19 filtre yaşam döngüsü kontrolü geçti. Model hazır olmadan diktenin başlamaması, yalnız hazır / çalışan akış onayıyla başlama, eski durumun yeni başlatmayı onaylayamaması, durdurmada ses kuyruğunu bekleme, iptal, zaman aşımı ve hatada durma denetlendi. Türkçe dosya yolu ve mikrofon adı gerçek Windows INI API'siyle kaydedilip okundu. Uygulamanın kendi süreç grubuna aldığı gerçek iç içe PowerShell işlemleri kapatıldı.
- 24 tek EXE kontrolü geçti. Kaynak / Python / dış marka dosyası olmayan, Türkçe ve boşluk içeren klasörden açıldı. Gömülü varlıklar, iki eylem düğmesi, ilk kurulum ekranı, Ctrl+C, kopyalama, tek örnek, X ile tamamen kapanma, hemen yeniden açılma ve geçici varlık temizliği doğrulandı.

Test sistemi: GitHub Actions `windows-latest` / Windows Server 2025 x64; Windows 11 masaüstü veya WorkSpaces oturumu değildir.

## Ses işleme

8 Python testi: model çıktı ölçeği / işareti için en küçük kareler dengelemesi, örtüşmeli pencerede sıra / son kuyruk / tam uzunluk, kısa kayıtlar, bilinmeyen sesi sessize alma, farklı örnekleme hızı, sınırlı kuyruklar ve sonlu değerler, fiziksel giriş / sanal çıkış doğrulaması, Türkçe Windows INI dosyası. Yerelde ve Windows özel CPU Python ortamında çalıştırılır.

Gerçek ConvTasNet ve Resemblyzer modelleriyle kamuya açık LibriSpeech örneklerinden farklı konuşmacılı karışım işlenir. Gerçek 3 saniye pencere / 2 saniye adım, referans özeti, ölçek dengeleme, çıktı uzunluğu / seviyeleri ve son kuyruk denetlenir. Bu mekanik akış kontrolü konuşmacı ayırma doğruluk metriği veya bütün arka plan seslerinde başarı garantisi değildir. CPU süreleri ilgili işin `CPU_STREAM_CHECK` satırındadır. Kullanıcının kayıtları / ses profili CI'a veya depoya yüklenmez.

## Gerçek cihazda kalan kontrol

CI'da fiziksel mikrofon, VB-CABLE sürücüsü ve Windows 11 sesli yazma hizmeti yoktur. Fiziksel mikrofon → CPU filtresi → CABLE Input → CABLE Output → gerçek Win+H → metin kutusu zinciri bu ortamda uçtan uca doğrulanmadı. İlk denemede sessiz ortam / PC müziği / TV konuşmasıyla ses kaybı ve yanlış konuşmacı kabulünü ayrı değerlendir. Windows'un seçili mikrofonu program tarafından okunup doğrulanmaz; CABLE Output kullanıcı tarafından seçilmelidir.

## Teslim dosyası

`Hizir-Bey-Filtreli-Dikte-0.1.0.exe`: 1.746.944 bayt.
SHA-256: `82a72905dbd3985869a837eed30cc30d563383259cce78bb6cc5032c749e112c`.
EXE, yukarıdaki kaynak adayının başarılı Windows işinden alınır. Yayın eklemesi yalnız rapor / kaynak ZIP / EXE / depo dizinidir; EXE'ye gömülen program kodu değiştirilmez.
