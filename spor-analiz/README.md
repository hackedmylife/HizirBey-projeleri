# Hızır Bey Spor Analiz — v47

Bu klasör v40 tam kaynak tabanı üzerine v41–v47 güncellemelerinin sırayla
uygulanmasıyla oluşturuldu. v47 yalnızca son Puter dosyası yaması değildir;
diğer proje dosyaları da bu klasöre dahil edilmiştir.

ONEFILE için `EXE_OLUSTUR_ONEFILE.bat`, ONEDIR için
`EXE_OLUSTUR_ONEDIR.bat` kullanılabilir. Windows, Python ve build requirements
gereklidir. Ayrıntılar sürüm notlarındadır.

Token/API key dosyaları dahil değildir. Anahtarlar mevcut yerel konumlarından
okunur. `groq_web_config.json` yalnızca endpoint/model/timeout gibi herkese
açık ayarlar içerir; anahtar içermez.

Aktarım kontrolü: Python kaynaklarının sözdizimi doğrulandı. GUI, canlı API ve
Windows derleme/çalıştırma testi bu aktarımda yapılmadı.
