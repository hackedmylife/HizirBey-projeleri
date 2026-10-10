"""
analyzer.py

GUI tarafından çağrılan ana fonksiyon:
    explain_bet(match_info, bet_choice) -> str

Beklenen match_info örneği:
{
    "date": "01.10.2026",
    "home": "Argentina",
    "away": "Bolivia",
    "score": "4-0",
    "corners": {"home": 8, "away": 1},
    "status": "FT",

    # İSTEĞE BAĞLI / GELECEKTE:
    "ht_score": "2-0",
    "ht_corners": {"home": 4, "away": 0},
    "goals": [
        {"minute": 15, "team": "home", "player": "Oyuncu Adı"},
        ...
    ]
}

Not:
- Market adı tek başına verildiği için (ör. "Üst/Alt, Normal Süre")
  spesifik seçim/çizgi (ör. 2.5 Üst) bilinmiyorsa analiz, mevcut maç verisinden
  market sonucunu ve yaygın çizgileri raporlar.
- Ek veri gerektiren marketlerde tahmin/uydurma yapılmaz.
"""

import re
import math
import unicodedata
from difflib import SequenceMatcher


# ---------------------------------------------------------------------------
# TEMEL YARDIMCILAR


def _match_score_unit(match_info):
    sport = _norm((match_info or {}).get("sport") or "Futbol")
    if sport in ("basketbol", "amerikan futbolu", "ragbi birligi", "ragbi ligi", "avustralya futbolu"):
        return "sayı"
    if sport in ("tenis", "masa tenisi", "voleybol", "plaj voleybolu", "badminton", "squash", "padel"):
        return "set"
    if sport == "e spor":
        return "harita"
    if sport == "beyzbol" or sport == "kriket":
        return "run"
    if sport == "dart":
        return "leg"
    if sport == "snooker":
        return "frame"
    return "gol"
# ---------------------------------------------------------------------------

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


def _parse_score(value):
    """
    "4-0", "4:0", (4,0), [4,0] gibi değerleri (4, 0) yapar.
    """
    if isinstance(value, (tuple, list)) and len(value) >= 2:
        try:
            return int(value[0]), int(value[1])
        except Exception:
            return None

    m = re.search(r"(-?\d+)\s*[-:]\s*(-?\d+)", str(value or ""))
    if not m:
        return None

    try:
        return int(m.group(1)), int(m.group(2))
    except Exception:
        return None


def _winner_code(home_goals, away_goals):
    if home_goals > away_goals:
        return "1"
    if home_goals < away_goals:
        return "2"
    return "X"


def _winner_name(home_goals, away_goals, home, away):
    code = _winner_code(home_goals, away_goals)
    if code == "1":
        return f"1 ({home})"
    if code == "2":
        return f"2 ({away})"
    return "X (Beraberlik)"


def _btts(home_goals, away_goals):
    return home_goals > 0 and away_goals > 0


def _odd_even(total):
    return "Tek" if total % 2 else "Çift"


def _clean_sheet_result(home_goals, away_goals, home, away):
    if home_goals == 0 and away_goals == 0:
        return f"Her iki takım da gol yemedi ({home} ve {away})"
    if away_goals == 0:
        return f"{home} gol yemedi"
    if home_goals == 0:
        return f"{away} gol yemedi"
    return "Hiçbir takım gol yemeden tamamlamadı"


def _winning_margin(home_goals, away_goals, home, away):
    diff = abs(home_goals - away_goals)
    if diff == 0:
        return "Beraberlik"
    winner = home if home_goals > away_goals else away
    return f"{winner}, {diff} gol farkla"


def _double_chance(home_goals, away_goals):
    code = _winner_code(home_goals, away_goals)
    if code == "1":
        return "Kazanan seçenekler: 1X ve 12"
    if code == "2":
        return "Kazanan seçenekler: X2 ve 12"
    return "Kazanan seçenekler: 1X ve X2"


def _draw_no_bet(home_goals, away_goals, home, away):
    if home_goals > away_goals:
        return f"Ev Sahibi ({home})"
    if home_goals < away_goals:
        return f"Deplasman ({away})"
    return "İade (maç berabere)"


def _totals_lines(total, unit="gol"):
    """
    Yaygın .5 çizgileri için özet.
    """
    lines = (0.5, 1.5, 2.5, 3.5, 4.5, 5.5)
    parts = []
    for line in lines:
        result = "ÜST" if total > line else "ALT"
        parts.append(f"{line:g}: {result}")
    return f"Toplam {unit}: {total} | " + " | ".join(parts)


def _specific_ou(total, market_text):
    """
    Market isminde 1.5 / 2.5 / 3.5 / 4.5 gibi net çizgi varsa onu hesaplar.
    """
    m = re.search(r"(\d+(?:[.,]\d+)?)", market_text)
    if not m:
        return None

    line = float(m.group(1).replace(",", "."))
    return f"{line:g} çizgisi: {'ÜST' if total > line else 'ALT'} (toplam={total})"


def _team_scoring_count(home_goals, away_goals):
    return int(home_goals > 0) + int(away_goals > 0)


def _team_scoring_names(home_goals, away_goals, home, away):
    teams = []
    if home_goals > 0:
        teams.append(home)
    if away_goals > 0:
        teams.append(away)
    return ", ".join(teams) if teams else "Hiçbiri"


def _score_market_header(match_info):
    return (
        f"⚽ Final Skor: {match_info.get('home', 'Ev')} "
        f"{match_info.get('score', '?')} "
        f"{match_info.get('away', 'Deplasman')}"
    )


def _needs_data(message):
    return (
        "⚠️ Bu bahis türünü güvenilir biçimde sonuçlandırmak için ek maç verisi gerekiyor.\n"
        f"📌 Gerekli veri: {message}\n"
        "Mevcut final skor / toplam korner verisinden bu market için sonuç uydurulmadı."
    )


# ---------------------------------------------------------------------------
# OPSİYONEL YARI VERİLERİ
# ---------------------------------------------------------------------------

def _get_half_scores(match_info):
    ft = _parse_score(match_info.get("score"))
    ht = _parse_score(match_info.get("ht_score"))

    if not ft or not ht:
        return None

    fh, fa = ft
    hh, ha = ht

    sh, sa = fh - hh, fa - ha
    if sh < 0 or sa < 0:
        return None

    return {
        "first": (hh, ha),
        "second": (sh, sa),
        "full": (fh, fa),
    }


def _get_half_corners(match_info):
    total_corners = match_info.get("corners") or {}
    ht_corners = match_info.get("ht_corners") or {}

    try:
        fh = int(total_corners.get("home"))
        fa = int(total_corners.get("away"))
        hh = int(ht_corners.get("home"))
        ha = int(ht_corners.get("away"))
    except Exception:
        return None

    sh, sa = fh - hh, fa - ha
    if min(fh, fa, hh, ha, sh, sa) < 0:
        return None

    return {
        "first": (hh, ha),
        "second": (sh, sa),
        "full": (fh, fa),
    }


def _half_result_text(scores, half_key, home, away):
    h, a = scores[half_key]
    label = "1. Yarı" if half_key == "first" else "2. Yarı"
    return (
        f"{label} skoru: {h}-{a}\n"
        f"{label} sonucu: {_winner_name(h, a, home, away)}"
    )



# ---------------------------------------------------------------------------
# MANUEL TAKIM TOPLAM GOL / SKOR ÜST-ALT
# ---------------------------------------------------------------------------

def _market_team_similarity(candidate, team_name):
    a = _norm(candidate)
    b = _norm(team_name)

    if not a or not b:
        return 0.0

    if a == b:
        return 1.0

    if a in b or b in a:
        return 0.96

    return SequenceMatcher(None, a, b).ratio()


def _analyze_manual_team_total(match_info, bet_choice, hg, ag):
    """
    Örnekleri otomatik tanır:
      Sacramento Republic FC Skor Üst/Alt 1.5, Normal Süre
      Sacramento Republic FC Skor Üst 1.5, Normal Süre
      Las Vegas Lights Takım Skoru Alt 2.5, Normal Süre

    Üst/Alt yazılmışsa kazanan tarafı söyler.
    Sadece Üst veya Alt yazılmışsa seçimin kazanıp/kaybettiğini söyler.
    """
    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")

    market = _norm(bet_choice)

    # Önce "Takım Skoru", "Takım Toplam Skoru", "Skor" biçimlerini yakala.
    pattern = (
        r"^(.+?)\s+"
        r"(?:(?:takim\s+toplam\s+skoru)|(?:takim\s+skoru)|(?:toplam\s+skoru)|skor)"
        r"\s+(ust/alt|ust|alt)\s+(\d+(?:[.,]\d+)?)"
    )

    m = re.search(pattern, market)

    if not m:
        return None

    typed_team = m.group(1).strip()
    selection = m.group(2).strip()
    line = float(m.group(3).replace(",", "."))

    home_sim = _market_team_similarity(typed_team, home)
    away_sim = _market_team_similarity(typed_team, away)

    best_sim = max(home_sim, away_sim)

    if best_sim < 0.62:
        return None

    if home_sim >= away_sim:
        team_name = home
        goals = hg
    else:
        team_name = away
        goals = ag

    if goals > line:
        winning_side = "ÜST"
        losing_side = "ALT"
        comparison = f"{goals} > {line:g}"
    elif goals < line:
        winning_side = "ALT"
        losing_side = "ÜST"
        comparison = f"{goals} < {line:g}"
    else:
        winning_side = "İADE"
        losing_side = None
        comparison = f"{goals} = {line:g}"

    lines = [
        f"🎯 Takım: {team_name}",
        f"⚽ Takımın normal süre golü: {goals}",
        f"📏 Çizgi: {line:g}",
    ]

    if selection == "ust/alt":
        if winning_side == "İADE":
            lines.append("↩️ Sonuç: İADE")
            lines.append(
                f"💡 Neden: {team_name} {goals} gol attı ve gol sayısı "
                f"{line:g} çizgisine eşit."
            )
        else:
            lines.append(f"✅ Kazanan taraf: {winning_side}")
            lines.append(f"❌ Kaybeden taraf: {losing_side}")
            lines.append(
                f"💡 Neden: {team_name} {goals} gol attı; {comparison}. "
                f"Bu nedenle {winning_side} kazandı."
            )
        return "\n".join(lines)

    selected_side = "ÜST" if selection == "ust" else "ALT"

    if winning_side == "İADE":
        lines.append(f"↩️ {selected_side} bahsi: İADE")
        lines.append(
            f"💡 Neden: {team_name} {goals} gol attı; {comparison}."
        )
    elif selected_side == winning_side:
        lines.append(f"✅ {selected_side} bahsi: KAZANDI")
        lines.append(
            f"💡 Neden: {team_name} {goals} gol attı; {comparison}. "
            f"{selected_side} şartı gerçekleşti."
        )
    else:
        lines.append(f"❌ {selected_side} bahsi: KAYBETTİ")
        lines.append(
            f"💡 Neden: {team_name} {goals} gol attı; {comparison}. "
            f"Kazanan taraf {winning_side} oldu."
        )

    return "\n".join(lines)



# ---------------------------------------------------------------------------
# ALT SEÇENEK / KUPON SONUÇLANDIRMA
# ---------------------------------------------------------------------------

def _period_score_for_market(match_info, market_text):
    market = _norm(market_text)
    ft = _parse_score(match_info.get("score"))

    if not ft:
        return None, "Normal Süre"

    if "1. yari" in market:
        ht = _parse_score(match_info.get("ht_score"))
        return (ht, "1. Yarı") if ht else (None, "1. Yarı")

    if "2. yari" in market:
        ht = _parse_score(match_info.get("ht_score"))
        if not ht:
            return None, "2. Yarı"
        return (
            (ft[0] - ht[0], ft[1] - ht[1]),
            "2. Yarı",
        )

    return ft, "Normal Süre"


def _period_corners_for_market(match_info, market_text):
    market = _norm(market_text)
    full = match_info.get("corners") or {}

    try:
        ft = (
            int(full.get("home")),
            int(full.get("away")),
        )
    except Exception:
        return None, "Normal Süre"

    if "1. yari" in market:
        ht = match_info.get("ht_corners") or {}
        try:
            return (
                (int(ht.get("home")), int(ht.get("away"))),
                "1. Yarı",
            )
        except Exception:
            return None, "1. Yarı"

    if "2. yari" in market:
        ht = match_info.get("ht_corners") or {}
        try:
            h = int(ht.get("home"))
            a = int(ht.get("away"))
            return (
                (ft[0] - h, ft[1] - a),
                "2. Yarı",
            )
        except Exception:
            return None, "2. Yarı"

    return ft, "Normal Süre"


def _selection_result(status, selection, reason, needed=None, detail=None):
    icons = {
        "WIN": "✅ KAZANDI",
        "LOSS": "❌ KAYBETTİ",
        "PUSH": "↩️ İADE",
        "HALF_WIN": "🟡 YARI KAZANDI / YARI İADE",
        "HALF_LOSS": "🟠 YARI KAYBETTİ / YARI İADE",
        "INFO": "ℹ️ BİLGİ",
    }

    lines = [
        f"🎫 Alt Seçenek: {selection}",
        f"📣 Sonuç: {icons.get(status, status)}",
        f"💡 Neden: {reason}",
    ]

    if detail:
        lines.append(f"🧮 Hesap: {detail}")

    if needed:
        if status in ("LOSS", "HALF_LOSS"):
            lines.append(f"🎯 Kazanması için: {needed}")
        elif status == "PUSH":
            lines.append(f"🎯 Tam kazanması için: {needed}")
        elif status == "HALF_WIN":
            lines.append(f"🎯 Tam kazanması için: {needed}")

    return "\n".join(lines)


def _team_from_selection(selection, home, away):
    s = _norm(selection)
    h = _norm(home)
    a = _norm(away)

    if s.startswith(h):
        return "home", home
    if s.startswith(a):
        return "away", away
    return None, None


def _extract_handicap_line(selection, team_name):
    text = str(selection).strip()
    prefix = str(team_name).strip()

    if text.lower().startswith(prefix.lower()):
        rest = text[len(prefix):].strip()
        m = re.match(r"^([+-]?\d+(?:[.,]\d+)?)$", rest)
        if m:
            return float(m.group(1).replace(",", "."))

    return None


def _asian_leg_status(diff, handicap):
    adjusted = diff + handicap
    if adjusted > 1e-9:
        return "WIN"
    if adjusted < -1e-9:
        return "LOSS"
    return "PUSH"


def _asian_required_full_win(handicaps):
    # Futbolda/kornere fark integer olduğu için küçük bir aralıkta kesin eşik bul.
    for diff in range(-30, 31):
        if all(_asian_leg_status(diff, h) == "WIN" for h in handicaps):
            return diff
    return None


def _diff_requirement_text(min_diff, team_name, period_name, metric="gol"):
    if min_diff is None:
        return "daha iyi bir fark oluşması gerekirdi."

    if min_diff > 0:
        return (
            f"{team_name}, {period_name.lower()} sonucunda "
            f"en az {min_diff} {metric} farkla önde bitirmeliydi."
        )

    if min_diff == 0:
        return (
            f"{team_name}, {period_name.lower()} sonucunda "
            "en az berabere kalmalıydı."
        )

    return (
        f"{team_name}, {period_name.lower()} sonucunda "
        f"en fazla {abs(min_diff)} {metric} farkla kaybedebilirdi "
        "(veya daha iyi bir sonuç alabilirdi)."
    )


def _evaluate_asian_handicap(match_info, market_text, selection):
    market = _norm(market_text)
    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")

    if "korner" in market:
        values, period_name = _period_corners_for_market(
            match_info, market_text
        )
        metric = "korner"
    else:
        values, period_name = _period_score_for_market(
            match_info, market_text
        )
        metric = _match_score_unit(match_info)

    if not values:
        needed_data = (
            "ilk yarı korner verisi"
            if "korner" in market
            else "ilk yarı skoru"
        )
        return _needs_data(
            f"{period_name} Asya handikapını hesaplamak için {needed_data}"
        )

    side, team_name = _team_from_selection(selection, home, away)
    if not side:
        return None

    line = _extract_handicap_line(selection, team_name)
    if line is None:
        return None

    hv, av = values
    team_value = hv if side == "home" else av
    opp_value = av if side == "home" else hv
    diff = team_value - opp_value

    # .25 / .75 çizgileri iki handikaba bölünür.
    fractional = round(abs(line) % 1, 2)
    if fractional in (0.25, 0.75):
        legs = [
            round(line - 0.25, 2),
            round(line + 0.25, 2),
        ]
    else:
        legs = [round(line, 2)]

    leg_results = [_asian_leg_status(diff, leg) for leg in legs]

    if len(legs) == 1:
        status = leg_results[0]
    else:
        wins = leg_results.count("WIN")
        losses = leg_results.count("LOSS")
        pushes = leg_results.count("PUSH")

        if wins == 2:
            status = "WIN"
        elif losses == 2:
            status = "LOSS"
        elif wins == 1 and pushes == 1:
            status = "HALF_WIN"
        elif losses == 1 and pushes == 1:
            status = "HALF_LOSS"
        elif pushes == 2:
            status = "PUSH"
        elif wins == 1 and losses == 1:
            # Teorik olarak standart quarter line / integer farkta nadir,
            # yine de güvenli ifade.
            status = "PUSH"
        else:
            status = "LOSS"

    hard_line = _asian_required_full_win(legs)
    required = _diff_requirement_text(
        hard_line,
        team_name,
        period_name,
        metric=metric,
    )

    score_text = f"{team_value}-{opp_value}"
    reason = (
        f"{team_name} için {period_name} {metric} sonucu {score_text}; "
        f"ham fark {diff:+d}. {line:+g} Asya handikapı uygulandı."
    )

    if len(legs) == 2:
        detail = (
            f"{line:+g} çizgisi {legs[0]:+g} ve {legs[1]:+g} "
            f"olarak ikiye bölündü → {leg_results[0]} / {leg_results[1]}."
        )
    else:
        adjusted = diff + line
        detail = (
            f"{diff:+d} + ({line:+g}) = {adjusted:+g}. "
            "Pozitif=kazanır, 0=iade, negatif=kaybeder."
        )

    return _selection_result(
        status,
        selection,
        reason,
        needed=required,
        detail=detail,
    )


def _evaluate_european_handicap(match_info, market_text, selection):
    market = _norm(market_text)
    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")

    if "korner" in market:
        values, period_name = _period_corners_for_market(match_info, market_text)
        metric = "korner"
    else:
        values, period_name = _period_score_for_market(match_info, market_text)
        metric = _match_score_unit(match_info)

    if not values:
        return _needs_data(f"{period_name} {metric} verisi")

    hv, av = values

    draw_match = re.match(
        r"^Beraberlik\s*\((.+)\s+([+-]?\d+(?:[.,]\d+)?)\)$",
        str(selection).strip(),
        flags=re.I,
    )

    if draw_match:
        team_text = draw_match.group(1).strip()
        line = float(draw_match.group(2).replace(",", "."))
        side, team_name = _team_from_selection(team_text, home, away)
        if not side:
            return None

        diff = (hv - av) if side == "home" else (av - hv)
        adjusted = diff + line
        win = abs(adjusted) < 1e-9

        return _selection_result(
            "WIN" if win else "LOSS",
            selection,
            (
                f"Handikap sonrası seçilen tarafın farkı {adjusted:+g}. "
                "Beraberlik seçeneği yalnız sonuç 0 olduğunda kazanır."
            ),
            needed=(
                f"Handikap sonrası farkın tam 0 olması gerekirdi."
                if not win else None
            ),
        )

    side, team_name = _team_from_selection(selection, home, away)
    if not side:
        # 0 handikap merkezindeki çıplak takım isimleri.
        if _norm(selection) == _norm(home):
            side, team_name = "home", home
            line = 0.0
        elif _norm(selection) == _norm(away):
            side, team_name = "away", away
            line = 0.0
        elif _norm(selection) == "beraberlik":
            adjusted = hv - av
            win = adjusted == 0
            return _selection_result(
                "WIN" if win else "LOSS",
                selection,
                f"Gerçek {period_name} farkı {adjusted:+d}.",
                needed="Skorun berabere bitmesi gerekirdi." if not win else None,
            )
        else:
            return None
    else:
        line = _extract_handicap_line(selection, team_name)
        if line is None:
            line = 0.0

    diff = (hv - av) if side == "home" else (av - hv)
    adjusted = diff + line
    win = adjusted > 0

    min_diff = math.floor(-line) + 1
    needed = _diff_requirement_text(
        min_diff, team_name, period_name, metric=metric
    )

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        (
            f"{team_name} ham farkı {diff:+d}; "
            f"{line:+g} handikap sonrası fark {adjusted:+g}."
        ),
        needed=needed if not win else None,
        detail=f"{diff:+d} + ({line:+g}) = {adjusted:+g}",
    )


def _parse_ou(selection):
    m = re.search(
        r"\b(Üst|Alt)\s+(\d+(?:[.,]\d+)?)\b",
        str(selection),
        flags=re.I,
    )
    if not m:
        return None

    side = "ÜST" if _norm(m.group(1)) == "ust" else "ALT"
    line = float(m.group(2).replace(",", "."))
    return side, line


def _evaluate_over_under(match_info, market_text, selection):
    parsed = _parse_ou(selection)
    if not parsed:
        return None

    side, line = parsed
    market = _norm(market_text)
    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")

    # Seçimde takım adı varsa takım toplamı.
    selected_team = None
    team_side = None
    if _norm(selection).startswith(_norm(home)):
        selected_team, team_side = home, "home"
    elif _norm(selection).startswith(_norm(away)):
        selected_team, team_side = away, "away"

    if "korner" in market:
        values, period_name = _period_corners_for_market(match_info, market_text)
        metric_label = "korner"
    else:
        values, period_name = _period_score_for_market(match_info, market_text)
        metric_label = _match_score_unit(match_info)

    if not values:
        return _needs_data(f"{period_name} {metric_label} verisi")

    hv, av = values

    if selected_team:
        total = hv if team_side == "home" else av
        subject = selected_team
    else:
        total = hv + av
        subject = f"{period_name} toplam {metric_label}"

    if total > line:
        winning_side = "ÜST"
    elif total < line:
        winning_side = "ALT"
    else:
        winning_side = "İADE"

    if winning_side == "İADE":
        status = "PUSH"
    elif side == winning_side:
        status = "WIN"
    else:
        status = "LOSS"

    if side == "ÜST":
        required = (
            f"{subject} değerinin {line:g}'dan büyük olması gerekiyordu."
        )
    else:
        required = (
            f"{subject} değerinin {line:g}'dan küçük olması gerekiyordu."
        )

    return _selection_result(
        status,
        selection,
        f"{subject} = {total}. {line:g} çizgisinde kazanan taraf {winning_side}.",
        needed=required if status != "WIN" else None,
    )


def _selection_1x2_code(selection, home, away):
    s = _norm(selection)

    if "(1)" in str(selection) or s == _norm(home):
        return "1"
    if "(2)" in str(selection) or s == _norm(away):
        return "2"
    if "(x)" in str(selection).lower() or "beraberlik" in s:
        return "X"
    return None


def _evaluate_1x2(match_info, market_text, selection):
    selected = _selection_1x2_code(
        selection,
        str(match_info.get("home") or "Ev Sahibi"),
        str(match_info.get("away") or "Deplasman"),
    )
    if not selected:
        return None

    values, period_name = _period_score_for_market(match_info, market_text)
    if not values:
        return _needs_data(f"{period_name} skoru")

    actual = _winner_code(*values)
    status = "WIN" if selected == actual else "LOSS"

    actual_text = {
        "1": str(match_info.get("home") or "Ev Sahibi"),
        "X": "Beraberlik",
        "2": str(match_info.get("away") or "Deplasman"),
    }[actual]

    selected_text = {
        "1": "ev sahibi galibiyeti",
        "X": "beraberlik",
        "2": "deplasman galibiyeti",
    }[selected]

    return _selection_result(
        status,
        selection,
        f"{period_name} sonucu {values[0]}-{values[1]} ve gerçek sonuç {actual_text}.",
        needed=(
            f"{period_name} sonucunun {selected_text} olması gerekirdi."
            if status == "LOSS" else None
        ),
    )


def _double_chance_code(selection):
    text = str(selection)
    for code in ("1X", "X2", "12"):
        if f"({code})" in text or _norm(text) == _norm(code):
            return code
    return None


def _evaluate_double_chance(match_info, market_text, selection):
    code = _double_chance_code(selection)
    if not code:
        return None

    values, period_name = _period_score_for_market(match_info, market_text)
    if not values:
        return _needs_data(f"{period_name} skoru")

    actual = _winner_code(*values)
    allowed = {
        "1X": {"1", "X"},
        "X2": {"X", "2"},
        "12": {"1", "2"},
    }[code]

    win = actual in allowed

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{period_name} 1X2 sonucu {actual}; {code} seçimi {sorted(allowed)} sonuçlarını kapsar.",
        needed=f"Sonucun {code} kapsamındaki sonuçlardan biri olması gerekirdi." if not win else None,
    )


def _evaluate_btts(match_info, market_text, selection):
    s = _norm(selection)
    if s not in ("var", "yok") and "kg var" not in s and "kg yok" not in s:
        return None

    values, period_name = _period_score_for_market(match_info, market_text)
    if not values:
        return _needs_data(f"{period_name} skoru")

    actual = values[0] > 0 and values[1] > 0
    selected_yes = ("var" in s) and ("yok" not in s)
    win = actual == selected_yes

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        (
            f"{period_name} skoru {values[0]}-{values[1]}; "
            f"KG sonucu {'VAR' if actual else 'YOK'}."
        ),
        needed=(
            "Her iki takımın da en az 1 gol atması gerekirdi."
            if selected_yes and not win
            else (
                "Takımlardan en az birinin gol atamaması gerekirdi."
                if not selected_yes and not win
                else None
            )
        ),
    )


def _evaluate_correct_score(match_info, market_text, selection):
    m = re.fullmatch(r"\s*(\d+)\s*[-:]\s*(\d+)\s*", str(selection))
    if not m:
        return None

    values, period_name = _period_score_for_market(match_info, market_text)
    if not values:
        return _needs_data(f"{period_name} skoru")

    selected = (int(m.group(1)), int(m.group(2)))
    win = selected == values

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{period_name} gerçek skoru {values[0]}-{values[1]}.",
        needed=(
            f"Skorun tam olarak {selected[0]}-{selected[1]} olması gerekirdi."
            if not win else None
        ),
    )


def _evaluate_odd_even(match_info, market_text, selection):
    s = _norm(selection)
    if s not in ("tek", "cift"):
        return None

    market = _norm(market_text)
    if "korner" in market:
        values, period_name = _period_corners_for_market(match_info, market_text)
        metric = "korner"
    else:
        values, period_name = _period_score_for_market(match_info, market_text)
        metric = "gol"

    if not values:
        return _needs_data(f"{period_name} {metric} verisi")

    total = sum(values)
    actual = "tek" if total % 2 else "cift"
    win = s == actual

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{period_name} toplam {metric} = {total}; sonuç {'Tek' if actual == 'tek' else 'Çift'}.",
        needed=f"Toplam {metric} sayısının {'tek' if s == 'tek' else 'çift'} olması gerekirdi." if not win else None,
    )


def _evaluate_dnb(match_info, market_text, selection):
    market = _norm(market_text)
    if not (
        "beraberlikte iade" in market
        or "ev sahibi iade" in market
        or "deplasman iade" in market
    ):
        return None

    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")
    side, team_name = _team_from_selection(selection, home, away)

    if not side:
        return None

    values, period_name = _period_score_for_market(match_info, market_text)
    if not values:
        return _needs_data(f"{period_name} skoru")

    selected_goals = values[0] if side == "home" else values[1]
    opp_goals = values[1] if side == "home" else values[0]

    if selected_goals > opp_goals:
        status = "WIN"
    elif selected_goals == opp_goals:
        status = "PUSH"
    else:
        status = "LOSS"

    return _selection_result(
        status,
        selection,
        f"{period_name} skoru {values[0]}-{values[1]}. Beraberlikte bahis iade edilir.",
        needed=f"{team_name} takımının {period_name.lower()} sonunda önde olması gerekirdi." if status == "LOSS" else None,
    )


def _evaluate_clean_sheet(match_info, market_text, selection):
    market = _norm(market_text)
    if "gol yemeyen takim" not in market:
        return None

    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")
    side, team_name = _team_from_selection(selection, home, away)
    if not side:
        return None

    s = _norm(selection)
    selected_yes = s.endswith("evet")
    selected_no = s.endswith("hayir")

    if not (selected_yes or selected_no):
        return None

    values, period_name = _period_score_for_market(match_info, market_text)
    if not values:
        return _needs_data(f"{period_name} skoru")

    conceded = values[1] if side == "home" else values[0]
    actual_yes = conceded == 0
    win = actual_yes == selected_yes

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{team_name}, {period_name.lower()} boyunca {conceded} gol yedi.",
        needed=(
            f"{team_name} hiç gol yememeliydi."
            if selected_yes and not win
            else (
                f"{team_name} en az 1 gol yemeliydi."
                if selected_no and not win else None
            )
        ),
    )


def _evaluate_win_to_nil(match_info, market_text, selection):
    market = _norm(market_text)
    if "sifira karsi kazanma" not in market:
        return None

    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")
    values, period_name = _period_score_for_market(match_info, market_text)

    if not values:
        return _needs_data(f"{period_name} skoru")

    actual = "Hiçbiri"
    if values[0] > values[1] and values[1] == 0:
        actual = home
    elif values[1] > values[0] and values[0] == 0:
        actual = away

    win = _norm(selection) == _norm(actual)

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{period_name} skoru {values[0]}-{values[1]}; sıfıra karşı kazanan: {actual}.",
        needed=f"Seçilen '{selection}' sonucunun gerçekleşmesi gerekirdi." if not win else None,
    )


def _evaluate_highest_half(match_info, selection):
    if _norm(selection) not in ("1. yari", "2. yari", "esit"):
        return None

    halves = _get_half_scores(match_info)
    if not halves:
        return _needs_data("ilk yarı skoru (ht_score)")

    fh = sum(halves["first"])
    sh = sum(halves["second"])

    actual = "Eşit"
    if fh > sh:
        actual = "1. Yarı"
    elif sh > fh:
        actual = "2. Yarı"

    win = _norm(selection) == _norm(actual)

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"1. yarıda {fh}, 2. yarıda {sh} gol atıldı; sonuç {actual}.",
        needed=f"En çok gol olan yarının '{selection}' olması gerekirdi." if not win else None,
    )


def _evaluate_htft(match_info, selection):
    m = re.match(r"^\s*(1|X|2)/(1|X|2)\s*$", str(selection), flags=re.I)
    if not m:
        return None

    halves = _get_half_scores(match_info)
    if not halves:
        return _needs_data("ilk yarı skoru (ht_score)")

    ht = _winner_code(*halves["first"])
    ft = _winner_code(*halves["full"])
    actual = f"{ht}/{ft}"
    selected = f"{m.group(1).upper()}/{m.group(2).upper()}"
    win = selected == actual

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"İlk yarı sonucu {ht}, maç sonucu {ft}; gerçek HT/FT = {actual}.",
        needed=f"HT/FT sonucunun {selected} olması gerekirdi." if not win else None,
    )


def _evaluate_team_scores(match_info, market_text, selection):
    market = _norm(market_text)

    if not (
        "golu atacak takim" in market
        or market.startswith("gol atar")
        or "skor yapan takimlar" in market
    ):
        return None

    values, period_name = _period_score_for_market(match_info, market_text)
    if not values:
        return _needs_data(f"{period_name} skoru")

    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")

    actual = "Hiçbiri"
    if values[0] > 0 and values[1] > 0:
        actual = "Her İki Takım"
    elif values[0] > 0:
        actual = home
    elif values[1] > 0:
        actual = away

    win = _norm(selection) == _norm(actual)

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{period_name} skoru {values[0]}-{values[1]}; gol atan taraf(lar): {actual}.",
        needed=f"Gol atan taraf(lar)ın '{selection}' olması gerekirdi." if not win else None,
    )


def _evaluate_scoring_team_count(match_info, market_text, selection):
    market = _norm(market_text)
    if "skor yapan takim sayisi" not in market:
        return None

    try:
        selected = int(str(selection).strip())
    except Exception:
        return None

    values, period_name = _period_score_for_market(match_info, market_text)
    if not values:
        return _needs_data(f"{period_name} skoru")

    actual = int(values[0] > 0) + int(values[1] > 0)
    win = actual == selected

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{period_name} gol atan takım sayısı {actual}.",
        needed=f"Tam {selected} takımın gol atması gerekirdi." if not win else None,
    )


def _evaluate_exact_total(match_info, market_text, selection):
    market = _norm(market_text)
    if not (
        "toplam goller" in market
        or "toplam skoru" in market
        or "korner sayisi" in market
        or "toplam skor haric" in market
    ):
        return None

    selection_text = str(selection).replace("Hariç", "").strip()
    plus = selection_text.endswith("+")
    try:
        value = int(selection_text.rstrip("+"))
    except Exception:
        return None

    if "korner" in market:
        values, period_name = _period_corners_for_market(match_info, market_text)
        metric = "korner"
    else:
        values, period_name = _period_score_for_market(match_info, market_text)
        metric = "gol"

    if not values:
        return _needs_data(f"{period_name} {metric} verisi")

    total = sum(values)

    if "haric" in market:
        win = total != value
        condition = f"toplamın {value} OLMAMASI"
    elif plus:
        win = total >= value
        condition = f"toplamın en az {value} olması"
    else:
        win = total == value
        condition = f"toplamın tam {value} olması"

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{period_name} toplam {metric} sayısı {total}.",
        needed=f"Bu seçimin kazanması için {condition} gerekirdi." if not win else None,
    )


def _evaluate_winning_margin(match_info, selection):
    values, period_name = _period_score_for_market(match_info, "Normal Süre")
    if not values:
        return None

    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")
    diff = values[0] - values[1]

    if diff == 0:
        actual = "Beraberlik"
    else:
        team = home if diff > 0 else away
        margin = abs(diff)
        actual = (
            f"{team} 4+ fark"
            if margin >= 4
            else f"{team} {margin} fark"
        )

    if "fark" not in _norm(selection) and "beraberlik" not in _norm(selection):
        return None

    win = _norm(selection) == _norm(actual)

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"Final skor {values[0]}-{values[1]}; kazanç marjı {actual}.",
        needed=f"Maçın '{selection}' marjıyla bitmesi gerekirdi." if not win else None,
    )


def _evaluate_player_goal(match_info, selection, last_only=False):
    goals = match_info.get("goals") or []
    if not goals:
        return _needs_data("golcü oyuncu ve dakika olayları")

    player_name = str(selection).strip()
    normalized = _norm(player_name)

    scored = [
        g for g in goals
        if normalized
        and normalized in _norm(g.get("player") or "")
    ]

    if last_only:
        ordered = sorted(
            goals,
            key=lambda g: (
                g.get("minute") if isinstance(g.get("minute"), int) else -1,
                g.get("added_time") or 0,
            ),
        )
        last = ordered[-1] if ordered else None
        actual_player = (last or {}).get("player") or "Bilinmiyor"
        win = normalized in _norm(actual_player)
        reason = f"Son golü atan oyuncu: {actual_player}."
        needed = f"Son golü {player_name} atmalıydı." if not win else None
    else:
        win = bool(scored)
        reason = (
            f"{player_name} maçta gol attı."
            if win
            else f"{player_name} adına gol olayı bulunamadı."
        )
        needed = f"{player_name} en az 1 gol atmalıydı." if not win else None

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        reason,
        needed=needed,
    )


def _evaluate_atomic(match_info, market_text, atom):
    atom = str(atom).strip()
    market = _norm(market_text)

    # HT/FT atomu.
    htft = _evaluate_htft(match_info, atom)
    if htft:
        # String rapor yerine bileşik değerlendirmede kullanmak için
        # aşağıdaki basit durum çıkarımı yapılacak.
        pass

    if _norm(atom) in ("1. yari", "2. yari", "esit"):
        half = _evaluate_highest_half(match_info, atom)
        if half:
            return half

    if _norm(atom).startswith("ilk gol"):
        chosen = str(atom).split(":", 1)[-1].strip()
        first_goal = _evaluate_first_last_goal_team(
            match_info, chosen, last=False
        )
        if first_goal:
            return first_goal

    # Takım toplam Üst/Alt önce.
    ou = _evaluate_over_under(match_info, market_text, atom)
    if ou:
        return ou

    btts = _evaluate_btts(match_info, market_text, atom)
    if btts:
        return btts

    dc = _evaluate_double_chance(match_info, market_text, atom)
    if dc:
        return dc

    one_x_two = _evaluate_1x2(match_info, market_text, atom)
    if one_x_two:
        return one_x_two

    return None


def _status_from_report(report):
    if not report:
        return None
    if "📣 Sonuç: ✅ KAZANDI" in report:
        return "WIN"
    if "📣 Sonuç: ❌ KAYBETTİ" in report:
        return "LOSS"
    if "📣 Sonuç: ↩️ İADE" in report:
        return "PUSH"
    if "YARI KAZANDI" in report:
        return "HALF_WIN"
    if "YARI KAYBETTİ" in report:
        return "HALF_LOSS"
    return None


def _evaluate_compound(match_info, market_text, selection):
    # "VEYA" marketlerinde bir bileşenin kazanması yeterlidir.
    if " VEYA " in str(selection):
        parts = [p.strip() for p in str(selection).split(" VEYA ")]
        reports = [_evaluate_atomic(match_info, market_text, p) for p in parts]
        if any(r is None for r in reports):
            return None

        statuses = [_status_from_report(r) for r in reports]
        win = "WIN" in statuses or "HALF_WIN" in statuses
        reason = " | ".join(
            r.split("💡 Neden: ", 1)[-1].split("\n", 1)[0]
            for r in reports
        )
        return _selection_result(
            "WIN" if win else "LOSS",
            selection,
            reason,
            needed=(
                "VEYA koşullarından en az birinin gerçekleşmesi gerekirdi."
                if not win else None
            ),
        )

    if " & " not in str(selection):
        return None

    parts = [p.strip() for p in str(selection).split(" & ")]
    reports = []

    for part in parts:
        # HT/FT kodu özel.
        if re.fullmatch(r"(1|X|2)/(1|X|2)", part, flags=re.I):
            report = _evaluate_htft(match_info, part)
        else:
            report = _evaluate_atomic(match_info, market_text, part)

        if not report:
            return None
        reports.append(report)

    statuses = [_status_from_report(r) for r in reports]

    if "LOSS" in statuses or "HALF_LOSS" in statuses:
        status = "LOSS"
    elif all(s == "WIN" for s in statuses):
        status = "WIN"
    elif "PUSH" in statuses:
        status = "PUSH"
    elif "HALF_WIN" in statuses:
        status = "HALF_WIN"
    else:
        status = "LOSS"

    reasons = []
    for r in reports:
        if "💡 Neden: " in r:
            reasons.append(
                r.split("💡 Neden: ", 1)[1].split("\n", 1)[0]
            )

    return _selection_result(
        status,
        selection,
        " | ".join(reasons),
        needed=(
            "Birleşik seçimin tüm koşullarının aynı anda kazanması gerekirdi."
            if status in ("LOSS", "HALF_LOSS")
            else None
        ),
    )



def _goal_event_minute(event):
    minute = event.get("minute")
    try:
        return int(minute)
    except Exception:
        text = str(event.get("minute_text") or "")
        m = re.search(r"\d+", text)
        return int(m.group(0)) if m else None


def _ordered_goals(match_info):
    goals = match_info.get("goals") or []
    return sorted(
        goals,
        key=lambda g: (
            _goal_event_minute(g)
            if _goal_event_minute(g) is not None
            else 999,
            int(g.get("added_time") or 0),
        ),
    )


def _evaluate_first_last_goal_team(match_info, selection, last=False):
    goals = _ordered_goals(match_info)
    if not goals:
        return _needs_data("gol olayları ve golü atan takım bilgisi")

    event = goals[-1] if last else goals[0]
    side = event.get("team")
    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")

    actual = home if side == "home" else away if side == "away" else None
    if not actual:
        return _needs_data("gol olaylarında ev/deplasman takım bilgisi")

    win = _norm(selection) == _norm(actual)
    label = "son" if last else "ilk"
    minute = _goal_event_minute(event)
    minute_text = f" {minute}. dakikada" if minute is not None else ""

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"Maçın {label} golünü{minute_text} {actual} attı.",
        needed=f"{label.capitalize()} golü {selection} atmalıydı." if not win else None,
    )


def _evaluate_both_teams_two_goals(match_info, selection):
    s = _norm(selection)
    if s not in ("evet", "hayir"):
        return None

    score = _parse_score(match_info.get("score"))
    if not score:
        return None

    actual = score[0] >= 2 and score[1] >= 2
    selected_yes = s == "evet"
    win = actual == selected_yes

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        (
            f"Final skor {score[0]}-{score[1]}; "
            f"iki takımın da en az 2 gol atması {'gerçekleşti' if actual else 'gerçekleşmedi'}."
        ),
        needed=(
            "Her iki takımın da en az 2 gol atması gerekirdi."
            if selected_yes and not win
            else (
                "Takımlardan en az birinin 2 golün altında kalması gerekirdi."
                if not selected_yes and not win else None
            )
        ),
    )


def _evaluate_both_halves_have_goal(match_info, selection):
    s = _norm(selection)
    if s not in ("evet", "hayir"):
        return None

    halves = _get_half_scores(match_info)
    if not halves:
        return _needs_data("ilk yarı skoru (ht_score)")

    first_total = sum(halves["first"])
    second_total = sum(halves["second"])
    actual = first_total > 0 and second_total > 0
    selected_yes = s == "evet"
    win = actual == selected_yes

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        (
            f"1. yarıda {first_total}, 2. yarıda {second_total} gol var; "
            f"iki yarıda da gol şartı {'sağlandı' if actual else 'sağlanmadı'}."
        ),
        needed=(
            "Her iki yarıda da en az 1 gol olması gerekirdi."
            if selected_yes and not win
            else (
                "Yarılardan en az birinin golsüz bitmesi gerekirdi."
                if not selected_yes and not win else None
            )
        ),
    )


def _evaluate_team_half_condition(match_info, selection, condition):
    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")
    side, team_name = _team_from_selection(selection, home, away)
    if not side:
        return None

    s = _norm(selection)
    if not (s.endswith("evet") or s.endswith("hayir")):
        return None
    selected_yes = s.endswith("evet")

    halves = _get_half_scores(match_info)
    if not halves:
        return _needs_data("ilk yarı skoru (ht_score)")

    fi = 0 if side == "home" else 1
    oi = 1 - fi
    f_team, f_opp = halves["first"][fi], halves["first"][oi]
    s_team, s_opp = halves["second"][fi], halves["second"][oi]

    if condition == "score_both":
        actual = f_team > 0 and s_team > 0
        condition_text = "her iki yarıda da gol atması"
    elif condition == "win_both":
        actual = f_team > f_opp and s_team > s_opp
        condition_text = "her iki yarıyı da kazanması"
    elif condition == "win_any":
        actual = f_team > f_opp or s_team > s_opp
        condition_text = "en az bir yarıyı kazanması"
    else:
        return None

    win = actual == selected_yes
    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        (
            f"{team_name}: 1. yarı {f_team}-{f_opp}, "
            f"2. yarı {s_team}-{s_opp}; şart "
            f"{'gerçekleşti' if actual else 'gerçekleşmedi'}."
        ),
        needed=(
            f"{team_name} takımının {condition_text} gerekirdi."
            if selected_yes and not win
            else (
                f"{team_name} takımının {condition_text} şartının gerçekleşmemesi gerekirdi."
                if not selected_yes and not win else None
            )
        ),
    )


def _evaluate_half_total_comparison(match_info, selection):
    halves = _get_half_scores(match_info)
    if not halves:
        return _needs_data("ilk yarı skoru (ht_score)")

    first_total = sum(halves["first"])
    second_total = sum(halves["second"])

    if first_total > second_total:
        actual = "1. Yarı Daha Fazla"
    elif second_total > first_total:
        actual = "2. Yarı Daha Fazla"
    else:
        actual = "Eşit"

    win = _norm(selection) == _norm(actual)
    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"1. yarı toplamı {first_total}, 2. yarı toplamı {second_total}; sonuç {actual}.",
        needed=f"Yarı toplamları açısından '{selection}' sonucu oluşmalıydı." if not win else None,
    )


def _dc_contains(code, result):
    return result in {
        "1X": {"1", "X"},
        "X2": {"X", "2"},
        "12": {"1", "2"},
    }.get(code, set())


def _evaluate_htft_double_chance(match_info, selection):
    m = re.fullmatch(r"\s*(1X|X2|12)/(1X|X2|12)\s*", str(selection), flags=re.I)
    if not m:
        return None

    halves = _get_half_scores(match_info)
    if not halves:
        return _needs_data("ilk yarı skoru (ht_score)")

    ht = _winner_code(*halves["first"])
    ft = _winner_code(*halves["full"])
    first_dc = m.group(1).upper()
    second_dc = m.group(2).upper()
    win = _dc_contains(first_dc, ht) and _dc_contains(second_dc, ft)

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"İlk yarı sonucu {ht}, maç sonucu {ft}; seçilen kapsam {first_dc}/{second_dc}.",
        needed="Her iki periyot sonucunun seçilen çifte şans kapsamına girmesi gerekirdi." if not win else None,
    )


def _evaluate_htft_exclude(match_info, selection):
    m = re.fullmatch(r"\s*(1|X|2)/(1|X|2)\s+Hariç\s*", str(selection), flags=re.I)
    if not m:
        return None

    halves = _get_half_scores(match_info)
    if not halves:
        return _needs_data("ilk yarı skoru (ht_score)")

    actual = f"{_winner_code(*halves['first'])}/{_winner_code(*halves['full'])}"
    excluded = f"{m.group(1).upper()}/{m.group(2).upper()}"
    win = actual != excluded

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"Gerçek HT/FT sonucu {actual}; hariç tutulan sonuç {excluded}.",
        needed=f"Gerçek sonucun {excluded} dışında kalması gerekirdi." if not win else None,
    )


def _interval_bounds(text):
    m = re.match(r"\s*(\d+)-(\d+)\+?", str(text))
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def _goals_in_interval(match_info, start, end):
    selected = []
    for goal in _ordered_goals(match_info):
        minute = _goal_event_minute(goal)
        if minute is None:
            continue
        if start <= minute <= end:
            selected.append(goal)
    return selected


def _evaluate_interval_winner(match_info, selection):
    m = re.match(r"^\s*(\d+-\d+\+?)\s*:\s*(.+?)\s*$", str(selection))
    if not m:
        return None

    bounds = _interval_bounds(m.group(1))
    if not bounds:
        return None

    chosen = m.group(2).strip()
    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")
    goals = _goals_in_interval(match_info, *bounds)

    if not match_info.get("goals"):
        return _needs_data("dakika bazlı gol olayları")

    h = sum(1 for g in goals if g.get("team") == "home")
    a = sum(1 for g in goals if g.get("team") == "away")

    actual = home if h > a else away if a > h else "Beraberlik"
    win = _norm(chosen) == _norm(actual)

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{m.group(1)} aralığında atılan goller {home} {h}-{a} {away}; aralık sonucu {actual}.",
        needed=f"Bu zaman aralığının '{chosen}' sonucu ile bitmesi gerekirdi." if not win else None,
    )


def _evaluate_interval_ou(match_info, selection):
    m = re.match(
        r"^\s*(\d+-\d+\+?)\s*:\s*(Üst|Alt)\s+(\d+(?:[.,]\d+)?)\s*$",
        str(selection),
        flags=re.I,
    )
    if not m:
        return None

    if not match_info.get("goals"):
        return _needs_data("dakika bazlı gol olayları")

    bounds = _interval_bounds(m.group(1))
    goals = _goals_in_interval(match_info, *bounds)
    total = len(goals)
    side = "ÜST" if _norm(m.group(2)) == "ust" else "ALT"
    line = float(m.group(3).replace(",", "."))
    actual = "ÜST" if total > line else "ALT" if total < line else "İADE"

    status = "PUSH" if actual == "İADE" else "WIN" if side == actual else "LOSS"
    return _selection_result(
        status,
        selection,
        f"{m.group(1)} aralığında {total} gol oldu; {line:g} çizgisinde sonuç {actual}.",
        needed=f"Gol sayısının {line:g} çizgisinde {side} tarafında kalması gerekirdi." if status == "LOSS" else None,
    )


def _evaluate_goal_after_minute(match_info, selection):
    m = re.match(r"^\s*(\d+)'?\s+sonrası\s*:\s*(Evet|Hayır)\s*$", str(selection), flags=re.I)
    if not m:
        return None

    if not match_info.get("goals"):
        return _needs_data("dakika bazlı gol olayları")

    minute = int(m.group(1))
    selected_yes = _norm(m.group(2)) == "evet"
    actual = any(
        (_goal_event_minute(g) or -1) > minute
        for g in _ordered_goals(match_info)
    )
    win = actual == selected_yes

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{minute}. dakikadan sonra gol {'oldu' if actual else 'olmadı'}.",
        needed=(
            f"{minute}. dakikadan sonra en az 1 gol olmalıydı."
            if selected_yes and not win
            else (
                f"{minute}. dakikadan sonra gol olmamalıydı."
                if not selected_yes and not win else None
            )
        ),
    )


def _evaluate_reach_goal_corner(match_info, selection):
    text = str(selection).strip()
    m = re.match(
        r"^(.+?)\s+(\d+)\.\s*(gole|kornere)\s+ilk\s+ulasir$",
        _norm(text),
    )
    if not m:
        return None

    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")
    side, team_name = _team_from_selection(text, home, away)
    if not side:
        return None

    # Sayıyı orijinal/normalize metinden tekrar al.
    number_match = re.search(r"\b(\d+)\.", text)
    if not number_match:
        return None
    target = int(number_match.group(1))

    if "kornere" in _norm(text):
        return _needs_data(
            "hangi takımın hangi dakikada korner kullandığını gösteren korner olayları"
        )

    goals = _ordered_goals(match_info)
    if not goals:
        return _needs_data("dakika bazlı gol olayları")

    counts = {"home": 0, "away": 0}
    reached = None
    reached_minute = None

    for goal in goals:
        gside = goal.get("team")
        if gside not in counts:
            continue
        counts[gside] += 1
        if counts[gside] == target and reached is None:
            reached = gside
            reached_minute = _goal_event_minute(goal)

    actual_team = (
        home if reached == "home"
        else away if reached == "away"
        else "Hiçbiri"
    )
    win = reached == side

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        (
            f"{target}. gole ilk ulaşan takım {actual_team}"
            + (f" ({reached_minute}. dakika)." if reached_minute is not None else ".")
        ),
        needed=f"{target}. gole ilk {team_name} ulaşmalıydı." if not win else None,
    )


def _evaluate_comeback_win(match_info, selection):
    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")
    score = _parse_score(match_info.get("score"))
    goals = _ordered_goals(match_info)

    if not score or not goals:
        return _needs_data("gol sırası / dakika bazlı gol olayları")

    counts = {"home": 0, "away": 0}
    trailed = {"home": False, "away": False}

    for goal in goals:
        side = goal.get("team")
        if side not in counts:
            continue
        counts[side] += 1
        if counts["home"] < counts["away"]:
            trailed["home"] = True
        if counts["away"] < counts["home"]:
            trailed["away"] = True

    final_winner = "home" if score[0] > score[1] else "away" if score[1] > score[0] else None

    actual = "Hiçbiri"
    if final_winner and trailed[final_winner]:
        actual = home if final_winner == "home" else away

    win = _norm(selection) == _norm(actual)

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"Gol akışına göre geriden gelip kazanan: {actual}.",
        needed=f"{selection} önce geriye düşüp ardından maçı kazanmalıydı." if not win and actual != selection else None,
    )



def _evaluate_most_corners(match_info, market_text, selection):
    values, period_name = _period_corners_for_market(match_info, market_text)
    if not values:
        return _needs_data(f"{period_name} korner verisi")

    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")

    if values[0] > values[1]:
        actual = home
    elif values[1] > values[0]:
        actual = away
    else:
        actual = "Eşit"

    win = _norm(selection) == _norm(actual)

    return _selection_result(
        "WIN" if win else "LOSS",
        selection,
        f"{period_name} korner sonucu {home} {values[0]}-{values[1]} {away}; en çok korner: {actual}.",
        needed=f"En çok korner kullanan tarafın '{selection}' olması gerekirdi." if not win else None,
    )


def _player_stat_value(stats, metric):
    """Sofascore/ESPN ortaklaştırılmış oyuncu istatistiklerinden değeri al."""
    aliases = {
        "points": ("points", "PTS", "point"),
        "rebounds": ("rebounds", "totalRebounds", "REB", "rebound"),
        "assists": ("assists", "goalAssist", "AST", "assist"),
        "threes": ("threePointFieldGoalsMade", "threePointersMade", "threePointMade", "3PM", "threePointFieldGoals"),
        "steals": ("steals", "STL", "steal"),
        "blocks": ("blocks", "BLK", "block"),
    }
    if metric == "pra":
        vals = [_player_stat_value(stats, x) for x in ("points", "rebounds", "assists")]
        if any(v is None for v in vals):
            return None
        return sum(vals)
    for key in aliases.get(metric, (metric,)):
        value = stats.get(key)
        if value is None or value == "":
            continue
        try:
            return float(str(value).replace(",", "."))
        except Exception:
            pass
    return None


def _parse_player_prop_text(bet_choice, bet_subchoice):
    """Örn: 'Alyssa Thomas: Üst 14.5' veya 'Alyssa Thomas Skoru Üst/Alt 14.5'."""
    market = _norm(bet_choice)
    combined = " ".join(x for x in (str(bet_subchoice or "").strip(), str(bet_choice or "").strip()) if x)
    m = re.search(r"\b(Üst|Alt)\s*(\d+(?:[.,]\d+)?)\b", combined, flags=re.I)
    if not m:
        return None
    side = "ÜST" if _norm(m.group(1)) == "ust" else "ALT"
    line = float(m.group(2).replace(",", "."))

    # Market adından istatistik türü.
    if "ribaund" in market or "rebound" in market:
        metric, label = "rebounds", "ribaund"
    elif "asist" in market:
        metric, label = "assists", "asist"
    elif "ucluk" in market or "3 sayi" in market or "3luk" in market:
        metric, label = "threes", "üçlük"
    elif "top calma" in market or "steal" in market:
        metric, label = "steals", "top çalma"
    elif "blok" in market:
        metric, label = "blocks", "blok"
    elif ("sayi" in market and "ribaund" in market and "asist" in market) or "pra" in market:
        metric, label = "pra", "sayı + ribaund + asist"
    else:
        metric, label = "points", "sayı"

    # Alt seçim varsa oyuncu adı çizgiden önceki bölümdür.
    raw = str(bet_subchoice or "").strip()
    if raw:
        player = re.split(r"\s*[:\-]?\s*(?:Üst|Alt)\s*\d", raw, maxsplit=1, flags=re.I)[0].strip(" :-")
        if "oyuncu adı" in _norm(player):
            player = ""
    else:
        # Manuel ana market: istatistik anahtarından önceki bölüm oyuncu adı.
        patterns = [r"\s+(?:Skoru|Sayı|Sayısı|Ribaund|Asist|Üçlük|Top Çalma|Blok)\b", r"\s+Üst/Alt\b", r"\s+(?:Üst|Alt)\s*\d"]
        player = str(bet_choice or "").strip()
        for pat in patterns:
            parts = re.split(pat, player, maxsplit=1, flags=re.I)
            if len(parts) > 1:
                player = parts[0].strip(" :-")
                break
    if not player:
        return None
    return player, metric, label, side, line


def _evaluate_basketball_player_prop(match_info, bet_choice, bet_subchoice=None):
    market_norm = _norm(bet_choice)
    # Açık oyuncu marketi veya manuel metinde oyuncu istatistiğini çağrıştıran yapı.
    player_like = "oyuncu" in market_norm or any(k in market_norm for k in (
        " skoru ust/alt", " sayi ust/alt", " ribaund ", " asist ", " ucluk ", " top calma ", " blok "
    ))
    if not player_like:
        return None
    parsed = _parse_player_prop_text(bet_choice, bet_subchoice)
    if not parsed:
        return _needs_data("oyuncu adı, Üst/Alt yönü ve çizgi (örn. Alyssa Thomas Üst 14.5)")
    player_name, metric, label, side, line = parsed
    players = match_info.get("player_stats") or {}
    rows = (players.get("home") or []) + (players.get("away") or [])
    if not rows:
        return _needs_data(f"{player_name} için resmi maç boxscore / oyuncu {label} istatistiği")

    target = _norm(player_name)
    best = None
    best_score = 0.0
    from difflib import SequenceMatcher
    for row in rows:
        names = [row.get("name"), row.get("short_name")]
        score = max((SequenceMatcher(None, target, _norm(n)).ratio() for n in names if n), default=0.0)
        if target and any(target in _norm(n) or _norm(n) in target for n in names if n):
            score = max(score, 0.92)
        if score > best_score:
            best, best_score = row, score
    if not best or best_score < 0.62:
        return _needs_data(f"'{player_name}' oyuncusunun boxscore kaydı")

    actual_name = best.get("name") or player_name
    stats = best.get("statistics") or {}
    value = _player_stat_value(stats, metric)
    if value is None:
        return _needs_data(f"{actual_name} için {label} istatistiği")

    if value > line:
        winning = "ÜST"
    elif value < line:
        winning = "ALT"
    else:
        winning = "İADE"
    status = "PUSH" if winning == "İADE" else ("WIN" if side == winning else "LOSS")
    value_text = int(value) if float(value).is_integer() else value
    reason = f"{actual_name} {label} = {value_text}. {line:g} çizgisinde kazanan taraf {winning}."
    needed = None
    if status == "LOSS":
        needed = f"{actual_name} {label} değerinin {line:g}'dan {'büyük' if side == 'ÜST' else 'küçük'} olması gerekiyordu."
    return _selection_result(status, f"{actual_name} {side.title()} {line:g}", reason, needed=needed)


def _evaluate_structured_subchoice(match_info, bet_choice, bet_subchoice):
    if not bet_subchoice:
        return None

    selection = str(bet_subchoice).strip()
    if not selection:
        return None

    market = _norm(bet_choice)

    player_prop = _evaluate_basketball_player_prop(match_info, bet_choice, selection)
    if player_prop:
        return player_prop

    # Manuel takım toplam marketi: alt seçim ÜST / ALT ise mevcut analiz
    # motoruna seçim yönünü enjekte et.
    if re.search(
        r"(takim toplam skoru|takim skoru|toplam skoru|skor) "
        r"ust/alt \d",
        market,
    ) and _norm(selection) in ("ust", "alt"):
        modified = re.sub(
            r"Üst/Alt",
            "Üst" if _norm(selection) == "ust" else "Alt",
            bet_choice,
            count=1,
            flags=re.I,
        )
        ft = _parse_score(match_info.get("score"))
        if ft:
            return _analyze_manual_team_total(
                match_info,
                modified,
                ft[0],
                ft[1],
            )

    if "asya handikapi" in market:
        return _evaluate_asian_handicap(
            match_info, bet_choice, selection
        )

    if "ilk yari / mac sonucu haric" in market:
        result = _evaluate_htft_exclude(match_info, selection)
        if result:
            return result

    if "ilk yari / mac sonucu cifte sans" in market:
        result = _evaluate_htft_double_chance(match_info, selection)
        if result:
            return result

    if "her iki takim da en az 2 gol atar" in market:
        result = _evaluate_both_teams_two_goals(match_info, selection)
        if result:
            return result

    if "her iki yarida da gol" in market and "oyuncu" not in market:
        result = _evaluate_both_halves_have_goal(match_info, selection)
        if result:
            return result

    if "her iki yarida da skor yapma" in market:
        result = _evaluate_team_half_condition(
            match_info, selection, "score_both"
        )
        if result:
            return result

    if "her iki yariyi kazanma" in market or "her iki yariyi da kazanma" in market:
        result = _evaluate_team_half_condition(
            match_info, selection, "win_both"
        )
        if result:
            return result

    if "herhangi yariyi kazanma" in market or "herhangi bir yariyi kazanma" in market:
        result = _evaluate_team_half_condition(
            match_info, selection, "win_any"
        )
        if result:
            return result

    if "toplam skor 1. yari/2. yari" in market:
        result = _evaluate_half_total_comparison(match_info, selection)
        if result:
            return result

    if "zaman araliginda kim kazanir" in market:
        result = _evaluate_interval_winner(match_info, selection)
        if result:
            return result

    if "goller ust/alt zaman araliginda" in market:
        result = _evaluate_interval_ou(match_info, selection)
        if result:
            return result

    if "belirli dakikadan sonra gol olur mu" in market:
        result = _evaluate_goal_after_minute(match_info, selection)
        if result:
            return result

    if "x gole/kornere ulasma" in market:
        result = _evaluate_reach_goal_corner(match_info, selection)
        if result:
            return result

    if "geriden gelip kazanma" in market:
        result = _evaluate_comeback_win(match_info, selection)
        if result:
            return result

    if "son golu atan takim" in market:
        result = _evaluate_first_last_goal_team(
            match_info, selection, last=True
        )
        if result:
            return result

    if market.startswith("korner 1 "):
        return _needs_data(
            "ilk korneri hangi takımın kullandığını gösteren korner olayları"
        )

    if "en cok korner" in market:
        result = _evaluate_most_corners(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "handikap" in market:
        return _evaluate_european_handicap(
            match_info, bet_choice, selection
        )

    compound = _evaluate_compound(
        match_info, bet_choice, selection
    )
    if compound:
        return compound

    if "ilk yari / mac sonucu" in market:
        result = _evaluate_htft(match_info, selection)
        if result:
            return result

    if "cifte sans" in market:
        result = _evaluate_double_chance(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "beraberlikte iade" in market or "iade" in market:
        result = _evaluate_dnb(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "dogru skor" in market:
        result = _evaluate_correct_score(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "tek/cift" in market:
        result = _evaluate_odd_even(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "gol yemeyen takim" in market:
        result = _evaluate_clean_sheet(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "sifira karsi kazanma" in market:
        result = _evaluate_win_to_nil(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "hangi yari daha cok skor olur" in market:
        result = _evaluate_highest_half(
            match_info, selection
        )
        if result:
            return result

    if "skor yapan takim sayisi" in market:
        result = _evaluate_scoring_team_count(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if (
        "toplam goller" in market
        or "toplam skoru" in market
        or "korner sayisi" in market
        or "toplam skor haric" in market
    ):
        result = _evaluate_exact_total(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "kazanc marjini" in market:
        result = _evaluate_winning_margin(
            match_info, selection
        )
        if result:
            return result

    if "gol yemeyen" not in market:
        result = _evaluate_team_scores(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "son golu atan" in market and "takim" not in market:
        return _evaluate_player_goal(
            match_info, selection, last_only=True
        )

    if "oyuncu" in market or "herhangi bir zamanda gol atan" in market:
        return _evaluate_player_goal(
            match_info, selection, last_only=False
        )

    # Üst/Alt genel.
    if "ust/alt" in market:
        result = _evaluate_over_under(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "karsilikli gol" in market:
        result = _evaluate_btts(
            match_info, bet_choice, selection
        )
        if result:
            return result

    if "mac sonucu" in market or "mac kazanani" in market:
        result = _evaluate_1x2(
            match_info, bet_choice, selection
        )
        if result:
            return result

    # Genel 1X2 seçimi denk gelirse.
    result = _evaluate_1x2(
        match_info, bet_choice, selection
    )
    if result:
        return result

    return None


# ---------------------------------------------------------------------------
# MARKET ANALİZİ
# ---------------------------------------------------------------------------

def explain_bet(match_info, bet_choice, bet_subchoice=None):
    """
    GUI'nin kullandığı ana analiz fonksiyonu.
    """

    match_info = match_info or {}
    bet_choice = str(bet_choice or "").strip()

    home = str(match_info.get("home") or "Ev Sahibi")
    away = str(match_info.get("away") or "Deplasman")
    score = _parse_score(match_info.get("score"))

    if not bet_choice:
        return "⚠️ Bahis seçeneği girilmedi."

    if not score:
        return "⚠️ Maç skoru okunamadı; bahis analizi yapılamadı."

    hg, ag = score
    total_goals = hg + ag
    winner_code = _winner_code(hg, ag)
    winner_name = _winner_name(hg, ag, home, away)
    btts = _btts(hg, ag)
    market = _norm(bet_choice)

    corners = match_info.get("corners") or {}
    try:
        hc = int(corners.get("home", 0) or 0)
        ac = int(corners.get("away", 0) or 0)
        corners_available = True
    except Exception:
        hc = ac = 0
        corners_available = False

    total_corners = hc + ac

    # İkinci açılır menüden özel bir alt seçenek seçildiyse önce onu
    # doğrudan sonuçlandır.
    structured_result = _evaluate_structured_subchoice(
        match_info,
        bet_choice,
        bet_subchoice,
    )
    if structured_result:
        return structured_result

    # Basketbol oyuncu prop marketleri takım toplamından önce değerlendirilir.
    # Böylece "Alyssa Thomas Skoru Üst/Alt 14.5" maç toplamına düşmez.
    player_prop = _evaluate_basketball_player_prop(match_info, bet_choice, bet_subchoice)
    if player_prop:
        return player_prop

    # Manuel girilen takım toplam gol / skor Üst-Alt marketlerini
    # genel marketlerden önce değerlendir.
    manual_team_total = _analyze_manual_team_total(
        match_info,
        bet_choice,
        hg,
        ag,
    )

    if manual_team_total:
        return manual_team_total

    # ------------------------------------------------------------------
    # EK VERİ GEREKTİREN OLAY / OYUNCU / ZAMAN MARKETLERİ
    # ------------------------------------------------------------------

    event_based_markets = (
        "herhangi bir zamanda gol atan",
        "golü atacak oyuncu",
        "her iki yarıda da gol atacak oyuncu",
        "son golü atan",
        "son golü atan takım",
        "maç bahsi & skor yapan takım 1",
        "geriden gelip kazanma",
        "belirli dakikadan sonra gol olur mu",
        "goller üst/alt zaman aralığında",
        "zaman aralığında kim kazanır",
        "x gole/kornere ulaşma",
        "korner 1",
    )

    if any(key in market for key in event_based_markets):
        goals = match_info.get("goals")
        if not goals:
            return _needs_data(
                "dakika dakika gol/korner olayları ve gerekiyorsa golcü oyuncu bilgisi"
            )

    # ------------------------------------------------------------------
    # İLK / İKİNCİ YARI SKOR MARKETLERİ
    # ------------------------------------------------------------------

    half_scores = _get_half_scores(match_info)

    # İlk yarı / maç sonucu
    if "ilk yarı / maç sonucu" in market:
        if not half_scores:
            return _needs_data("doğrulanmış ilk yarı skoru (ht_score)")
        hh, ha = half_scores["first"]
        return (
            f"{_score_market_header(match_info)}\n"
            f"📌 İlk Yarı Sonucu: {_winner_name(hh, ha, home, away)}\n"
            f"📌 Maç Sonucu: {winner_name}\n"
            f"➡️ HT/FT sonucu: {_winner_code(hh, ha)}/{winner_code}"
        )

    if "maç sonucu, 1. yarı" in market:
        if not half_scores:
            return _needs_data("doğrulanmış ilk yarı skoru (ht_score)")
        return _half_result_text(half_scores, "first", home, away)

    if "maç sonucu, 2. yarı" in market:
        if not half_scores:
            return _needs_data("doğrulanmış ilk yarı skoru; 2. yarı skoru FT-HT ile hesaplanır")
        return _half_result_text(half_scores, "second", home, away)

    if (
        "karşılıklı gol, 1. yarı" in market
        or "sıfıra karşı kazanma, 1. yarı" in market
        or "doğru skor, 1. yarı" in market
        or "tek/çift, 1. yarı" in market
        or "üst/alt, 1. yarı" in market
        or "skor üst/alt, 1. yarı" in market
        or "toplam skoru, 1. yarı" in market
        or "toplam goller, 1. yarı" in market
        or "çifte şans, 1. yarı" in market
        or "beraberlikte iade, 1. yarı" in market
        or "ev sahibi iade, 1. yarı" in market
        or "deplasman iade, 1. yarı" in market
        or "gol yemeyen takım, 1. yarı" in market
        or "handikap, 1. yarı" in market
        or "asya handikapı, 1. yarı" in market
        or "maçın kazananı ve toplam skor, 1. yarı" in market
        or "skor yapan takım sayısı, 1. yarı" in market
    ):
        if not half_scores:
            return _needs_data("doğrulanmış ilk yarı skoru (ht_score)")

        h, a = half_scores["first"]
        total = h + a

        if "karşılıklı gol" in market:
            return f"1. Yarı KG: {'VAR' if _btts(h, a) else 'YOK'} | Skor: {h}-{a}"
        if "doğru skor" in market:
            return f"1. Yarı Doğru Skor: {h}-{a}"
        if "tek/çift" in market:
            return f"1. Yarı toplam gol: {total} → {_odd_even(total)}"
        if "üst/alt" in market:
            return _totals_lines(total, "1. yarı golü")
        if "çifte şans" in market:
            return f"1. Yarı: {_double_chance(h, a)}"
        if "iade" in market:
            return f"1. Yarı Beraberlikte İade: {_draw_no_bet(h, a, home, away)}"
        if "gol yemeyen takım" in market:
            return f"1. Yarı: {_clean_sheet_result(h, a, home, away)}"
        if "sıfıra karşı kazanma" in market:
            if h > a and a == 0:
                result = home
            elif a > h and h == 0:
                result = away
            else:
                result = "Yok"
            return f"1. Yarı sıfıra karşı kazanan: {result}"
        if "skor yapan takım sayısı" in market:
            return f"1. Yarı skor yapan takım sayısı: {_team_scoring_count(h, a)}"
        return (
            f"1. Yarı skoru: {h}-{a}\n"
            f"1. Yarı sonucu: {_winner_name(h, a, home, away)}\n"
            f"1. Yarı toplam gol: {total}"
        )

    if (
        "karşılıklı gol, 2. yarı" in market
        or "sıfıra karşı kazanma, 2. yarı" in market
        or "doğru skor, 2. yarı" in market
        or "tek/çift, 2. yarı" in market
        or "üst/alt, 2. yarı" in market
        or "skor üst/alt, 2. yarı" in market
        or "toplam skoru, 2. yarı" in market
        or "toplam goller, 2. yarı" in market
        or "çifte şans, 2. yarı" in market
        or "beraberlikte iade, 2. yarı" in market
        or "handikap, 2. yarı" in market
        or "asya handikapı, 2. yarı" in market
    ):
        if not half_scores:
            return _needs_data("doğrulanmış ilk yarı skoru; 2. yarı skoru FT-HT ile hesaplanır")

        h, a = half_scores["second"]
        total = h + a

        if "karşılıklı gol" in market:
            return f"2. Yarı KG: {'VAR' if _btts(h, a) else 'YOK'} | Skor: {h}-{a}"
        if "doğru skor" in market:
            return f"2. Yarı Doğru Skor: {h}-{a}"
        if "tek/çift" in market:
            return f"2. Yarı toplam gol: {total} → {_odd_even(total)}"
        if "üst/alt" in market:
            return _totals_lines(total, "2. yarı golü")
        if "çifte şans" in market:
            return f"2. Yarı: {_double_chance(h, a)}"
        if "iade" in market:
            return f"2. Yarı Beraberlikte İade: {_draw_no_bet(h, a, home, away)}"
        if "sıfıra karşı kazanma" in market:
            if h > a and a == 0:
                result = home
            elif a > h and h == 0:
                result = away
            else:
                result = "Yok"
            return f"2. Yarı sıfıra karşı kazanan: {result}"
        return (
            f"2. Yarı skoru: {h}-{a}\n"
            f"2. Yarı sonucu: {_winner_name(h, a, home, away)}\n"
            f"2. Yarı toplam gol: {total}"
        )

    # İki yarıya birden bağlı marketler
    two_half_markets = (
        "karşılıklı gol ilk yarı/ikinci yarı",
        "iki yarıda da karşılıklı gol",
        "her iki yarıda da gol",
        "her iki yarıda da skor yapma",
        "her iki yarıyı kazanma",
        "her iki yarıyı da kazanma",
        "herhangi yarıyı kazanma",
        "herhangi bir yarıyı kazanma",
        "toplam skor 1. yarı/2. yarı",
        "takım toplam skoru 1. yarı/2. yarı",
        "hangi yarı daha çok skor olur",
        "kim kazanır ve en çok skor olan yarı",
        "çifte şans ve en çok skor olan yarı",
        "her iki takımda gol atar ve en çok skor olan yarı",
    )

    if any(key in market for key in two_half_markets):
        if not half_scores:
            return _needs_data("doğrulanmış ilk yarı skoru (ht_score)")

        fh, fa = half_scores["first"]
        sh, sa = half_scores["second"]
        first_total = fh + fa
        second_total = sh + sa

        if first_total > second_total:
            most = "1. Yarı"
        elif second_total > first_total:
            most = "2. Yarı"
        else:
            most = "Eşit"

        if "karşılıklı gol" in market:
            return (
                f"1. Yarı KG: {'VAR' if _btts(fh, fa) else 'YOK'}\n"
                f"2. Yarı KG: {'VAR' if _btts(sh, sa) else 'YOK'}\n"
                f"En çok gol olan yarı: {most}"
            )

        return (
            f"1. Yarı: {fh}-{fa} (toplam {first_total})\n"
            f"2. Yarı: {sh}-{sa} (toplam {second_total})\n"
            f"En çok gol olan yarı: {most}"
        )

    # ------------------------------------------------------------------
    # KORNER MARKETLERİ
    # ------------------------------------------------------------------

    if "korner" in market:
        if not corners_available:
            return _needs_data("toplam korner sayıları")

        half_corners = _get_half_corners(match_info)

        if "1. yarı" in market:
            if not half_corners:
                return _needs_data("1. yarı korner sayıları (ht_corners)")
            ch, ca = half_corners["first"]
        elif "2. yarı" in market:
            if not half_corners:
                return _needs_data("1. yarı korner sayıları; 2. yarı korneri toplamdan çıkarılır")
            ch, ca = half_corners["second"]
        else:
            ch, ca = hc, ac

        ctotal = ch + ca

        if "üst/alt" in market:
            return _totals_lines(ctotal, "korner")

        if "tek/çift" in market:
            return f"Toplam korner: {ctotal} → {_odd_even(ctotal)}"

        if "en çok korner" in market:
            if ch > ca:
                result = f"{home} daha çok korner kullandı"
            elif ca > ch:
                result = f"{away} daha çok korner kullandı"
            else:
                result = "Korner sayıları eşit"
            return f"Kornerler: {home} {ch} - {ca} {away}\n➡️ {result}"

        if "korner sayısı" in market:
            return f"Kornerler: {home} {ch} - {ca} {away}\nToplam korner: {ctotal}"

        if "handikap" in market:
            return (
                f"Kornerler: {home} {ch} - {ca} {away}\n"
                "⚠️ Handikap çizgisi belirtilmediği için yalnız ham korner sonucu gösterildi."
            )

        return (
            f"Kornerler: {home} {ch} - {ca} {away}\n"
            f"Toplam korner: {ctotal}\n"
            f"Tek/Çift: {_odd_even(ctotal)}"
        )

    # ------------------------------------------------------------------
    # NORMAL SÜRE - DOĞRUDAN SONUÇLANDIRILABİLEN MARKETLER
    # ------------------------------------------------------------------

    if "doğru skor" in market:
        return f"🎯 Doğru Skor: {hg}-{ag}"

    if "maç sonucu" in market and "ilk yarı" not in market:
        return (
            f"{_score_market_header(match_info)}\n"
            f"🏁 Maç Sonucu (1X2): {winner_name}"
        )

    if market.startswith("üst/alt") or "skor üst/alt, normal süre" in market:
        return (
            f"{_score_market_header(match_info)}\n"
            f"📊 {_totals_lines(total_goals, 'gol')}"
        )

    if "karşılıklı gol" in market and "maç bahsi" not in market and "çifte şans" not in market:
        specific = _specific_ou(total_goals, bet_choice)
        text = f"🤝 Karşılıklı Gol: {'VAR' if btts else 'YOK'}"
        if "toplam" in market or "üst/alt" in market:
            text += f"\n📊 Toplam gol: {total_goals}"
            if specific:
                text += f"\n📌 {specific}"
        return text

    if "beraberlikte iade" in market:
        return f"↩️ Beraberlikte İade sonucu: {_draw_no_bet(hg, ag, home, away)}"

    if "ev sahibi iade" in market:
        if hg == ag:
            result = "Ev Sahibi seçimi iade"
        elif hg > ag:
            result = f"Ev Sahibi ({home}) kazandı"
        else:
            result = f"Deplasman ({away}) kazandı"
        return result

    if "deplasman iade" in market:
        if hg == ag:
            result = "Deplasman seçimi iade"
        elif ag > hg:
            result = f"Deplasman ({away}) kazandı"
        else:
            result = f"Ev Sahibi ({home}) kazandı"
        return result

    if "çifte şans" in market:
        text = f"🛡️ {_double_chance(hg, ag)}"
        specific = _specific_ou(total_goals, bet_choice)
        if specific:
            text += f"\n📊 {specific}"
        if "karşılıklı gol" in market:
            text += f"\n🤝 KG: {'VAR' if btts else 'YOK'}"
        return text

    if "tek/çift" in market:
        return f"🔢 Toplam gol: {total_goals} → {_odd_even(total_goals)}"

    if "gol yemeyen takım" in market:
        return f"🧤 {_clean_sheet_result(hg, ag, home, away)}"

    if "sıfıra karşı kazanma" in market:
        if hg > ag and ag == 0:
            result = home
        elif ag > hg and hg == 0:
            result = away
        else:
            result = "Yok"
        return f"🧱 Sıfıra karşı kazanan: {result}"

    if "her iki takım da en az 2 gol atar" in market:
        result = "EVET" if hg >= 2 and ag >= 2 else "HAYIR"
        return f"Her iki takım da en az 2 gol attı mı? {result}"

    if "skor yapan takım sayısı" in market:
        count = _team_scoring_count(hg, ag)
        return f"Skor yapan takım sayısı: {count}"

    if "skor yapan takımlar" in market:
        return f"Gol atan takımlar: {_team_scoring_names(hg, ag, home, away)}"

    if "toplam skor hariç" in market:
        return (
            f"Toplam gol: {total_goals}\n"
            "⚠️ 'Hariç' seçeneğinin hangi toplam değeri dışladığı belirtilmedi."
        )

    if (
        "toplam skoru" in market
        or "toplam goller" in market
        or "toplam skor," in market
    ):
        return (
            f"Toplam gol: {total_goals}\n"
            f"{_totals_lines(total_goals, 'gol')}"
        )

    if "gol atar, normal süre" in market:
        return (
            f"{home}: {'Gol attı' if hg > 0 else 'Gol atamadı'}\n"
            f"{away}: {'Gol attı' if ag > 0 else 'Gol atamadı'}"
        )

    if "golü atacak takım" in market:
        return (
            f"Gol atan takımlar: {_team_scoring_names(hg, ag, home, away)}\n"
            "⚠️ İlk/sonraki gol sırası için dakika bazlı gol olayları gerekir."
        )

    if "kazanç marjini" in market:
        return f"📏 Kazanç Marjı: {_winning_margin(hg, ag, home, away)}"

    if "maçın kazananı ve toplam skor" in market or "kim kazanır ve toplam skor" in market:
        return (
            f"🏁 Kazanan: {winner_name}\n"
            f"📊 Toplam gol: {total_goals}"
        )

    if "maçın kazananı & karşılıklı gol" in market or "maç bahsi ve karşılıklı gol" in market:
        return (
            f"🏁 Maç Sonucu: {winner_name}\n"
            f"🤝 Karşılıklı Gol: {'VAR' if btts else 'YOK'}"
        )

    if "kim kazanır veya her iki takım da gol atar" in market:
        return (
            f"🏁 Maç Sonucu: {winner_name}\n"
            f"🤝 KG: {'VAR' if btts else 'YOK'}"
        )

    if "kim kazanır veya üst/alt" in market:
        return (
            f"🏁 Maç Sonucu: {winner_name}\n"
            f"📊 {_totals_lines(total_goals, 'gol')}"
        )

    if "kim kazanır ve takım skoru üst/alt" in market:
        return (
            f"🏁 Maç Sonucu: {winner_name}\n"
            f"{home} takım golü: {hg}\n"
            f"{away} takım golü: {ag}"
        )

    if "karşılıklı gol olur veya 2.5 üst" in market:
        cond = btts or total_goals > 2.5
        return (
            f"KG: {'VAR' if btts else 'YOK'} | "
            f"2.5: {'ÜST' if total_goals > 2.5 else 'ALT'}\n"
            f"➡️ 'KG Var VEYA 2.5 Üst' sonucu: {'EVET' if cond else 'HAYIR'}"
        )

    if "handikap" in market or "asya handikapı" in market:
        return (
            f"Skor: {hg}-{ag} | Gol farkı: {hg - ag:+d} ({home} açısından)\n"
            "⚠️ Handikap çizgisi belirtilmediği için belirli bir seçim kazanmış/kaybetmiş olarak işaretlenmedi."
        )

    # ------------------------------------------------------------------
    # MANUEL / TANIMSIZ MARKETLER İÇİN GÜVENLİ GENEL RAPOR
    # ------------------------------------------------------------------

    return (
        f"{_score_market_header(match_info)}\n"
        f"🏁 1X2: {winner_name}\n"
        f"🤝 KG: {'VAR' if btts else 'YOK'}\n"
        f"📊 Toplam gol: {total_goals} ({_odd_even(total_goals)})\n"
        f"🧤 {_clean_sheet_result(hg, ag, home, away)}\n"
        f"📏 Kazanç marjı: {_winning_margin(hg, ag, home, away)}\n"
        f"📌 Seçilen market: {bet_choice}\n"
        "ℹ️ Bu market için özel bir alt seçim/çizgi girilmediğinden temel maç sonucu bileşenleri gösterildi."
    )
