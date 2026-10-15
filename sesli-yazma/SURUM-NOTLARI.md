# 0.1.1 — Bağlantı bekleme ve mikrofon güçlendirme

15 Ekim 2026

- Geçici ağ/sunucu hataları için iptal edilebilir, en fazla 3 deneme; her denemede 45 saniye yanıt süresi. Her yeniden deneme ücretsiz kota sayacına girer. Kota/anahtar hatalarında tekrar yoktur.
- Sıralı ses tamponu; uzun beklemede kayıt durdurularak mevcut ses tamamlanır. Bekleyen ses yaklaşık 2 dakikayla sınırlanır. İptal, sohbet değişimi ve geç yanıt korumaları korunur.
- Oturum ve parça kimliğiyle yinelenen metin aktarımını engelleme; işlem sırasında Enter koruması.
- %135 varsayılan mikrofon güçlendirme, %100–200 ayar ve yüksek sesleri yumuşak sınırlama. Ham ses üzerinden konuşma algılama ve daha hassas 0,005 varsayılan eşik.
- Yerel mikrofon testinde seçilen güçlendirme ve konuşma algısının gösterilmesi.
- Anahtar/sözlük/izinleri koruyan ses ayarı geçişi. Eski varsayılan eşik güncellenir; diğer özel eşikler korunur.
- Gecikme, zaman aşımı, yeniden deneme sırasında iptal, dolan tampon ve ses kazancı için ek testler.

# 0.1.0 — İlk kurulum sürümü

15 Ekim 2026

- Hızır Bey logosu, koyu/altın arayüz, kısa yol kartı ve üç adımlı kurulum.
- Alt + H ile mikrofonu başlatma/durdurma; aktif LiveChat Lexical editörüne aktarım.
- Türkçe Whisper Large v3 / Turbo ve isteğe bağlı kontrollü Türkçe yazım/noktalama düzeltmesi.
- Free hesap onayı; ücretsiz kota hatasında durma. Başka sağlayıcı, plan yükseltme veya ödeme işlemi yok.
- Kullanıcının Enter / Send eyleminde oturumu bitirme; geç yanıtları reddetme.
- İç not, farklı görüşme, değişmiş editör ve kullanıcının elle düzenlediği metin için koruma.
- Yerel mikrofon testi, mikrofon seçimi, hassasiyet ve cümle sonu aralığı.
- Özel terim sözlüğü, isteğe bağlı yerel düzeltme hafızası ve anahtar içermeyen JSON yedeği.
- Ayrı eklenti kimliği; mevcut Sohbet Asistanı / RAM Takip ayarlarına erişmez.

## İlk sürümün sınırları

- Canlı müşteri görüşmesinde veya kullanıcının kendi mikrofonuyla doğruluk ölçümü yapılmış sayılmaz. İlk deneme test görüşmesinde yapılmalı.
- Web Speech'e otomatik geçiş, profesyonelleştirme modu ve sesle düzenleme komutları bu sürümde yoktur.
- Aktif dikteyi Alt + H ile tamamen bitirdikten sonra yapılan elle düzeltmeler otomatik öğrenilmez. Aktif kayıt sırasında Enter ile gönderilen düzenlemeler, öğrenme açıksa yerel örnek olur.
- Free planını anahtardan güvenilir biçimde doğrulayamayız; hesap panelinde kullanıcı kontrolü gerekir.
- Eklenti ses kaydı tutmaz. Son dikte kurtarma kopyası geçici oturum belleğindedir.
