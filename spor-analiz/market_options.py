"""
market_options.py

Bahis marketi seçildiğinde ikinci açılır menüde gösterilecek alt seçenekleri
takım adlarına göre dinamik üretir.

Amaç:
- Her market için bir alt seçim sunmak.
- Asya handikapı gibi marketlerde tüm yaygın çizgileri otomatik üretmek.
- Çok özel / oyuncu bazlı marketlerde manuel giriş seçeneği bırakmak.
"""

import re
import unicodedata

try:
    from sports_config import get_sport_config
except ImportError:
    def get_sport_config(name):
        return {'family': 'football', 'unit': 'gol'}


def _norm(text):
    text = str(text or "")
    text = text.translate(str.maketrans({
        "ı": "i", "İ": "I",
        "ş": "s", "Ş": "S",
        "ğ": "g", "Ğ": "G",
        "ç": "c", "Ç": "C",
        "ö": "o", "Ö": "O",
        "ü": "u", "Ü": "U",
    }))
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s/.&?()-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _fmt_line(value):
    value = round(float(value), 2)
    if abs(value) < 1e-9:
        return "0"
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _with_manual(options):
    result = []
    seen = set()

    for option in options:
        option = str(option).strip()
        if option and option not in seen:
            seen.add(option)
            result.append(option)

    if "Diğer / El ile Gir..." not in seen:
        result.append("Diğer / El ile Gir...")

    return result


def _ou_options(lines):
    result = []
    for line in lines:
        text = _fmt_line(line)
        result.extend([f"Üst {text}", f"Alt {text}"])
    return result


def _quarter_lines(max_abs=5.0):
    values = []
    current = max_abs
    while current >= 0.25 - 1e-9:
        values.append(round(current, 2))
        current -= 0.25
    return values


def _asian_options(home, away, max_abs=5.0):
    """
    Sıralama kullanıcının örneğine benzer:
      Ev -3.75
      Dep  3.75
      Ev -3.50
      Dep  3.50
    Ardından ters yönlü pozitif handikaplar da gelir.
    """
    result = []

    for value in _quarter_lines(max_abs):
        v = _fmt_line(value)
        result.append(f"{home} -{v}")
        result.append(f"{away} {v}")

    result.extend([f"{home} 0", f"{away} 0"])

    for value in reversed(_quarter_lines(max_abs)):
        v = _fmt_line(value)
        result.append(f"{home} {v}")
        result.append(f"{away} -{v}")

    return result


def _european_handicap_options(home, away, max_abs=5):
    result = []

    for value in range(max_abs, 0, -1):
        # Ev takımına negatif handikap.
        result.extend([
            f"{home} -{value}",
            f"Beraberlik ({home} -{value})",
            f"{away} {value}",
        ])

    result.extend([
        home,
        "Beraberlik",
        away,
    ])

    for value in range(1, max_abs + 1):
        result.extend([
            f"{home} {value}",
            f"Beraberlik ({away} -{value})",
            f"{away} -{value}",
        ])

    return result


def _correct_scores(max_goal=6):
    return [
        f"{h}-{a}"
        for h in range(max_goal + 1)
        for a in range(max_goal + 1)
    ]


def _htft_options():
    codes = ("1", "X", "2")
    return [f"{a}/{b}" for a in codes for b in codes]


def _match_result_options(home, away):
    return [f"{home} (1)", "Beraberlik (X)", f"{away} (2)"]


def _double_chance_options(home, away):
    return [
        f"{home} veya Beraberlik (1X)",
        f"{away} veya Beraberlik (X2)",
        f"{home} veya {away} (12)",
    ]


def _fixed_line(market):
    # Parantez içindeki ihtimal sayıları gibi değerleri mümkün olduğunca ele.
    numbers = re.findall(r"(?<!\d)(\d+[.,]\d+)(?!\d)", market)
    if not numbers:
        return None
    try:
        return float(numbers[-1].replace(",", "."))
    except Exception:
        return None


def get_market_suboptions(market, home, away, sport='Futbol'):
    market = str(market or "").strip()
    home = str(home or "").strip() or "Ev Sahibi"
    away = str(away or "").strip() or "Deplasman"
    m = _norm(market)
    sport_cfg = get_sport_config(sport)
    sport_family = sport_cfg.get("family", "football")

    # Futbol dışındaki sporların temel marketleri.
    if sport_family != "football":
        # Basketbol oyuncu prop marketleri. Oyuncu listesi maç verisi
        # çekilmeden bilinmediği için isim + çizgi manuel girilir; analiz
        # motoru bunu takım toplamından tamamen ayrı değerlendirir.
        if str(sport).strip().lower() == "basketbol" and "oyuncu" in m:
            return ["Oyuncu adı + Üst/Alt çizgisi / El ile Gir..."]
        # Maç kazananı: uzatma dahil / nihai kazanan mantığında beraberlik yok.
        if "mac kazanani" in m:
            return _with_manual([
                f"{home} (1)",
                f"{away} (2)",
            ])

        # Takım toplamı önce ele alınmalı.
        if "takim toplam" in m and "ust/alt" in m:
            if sport_family == "points":
                lines = [x + 0.5 for x in range(20, 181, 5)]
            elif sport_family == "runs":
                lines = [x + 0.5 for x in range(0, 151, 5)]
            elif sport_family in ("sets", "esports"):
                lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]
            else:
                lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5]

            options = []
            for team in (home, away):
                for line in lines:
                    for side in ("Üst", "Alt"):
                        options.append(
                            f"{team} {side} {_fmt_line(line)}"
                        )
            return _with_manual(options)

        # Set / harita / klasik handikap.
        if "handikap" in m:
            if sport_family in ("sets", "esports"):
                values = (0.5, 1.5, 2.5, 3.5)
            elif sport_family == "points":
                values = tuple(x + 0.5 for x in range(0, 31))
            elif sport_family == "runs":
                values = tuple(x + 0.5 for x in range(0, 11))
            else:
                values = tuple(x + 0.5 for x in range(0, 8))

            options = []
            for value in reversed(values):
                v = _fmt_line(value)
                options.extend([
                    f"{home} -{v}",
                    f"{away} {v}",
                ])
            for value in values:
                v = _fmt_line(value)
                options.extend([
                    f"{home} {v}",
                    f"{away} -{v}",
                ])
            return _with_manual(options)

        if "ust/alt" in m:
            if sport_family == "points":
                lines = [x + 0.5 for x in range(50, 301, 5)]
            elif sport_family == "runs":
                lines = [x + 0.5 for x in range(0, 401, 10)]
            elif sport_family == "sets":
                lines = [1.5, 2.5, 3.5, 4.5, 5.5, 6.5]
            elif sport_family == "esports":
                lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]
            else:
                lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5]

            return _with_manual(_ou_options(lines))

        if "dogru skor" in m:
            max_goal = 7 if sport_family in ("sets", "esports") else 12
            return _with_manual(_correct_scores(max_goal))

    # Manuel takım toplamı:
    # "Sacramento Republic FC Skor Üst/Alt 1.5, Normal Süre"
    manual_team_total_match = re.search(
        r"^(.+?)\s+"
        r"(?:(?:takim\s+toplam\s+skoru)|(?:takim\s+skoru)|(?:toplam\s+skoru)|skor)"
        r"\s+ust/alt\s+(\d+(?:[.,]\d+)?)",
        m,
    )
    if manual_team_total_match:
        prefix = manual_team_total_match.group(1).strip()
        generic_prefixes = {
            "takim", "ev sahibi", "deplasman", "kim kazanir ve",
        }
        if prefix not in generic_prefixes:
            return _with_manual(["ÜST", "ALT"])

    # Oyuncu marketlerinde kadro maç çekilmeden bilinmeyebilir.
    if "oyuncu" in m or "herhangi bir zamanda gol atan" in m:
        return ["Oyuncu adı / El ile Gir..."]

    # Asya handikapı - normal / yarılar / korner.
    if "asya handikapi" in m:
        max_abs = 10.0 if "korner" in m else 5.0
        return _with_manual(_asian_options(home, away, max_abs=max_abs))

    # Avrupa / klasik handikap.
    if "handikap" in m:
        max_abs = 10 if "korner" in m else 5
        return _with_manual(
            _european_handicap_options(home, away, max_abs=max_abs)
        )

    # HT/FT birleşik marketlerini daha özel marketlerden önce ele al.
    if "ilk yari / mac sonucu" in m:
        htft = _htft_options()

        if "karsilikli gol" in m:
            return _with_manual([
                f"{x} & KG {kg}"
                for x in htft
                for kg in ("Var", "Yok")
            ])

        if "ust/alt" in m:
            line = _fixed_line(market) or 2.5
            return _with_manual([
                f"{x} & {side} {_fmt_line(line)}"
                for x in htft
                for side in ("Üst", "Alt")
            ])

        if "haric" in m:
            return _with_manual([f"{x} Hariç" for x in htft])

        if "cifte sans" in m:
            dcs = ("1X", "X2", "12")
            return _with_manual([
                f"{a}/{b}"
                for a in dcs
                for b in dcs
            ])

        return _with_manual(htft)

    # Çifte şans birleşikleri.
    if "cifte sans" in m:
        dc_labels = _double_chance_options(home, away)

        if "karsilikli gol" in m:
            return _with_manual([
                f"{dc} & KG {kg}"
                for dc in dc_labels
                for kg in ("Var", "Yok")
            ])

        if "ust/alt" in m:
            line = _fixed_line(market) or 2.5
            return _with_manual([
                f"{dc} & {side} {_fmt_line(line)}"
                for dc in dc_labels
                for side in ("Üst", "Alt")
            ])

        if "toplam skor" in m:
            return _with_manual([
                f"{dc} & {side} {_fmt_line(line)}"
                for dc in dc_labels
                for line in (1.5, 2.5, 3.5, 4.5)
                for side in ("Üst", "Alt")
            ])

        if "en cok skor olan yari" in m:
            return _with_manual([
                f"{dc} & {half}"
                for dc in dc_labels
                for half in ("1. Yarı", "2. Yarı", "Eşit")
            ])

        return _with_manual(dc_labels)

    # Maç sonucu / maç bahsi birleşikleri.
    if (
        "mac bahsi ve karsilikli gol" in m
        or "macin kazanani & karsilikli gol" in m
    ):
        return _with_manual([
            f"{result} & KG {kg}"
            for result in _match_result_options(home, away)
            for kg in ("Var", "Yok")
        ])

    if (
        "macin kazanani ve toplam skor" in m
        or "kim kazanir ve toplam skor" in m
    ):
        return _with_manual([
            f"{result} & {side} {_fmt_line(line)}"
            for result in _match_result_options(home, away)
            for line in (1.5, 2.5, 3.5, 4.5)
            for side in ("Üst", "Alt")
        ])

    if "kim kazanir ve takim skoru ust/alt" in m:
        options = []
        for result in _match_result_options(home, away):
            for team in (home, away):
                for line in (0.5, 1.5, 2.5, 3.5):
                    for side in ("Üst", "Alt"):
                        options.append(
                            f"{result} & {team} {side} {_fmt_line(line)}"
                        )
        return _with_manual(options)

    if "kim kazanir veya her iki takim da gol atar" in m:
        return _with_manual([
            f"{result} VEYA KG {kg}"
            for result in _match_result_options(home, away)
            for kg in ("Var", "Yok")
        ])

    if "kim kazanir veya ust/alt" in m:
        return _with_manual([
            f"{result} VEYA {side} {_fmt_line(line)}"
            for result in _match_result_options(home, away)
            for line in (1.5, 2.5, 3.5, 4.5)
            for side in ("Üst", "Alt")
        ])

    # Standart 1X2.
    if "mac sonucu" in m:
        return _with_manual(_match_result_options(home, away))

    # DNB / iade marketleri.
    if (
        "beraberlikte iade" in m
        or "ev sahibi iade" in m
        or "deplasman iade" in m
    ):
        return _with_manual([home, away])

    if "her iki takimda gol atar ve en cok skor olan yari" in m:
        return _with_manual([
            f"KG {kg} & {half}"
            for kg in ("Var", "Yok")
            for half in ("1. Yarı", "2. Yarı", "Eşit")
        ])

    if "kim kazanir ve en cok skor olan yari" in m:
        return _with_manual([
            f"{result} & {half}"
            for result in _match_result_options(home, away)
            for half in ("1. Yarı", "2. Yarı", "Eşit")
        ])

    if "mac bahsi & skor yapan takim 1" in m:
        return _with_manual([
            f"{result} & İlk Gol: {team}"
            for result in _match_result_options(home, away)
            for team in (home, away)
        ])

    # KG marketleri.
    if "karsilikli gol" in m:
        if "toplam" in m:
            return _with_manual([
                f"KG {kg} & {side} 2.5"
                for kg in ("Var", "Yok")
                for side in ("Üst", "Alt")
            ])
        return _with_manual(["Var", "Yok"])

    # Üst/Alt - korner veya gol.
    if "ust/alt" in m:
        fixed = _fixed_line(market)

        if fixed is not None:
            return _with_manual([
                f"Üst {_fmt_line(fixed)}",
                f"Alt {_fmt_line(fixed)}",
            ])

        if "korner" in m:
            max_line = 12.5 if ("1. yari" in m or "2. yari" in m) else 20.5
            lines = [
                x + 0.5
                for x in range(0, int(max_line))
            ]
        else:
            max_line = 5.5 if ("1. yari" in m or "2. yari" in m) else 8.5
            lines = [
                x + 0.5
                for x in range(0, int(max_line))
            ]

        return _with_manual(_ou_options(lines))

    # Doğru skor.
    if "dogru skor" in m:
        return _with_manual(_correct_scores(6))

    # Tek/Çift.
    if "tek/cift" in m:
        return _with_manual(["Tek", "Çift"])

    # Gol yemeyen takım.
    if "gol yemeyen takim" in m:
        return _with_manual([
            f"{home} Evet",
            f"{home} Hayır",
            f"{away} Evet",
            f"{away} Hayır",
        ])

    # Sıfıra karşı kazanma.
    if "sifira karsi kazanma" in m:
        return _with_manual([home, away, "Hiçbiri"])

    # Gol atacak / gol atar / skor yapan takım.
    if (
        "golu atacak takim" in m
        or m.startswith("gol atar")
        or "skor yapan takimlar" in m
    ):
        return _with_manual([
            home,
            away,
            "Her İki Takım",
            "Hiçbiri",
        ])

    if "son golu atan takim" in m:
        return _with_manual([home, away, "Gol Yok"])

    if "son golu atan" in m:
        return ["Oyuncu adı / El ile Gir..."]

    if "skor yapan takim sayisi" in m:
        return _with_manual(["0", "1", "2"])

    if "her iki takim da en az 2 gol atar" in m:
        return _with_manual(["Evet", "Hayır"])

    if "hangi yari daha cok skor olur" in m:
        return _with_manual(["1. Yarı", "2. Yarı", "Eşit"])

    if "en cok korner" in m:
        return _with_manual([home, away, "Eşit"])

    if "toplam skor 1. yari/2. yari" in m:
        return _with_manual([
            "1. Yarı Daha Fazla",
            "2. Yarı Daha Fazla",
            "Eşit",
        ])

    # Korner sayısı / toplam goller: exact.
    if "korner sayisi" in m:
        return _with_manual(
            [str(x) for x in range(0, 21)] + ["21+"]
        )

    if (
        "toplam goller" in m
        or "toplam skoru" in m
        or "toplam skor haric" in m
    ):
        suffix = " Hariç" if "haric" in m else ""
        return _with_manual(
            [f"{x}{suffix}" for x in range(0, 11)] + [f"11+{suffix}"]
        )

    if "kazanc marjini" in m:
        result = ["Beraberlik"]
        for team in (home, away):
            result.extend([
                f"{team} 1 fark",
                f"{team} 2 fark",
                f"{team} 3 fark",
                f"{team} 4+ fark",
            ])
        return _with_manual(result)

    if "geriden gelip kazanma" in m:
        return _with_manual([home, away, "Hiçbiri"])

    if "korner 1" in m:
        return _with_manual([home, away])

    if "zaman araliginda kim kazanir" in m:
        intervals = ("1-15", "16-30", "31-45+", "46-60", "61-75", "76-90+")
        return _with_manual([
            f"{interval}: {result}"
            for interval in intervals
            for result in (home, "Beraberlik", away)
        ])

    if "goller ust/alt zaman araliginda" in m:
        intervals = ("1-15", "16-30", "31-45+", "46-60", "61-75", "76-90+")
        return _with_manual([
            f"{interval}: {side} 0.5"
            for interval in intervals
            for side in ("Üst", "Alt")
        ])

    if "belirli dakikadan sonra gol olur mu" in m:
        return _with_manual([
            f"{minute}' sonrası: {answer}"
            for minute in (45, 60, 70, 75, 80, 85)
            for answer in ("Evet", "Hayır")
        ])

    if "x gole/kornere ulasma" in m:
        options = []
        for team in (home, away):
            for number in range(1, 6):
                options.append(f"{team} {number}. gole ilk ulaşır")
            for number in range(1, 11):
                options.append(f"{team} {number}. kornere ilk ulaşır")
        return _with_manual(options)

    if (
        "her iki yariyi kazanma" in m
        or "her iki yariyi da kazanma" in m
        or "herhangi yariyi kazanma" in m
        or "herhangi bir yariyi kazanma" in m
        or "her iki yarida da skor yapma" in m
    ):
        return _with_manual([
            f"{home} Evet",
            f"{home} Hayır",
            f"{away} Evet",
            f"{away} Hayır",
        ])

    if "her iki yarida da gol" in m:
        return _with_manual(["Evet", "Hayır"])

    # Kalan kompleks marketlerde de boş dropdown bırakma.
    return _with_manual(["Evet", "Hayır"])
