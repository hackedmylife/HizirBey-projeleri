"""
esports_sources.py

E-Spor için çoklu kaynak zinciri:
1) PandaScore (resmi API, token varsa)
2) Offstage.gg (CS2, tokensız doğrudan maç URL fallback)
3) HLTV (CS2, web fallback, Cloudflare nedeniyle engellenebilir)
4) ESportsBattle (kendi eFootball/eBasketball etkinlikleri)
5) Sonraki kaynaklar scraper.py içinde: Sofascore -> BetsAPI

PandaScore token:
- PANDASCORE_TOKEN ortam değişkeni
veya
- proje ana klasöründe pandascore_token.txt
"""

import os
import sys
import re
import html
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher
from datetime import datetime, timezone

try:
    from curl_cffi import requests as http_requests
    HAS_CURL_CFFI = True
except ImportError:
    import requests as http_requests
    HAS_CURL_CFFI = False


PANDASCORE_BASE = "https://api.pandascore.co"
HLTV_BASE = "https://www.hltv.org"
OFFSTAGE_BASE = "https://www.offstage.gg"

ESPORTSBATTLE_ROOTS = [
    "https://football.esportsbattle.com/en/",
    "https://basketball.esportsbattle.com/en/",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/140.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
    "Cache-Control": "no-cache",
}


def _norm(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = html.unescape(value).lower().strip()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _similar(a, b):
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()


def _team_score(actual, requested):
    a = _norm(actual)
    r = _norm(requested)

    if not a or not r:
        return 0.0

    if a == r:
        return 1.0

    if a in r or r in a:
        return 0.94

    return _similar(actual, requested)


def _strip_tags(text):
    text = re.sub(r"<script\b.*?</script>", " ", text or "", flags=re.I | re.S)
    text = re.sub(r"<style\b.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _http_get(url, params=None, headers=None, timeout=20):
    headers = headers or HEADERS

    if HAS_CURL_CFFI:
        r = http_requests.get(
            url,
            params=params,
            headers=headers,
            timeout=timeout,
            impersonate="chrome",
        )
    else:
        r = http_requests.get(
            url,
            params=params,
            headers=headers,
            timeout=timeout,
        )

    r.raise_for_status()
    return r


def _orient(source1, source2, wanted1, wanted2):
    direct = _team_score(source1, wanted1) + _team_score(source2, wanted2)
    swapped = _team_score(source1, wanted2) + _team_score(source2, wanted1)

    if max(direct, swapped) < 1.35:
        return None

    return "direct" if direct >= swapped else "swapped"


def _base_result(
    status,
    status_text,
    source,
    team1,
    team2,
    target_date,
    score=None,
    event_id=None,
    game=None,
    event_name=None,
    source_url=None,
):
    return {
        "status": status,
        "status_text": status_text,
        "score": score,
        "corners": {"home": 0, "away": 0},
        "ht_score": None,
        "ht_corners": None,
        "team_stats": {"ALL": {}, "1ST": {}, "2ND": {}},
        "player_stats": {"home": [], "away": []},
        "goals": [],
        "events": [],
        "event_id": event_id,
        "real_date": target_date.strftime("%d.%m.%Y") if target_date else None,
        "matched_home": team1,
        "matched_away": team2,
        "source": source,
        "source_url": source_url,
        "sport": "E-Spor",
        "esport_game": game,
        "event_name": event_name,
    }


# ----------------------------------------------------------------------
# PANDASCORE
# ----------------------------------------------------------------------

def _get_pandascore_token():
    token = os.getenv("PANDASCORE_TOKEN", "").strip()
    if token:
        return token

    dirs = []

    def add(value):
        if not value:
            return
        try:
            path = Path(value).expanduser().resolve()
        except Exception:
            return
        if path not in dirs:
            dirs.append(path)

    module_dir = Path(__file__).resolve().parent
    add(Path.cwd())
    add(Path.cwd() / "project")
    add(module_dir)
    add(module_dir.parent)

    if getattr(sys, "frozen", False):
        try:
            exe_dir = Path(sys.executable).resolve().parent
            add(exe_dir)
            add(exe_dir / "project")
        except Exception:
            pass

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        add(Path(meipass))
        add(Path(meipass) / "project")

    for env_name in ("LOCALAPPDATA", "APPDATA"):
        root = os.environ.get(env_name)
        if root:
            add(Path(root) / "HizirBeySports")
            add(Path(root) / "HizirBeySports" / "project")

    for base in dirs:
        token_path = base / "pandascore_token.txt"
        try:
            if token_path.is_file():
                token = token_path.read_text(encoding="utf-8-sig", errors="replace").strip().strip('"\'')
                if token:
                    return token
        except OSError:
            continue

    return ""


def _pandascore_find(home, away, target_date, logs):
    logs.append("[PandaScore] aranıyor...")

    token = _get_pandascore_token()
    if not token:
        logs.append(
            "PandaScore: token yok. PANDASCORE_TOKEN ortam değişkeni veya "
            "proje ana klasöründe pandascore_token.txt kullanılabilir."
        )
        return None

    day = target_date.strftime("%Y-%m-%d")
    headers = {
        **HEADERS,
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    # PandaScore range[...] tarih aralığı için kullanılmamalı: güncel API'de
    # sayfalama yapıp tarihi yerelde filtrelemek daha dayanıklı. Her sayfada
    # maksimum 100 kayıt alınır. Hedef tarihten eski kayıtlara geçince dururuz.
    matches = []
    max_pages = 8
    try:
        for page in range(1, max_pages + 1):
            params = {
                "page[number]": page,
                "page[size]": 100,
                "sort": "-begin_at",
            }
            r = _http_get(
                f"{PANDASCORE_BASE}/matches",
                params=params,
                headers=headers,
                timeout=20,
            )
            batch = r.json()
            if not isinstance(batch, list):
                logs.append("PandaScore: beklenmeyen cevap formatı.")
                return None
            if not batch:
                break

            dated = [str(m.get("begin_at") or "")[:10] for m in batch if m.get("begin_at")]
            day_batch = [m for m in batch if str(m.get("begin_at") or "")[:10] == day]
            matches.extend(day_batch)
            logs.append(
                f"PandaScore: sayfa {page} -> {len(batch)} kayıt, hedef tarihte {len(day_batch)}."
            )

            # Sıralama yeni -> eski. Sayfanın tamamı hedef günden eskiyse devam etme.
            if dated and max(dated) < day:
                break
            if len(batch) < 100:
                break
    except Exception as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        body = getattr(getattr(e, "response", None), "text", "") or ""
        logs.append(
            f"PandaScore HATASI (HTTP {status or '?'}): "
            f"{body[:500].strip() or str(e)}"
        )
        return None

    logs.append(f"PandaScore: {day} için toplam {len(matches)} karşılaşma eşleştirilecek.")
    candidates = []
    for match in matches:
        opponents = match.get("opponents") or []
        names = []
        for obj in opponents:
            opponent = obj.get("opponent") or {}
            name = opponent.get("name") or obj.get("name")
            if name:
                names.append((name, opponent.get("id") or obj.get("id")))
        if len(names) < 2:
            continue
        orient = _orient(names[0][0], names[1][0], home, away)
        if not orient:
            continue
        if orient == "direct":
            h_name, h_id = names[0]
            a_name, a_id = names[1]
        else:
            h_name, h_id = names[1]
            a_name, a_id = names[0]
        confidence = _team_score(h_name, home) + _team_score(a_name, away)
        candidates.append((confidence, match, h_name, a_name, h_id, a_id))

    if not candidates:
        logs.append("PandaScore: hedef tarihte iki katılımcı eşleşmedi.")
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)
    _, match, h_name, a_name, h_id, a_id = candidates[0]
    status_raw = _norm(match.get("status"))
    game_obj = match.get("videogame") or {}
    game = game_obj.get("name") or game_obj.get("slug") or "E-Spor"
    league_obj = match.get("league") or {}
    serie_obj = match.get("serie") or {}
    tournament_obj = match.get("tournament") or {}
    event_name = tournament_obj.get("name") or serie_obj.get("full_name") or serie_obj.get("name") or league_obj.get("name")
    status_map = {
        "finished": ("OK", "Karşılaşma tamamlandı"),
        "running": ("LIVE", "Karşılaşma canlı"),
        "not started": ("SCHEDULED", "Karşılaşma henüz başlamadı"),
        "not_started": ("SCHEDULED", "Karşılaşma henüz başlamadı"),
        "canceled": ("CANCELLED", "Karşılaşma iptal edildi"),
        "cancelled": ("CANCELLED", "Karşılaşma iptal edildi"),
        "postponed": ("POSTPONED", "Karşılaşma ertelendi"),
    }
    status, status_text = status_map.get(status_raw, ("SCHEDULED", f"Karşılaşma durumu: {match.get('status') or '?'}"))
    score_map = {}
    for item in match.get("results") or []:
        team_id, score_value = item.get("team_id"), item.get("score")
        if team_id is not None and score_value is not None:
            score_map[team_id] = score_value
    score = f"{score_map[h_id]}-{score_map[a_id]}" if h_id in score_map and a_id in score_map else None
    if status == "OK" and score is None:
        logs.append("PandaScore: maç tamamlandı fakat seri skoru yok; sonraki kaynağa geçiliyor.")
        return None
    logs.append(f"PandaScore: BULUNDU -> {h_name} {score or '-'} {a_name} | {game} | {status_text}")
    return _base_result(status, status_text, "PandaScore", h_name, a_name, target_date,
                        score=score, event_id=match.get("id"), game=game,
                        event_name=event_name,
                        source_url=f"{PANDASCORE_BASE}/matches/{match.get('id')}" if match.get("id") is not None else f"{PANDASCORE_BASE}/matches")


# ----------------------------------------------------------------------
# OFFSTAGE.GG — CS2 TOKENSIZ DOĞRUDAN URL FALLBACK
# ----------------------------------------------------------------------

def _slugify(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def _offstage_status(text):
    text_n = _norm(text)

    if "match status match finished" in text_n or "match finished" in text_n:
        return "OK", "CS2 karşılaşması tamamlandı"

    if "match status not started" in text_n or "not started" in text_n:
        return "SCHEDULED", "CS2 karşılaşması henüz başlamadı"

    if "match status live" in text_n or "match status in progress" in text_n:
        return "LIVE", "CS2 karşılaşması canlı"

    if "postponed" in text_n:
        return "POSTPONED", "CS2 karşılaşması ertelendi"

    if "cancelled" in text_n or "canceled" in text_n:
        return "CANCELLED", "CS2 karşılaşması iptal edildi"

    return None, None


def _offstage_extract_series_score(text, home, away):
    """
    Offstage bitmiş maçlarda sayfada:
      'Final score — 0:1.'
    veya
      'Falcons Force vs PURE ended 0:1.'
    gibi seri skoru bulunur.

    Maç Kazananı / harita handikapı için seri skoru map round skorundan
    (örn. 4:13) daha doğru temel sonuçtur.
    """
    patterns = [
        r"Final score\s*[—:-]\s*(\d+)\s*[:\-]\s*(\d+)",
        rf"{re.escape(home)}\s+vs\s+{re.escape(away)}\s+ended\s+"
        r"(\d+)\s*[:\-]\s*(\d+)",
        r"ended\s+(\d+)\s*[:\-]\s*(\d+)",
    ]

    for pattern in patterns:
        m = re.search(pattern, text, flags=re.I)
        if m:
            return int(m.group(1)), int(m.group(2))

    return None


def _offstage_extract_map_score(text):
    """
    Scoreboard bölümündeki harita round skorunu best-effort çıkarır.
    Örn. Inferno 4 : 13.
    """
    m = re.search(
        r"Scoreboard.*?Match details.*?"
        r"\b(\d{1,2})\s*:\s*(\d{1,2})\b",
        text,
        flags=re.I | re.S,
    )
    if m:
        return {
            "home": int(m.group(1)),
            "away": int(m.group(2)),
        }
    return None


def _offstage_extract_event(text):
    m = re.search(
        r"Tournament\s+(.+?)(?:\s+Match status|\s+Scoreboard)",
        text,
        flags=re.I | re.S,
    )
    if not m:
        return None

    value = re.sub(r"\s+", " ", m.group(1)).strip()
    return value[:160] if value else None


def _offstage_parse(
    page_html,
    wanted_home,
    wanted_away,
    target_date,
    page_url,
    logs,
):
    text = _strip_tags(page_html)

    # Doğru sayfa olduğunu iki takım adıyla doğrula.
    if (
        _team_score(wanted_home, text) < 0.20
        or _norm(wanted_home) not in _norm(text)
        or _norm(wanted_away) not in _norm(text)
    ):
        return None

    # Offstage sayfasında navigasyon/metin blokları aynı satıra birleşebildiği
    # için takım adlarını serbest regex ile çekmiyoruz. Kullanıcının girdiği
    # iki adı sayfada ve "X vs Y" başlığında doğrulayıp temiz adları koruyoruz.
    text_n = _norm(text)
    wanted_home_n = _norm(wanted_home)
    wanted_away_n = _norm(wanted_away)

    direct_phrase = f"{wanted_home_n} vs {wanted_away_n}"
    reverse_phrase = f"{wanted_away_n} vs {wanted_home_n}"

    if direct_phrase in text_n:
        h_name, a_name = wanted_home, wanted_away
    elif reverse_phrase in text_n:
        # Sayfada ters sıra olsa bile uygulamanın girilen katılımcı yönünü koru.
        h_name, a_name = wanted_home, wanted_away
    else:
        # İki isim sayfada bulunuyor ama başlık kalıbı farklıysa yine temiz
        # kullanıcı isimlerini kullan; böylece menü/nav metni takım adına taşmaz.
        if wanted_home_n not in text_n or wanted_away_n not in text_n:
            return None
        h_name, a_name = wanted_home, wanted_away

    status, status_text = _offstage_status(text)
    if not status:
        return None

    series = _offstage_extract_series_score(
        text,
        h_name,
        a_name,
    )

    score = None
    if series:
        score = f"{series[0]}-{series[1]}"

    if status == "OK" and not score:
        logs.append(
            "Offstage.gg: bitmiş maç bulundu ancak seri skoru ayrıştırılamadı."
        )
        return None

    map_score = _offstage_extract_map_score(text)
    event_name = _offstage_extract_event(text)

    logs.append(
        f"Offstage.gg: BULUNDU -> "
        f"{h_name} {score or '-'} {a_name} | {status_text}"
    )

    result = _base_result(
        status,
        status_text,
        "Offstage.gg (CS2)",
        h_name,
        a_name,
        target_date,
        score=score,
        event_id=page_url,
        game="Counter-Strike 2",
        event_name=event_name,
        source_url=page_url,
    )

    if map_score:
        result["map_scores"] = [{
            "map": None,
            "home": map_score["home"],
            "away": map_score["away"],
        }]
        result["round_score"] = (
            f"{map_score['home']}-{map_score['away']}"
        )

    return result


def _offstage_find(home, away, target_date, logs):
    logs.append("[E2/4] Offstage.gg (CS2) aranıyor...")

    date_iso = target_date.strftime("%Y-%m-%d")
    home_slug = _slugify(home)
    away_slug = _slugify(away)

    urls = []

    # Önce güncel Offstage maç liste sayfalarından gerçek bağlantıları keşfet.
    # Eski takım-vs-takım slug tahmini 404 üretebildiği için artık yalnızca
    # son çare olarak kullanılıyor.
    for listing in (f"{OFFSTAGE_BASE}/cs2/matches", f"{OFFSTAGE_BASE}/cs2/matches/finished"):
        try:
            lr = _http_get(listing, headers={**HEADERS, "Referer": OFFSTAGE_BASE + "/"}, timeout=20)
            for m in re.finditer(r'href=["\']([^"\']*/cs2/matches/[^"\']+)["\']', lr.text or "", flags=re.I):
                href = html.unescape(m.group(1))
                full = href if href.startswith("http") else OFFSTAGE_BASE + (href if href.startswith("/") else "/" + href)
                context = _strip_tags((lr.text or "")[max(0,m.start()-2200):min(len(lr.text or ""),m.end()+2200)])
                if _norm(home) in _norm(context) and _norm(away) in _norm(context):
                    urls.append(full)
        except Exception as e:
            logs.append(f"Offstage.gg liste erişimi başarısız: {type(e).__name__}: {e}")

    urls.extend([
        f"{OFFSTAGE_BASE}/cs2/matches/{home_slug}-vs-{away_slug}-{date_iso}",
        f"{OFFSTAGE_BASE}/cs2/matches/{away_slug}-vs-{home_slug}-{date_iso}",
    ])
    urls = list(dict.fromkeys(urls))

    for url in urls:
        try:
            r = _http_get(
                url,
                headers={
                    **HEADERS,
                    "Referer": "https://www.offstage.gg/cs2/matches",
                },
                timeout=20,
            )

            result = _offstage_parse(
                r.text,
                home,
                away,
                target_date,
                url,
                logs,
            )

            if result:
                return result

        except Exception as e:
            logs.append(
                f"Offstage.gg erişim denemesi başarısız: "
                f"{type(e).__name__}: {e}"
            )

    logs.append(
        "Offstage.gg: takım+tarih URL'lerinde karşılaşma doğrulanamadı."
    )
    return None


# ----------------------------------------------------------------------
# HLTV — CS2 TOKENSIZ FALLBACK
# ----------------------------------------------------------------------

def _extract_hltv_team(html_text, n):
    pattern = (
        rf'class=["\'][^"\']*team{n}-gradient[^"\']*["\']'
        rf'.{{0,4500}}?'
        rf'class=["\'][^"\']*teamName[^"\']*["\'][^>]*>'
        rf'(.*?)</'
    )
    m = re.search(pattern, html_text, flags=re.I | re.S)
    return _strip_tags(m.group(1)) if m else ""


def _extract_hltv_event(html_text):
    m = re.search(
        r'class=["\'][^"\']*timeAndEvent[^"\']*["\']'
        r'.{0,5000}?class=["\'][^"\']*event[^"\']*["\']'
        r'.{0,1500}?<a[^>]*>(.*?)</a>',
        html_text,
        flags=re.I | re.S,
    )
    return _strip_tags(m.group(1)) if m else None


def _extract_hltv_date(html_text):
    m = re.search(
        r'class=["\'][^"\']*date[^"\']*["\'][^>]*data-unix=["\'](\d+)["\']',
        html_text,
        flags=re.I,
    )

    if not m:
        return None

    value = int(m.group(1))
    if value > 10_000_000_000:
        value = value / 1000

    try:
        return datetime.fromtimestamp(value).date()
    except Exception:
        return None


def _extract_hltv_countdown(html_text):
    m = re.search(
        r'class=["\'][^"\']*countdown[^"\']*["\'][^>]*>(.*?)</',
        html_text,
        flags=re.I | re.S,
    )
    return _strip_tags(m.group(1)) if m else ""


def _extract_hltv_overall_score(html_text, team_num):
    # HLTV getMatch implementations determine winner from .teamN-gradient .won.
    start = re.search(
        rf'class=["\'][^"\']*team{team_num}-gradient[^"\']*["\']',
        html_text,
        flags=re.I,
    )
    if not start:
        return None

    other = 2 if team_num == 1 else 1
    end = re.search(
        rf'class=["\'][^"\']*team{other}-gradient[^"\']*["\']',
        html_text[start.end():],
        flags=re.I,
    )

    block_end = (
        start.end() + end.start()
        if end
        else min(len(html_text), start.end() + 6500)
    )
    block = html_text[start.start():block_end]

    m = re.search(
        r'class=["\'][^"\']*(?:won|lost)[^"\']*["\'][^>]*>\s*(\d+)\s*<',
        block,
        flags=re.I,
    )
    if m:
        return int(m.group(1))

    return None


def _hltv_detail_from_html(
    html_text,
    wanted_home,
    wanted_away,
    target_date,
    match_url,
    logs,
):
    team1 = _extract_hltv_team(html_text, 1)
    team2 = _extract_hltv_team(html_text, 2)

    if not team1 or not team2:
        return None

    orient = _orient(team1, team2, wanted_home, wanted_away)
    if not orient:
        return None

    event_date = _extract_hltv_date(html_text)
    if event_date and event_date != target_date:
        return None

    countdown = _extract_hltv_countdown(html_text)
    countdown_n = _norm(countdown)

    if countdown_n == "live":
        status, status_text = "LIVE", "CS2 karşılaşması canlı"
    elif "postponed" in countdown_n:
        status, status_text = "POSTPONED", "CS2 karşılaşması ertelendi"
    elif "deleted" in countdown_n:
        status, status_text = "CANCELLED", "CS2 karşılaşması iptal/silindi"
    elif "match over" in countdown_n:
        status, status_text = "OK", "CS2 karşılaşması tamamlandı"
    else:
        status, status_text = "SCHEDULED", "CS2 karşılaşması henüz başlamadı"

    score1 = _extract_hltv_overall_score(html_text, 1)
    score2 = _extract_hltv_overall_score(html_text, 2)

    if orient == "direct":
        h_name, a_name = team1, team2
        h_score, a_score = score1, score2
    else:
        h_name, a_name = team2, team1
        h_score, a_score = score2, score1

    score = (
        f"{h_score}-{a_score}"
        if h_score is not None and a_score is not None
        else None
    )

    # Match over ama seri skoru alınamadıysa sonuç yerine sonraki kaynağa bırak.
    if status == "OK" and score is None:
        return None

    event_name = _extract_hltv_event(html_text)
    match_id = None
    m_id = re.search(r"/matches/(\d+)/", match_url)
    if m_id:
        match_id = m_id.group(1)

    logs.append(
        f"HLTV: BULUNDU -> {h_name} {score or '-'} {a_name} "
        f"| {status_text}"
    )

    return _base_result(
        status,
        status_text,
        "HLTV (CS2)",
        h_name,
        a_name,
        target_date,
        score=score,
        event_id=match_id,
        game="Counter-Strike 2",
        event_name=event_name,
        source_url=match_url,
    )


def _hltv_candidate_links(page_html, home, away):
    links = []
    seen = set()

    for m in re.finditer(
        r'href=["\'](/matches/\d+/[^"\']+)["\']',
        page_html or "",
        flags=re.I,
    ):
        link = m.group(1)

        if link in seen:
            continue

        context = _strip_tags(
            page_html[
                max(0, m.start() - 2500):
                min(len(page_html), m.end() + 2500)
            ]
        )

        # Liste sayfası kalabalık; en azından iki takım adına yakın benzerlik ara.
        context_n = _norm(context)
        home_n = _norm(home)
        away_n = _norm(away)

        if (
            (home_n and home_n in context_n)
            and (away_n and away_n in context_n)
        ):
            seen.add(link)
            links.append(HLTV_BASE + link)

    return links


def _hltv_find(home, away, target_date, logs):
    logs.append("[E3/4] HLTV (CS2) aranıyor...")

    date_iso = target_date.strftime("%Y-%m-%d")
    pages = [
        (
            f"{HLTV_BASE}/results",
            {"startDate": date_iso, "endDate": date_iso},
        ),
        (
            f"{HLTV_BASE}/matches",
            {"startDate": date_iso, "endDate": date_iso},
        ),
        (f"{HLTV_BASE}/matches", None),
    ]

    links = []

    for url, params in pages:
        try:
            r = _http_get(
                url,
                params=params,
                headers={
                    **HEADERS,
                    "Referer": "https://www.hltv.org/",
                },
                timeout=20,
            )
            links.extend(
                _hltv_candidate_links(r.text, home, away)
            )
        except Exception as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status == 403:
                logs.append("HLTV: site otomatik isteği 403 ile engelledi; bu kaynak bu çalıştırmada atlandı.")
                break
            logs.append(
                f"HLTV liste sayfası başarısız: "
                f"{type(e).__name__}: {e}"
            )

    # Tekilleştir.
    unique_links = []
    seen = set()
    for link in links:
        if link not in seen:
            seen.add(link)
            unique_links.append(link)

    if not unique_links:
        logs.append(
            "HLTV: liste sayfalarında iki takım için aday CS2 maçı bulunamadı."
        )
        return None

    logs.append(
        f"HLTV: {len(unique_links)} aday maç sayfası doğrulanıyor."
    )

    for match_url in unique_links[:8]:
        try:
            r = _http_get(
                match_url,
                headers={
                    **HEADERS,
                    "Referer": "https://www.hltv.org/matches",
                },
                timeout=20,
            )
            result = _hltv_detail_from_html(
                r.text,
                home,
                away,
                target_date,
                match_url,
                logs,
            )
            if result:
                return result
        except Exception as e:
            logs.append(
                f"HLTV maç detayı başarısız: "
                f"{type(e).__name__}: {e}"
            )

    logs.append("HLTV: aday sayfalar doğrulanamadı.")
    return None


# ----------------------------------------------------------------------
# ESPORTSBATTLE — KENDİ E-FOOTBALL / E-BASKETBALL ETKİNLİKLERİ
# ----------------------------------------------------------------------

def _esportsbattle_find(home, away, target_date, logs):
    logs.append("[E4/4] ESportsBattle aranıyor...")

    date_forms = {
        target_date.strftime("%Y/%m/%d"),
        target_date.strftime("%Y-%m-%d"),
        target_date.strftime("%d.%m.%Y"),
    }

    for root in ESPORTSBATTLE_ROOTS:
        try:
            r = _http_get(root, headers=HEADERS, timeout=20)
            page_html = r.text
        except Exception as e:
            logs.append(
                f"ESportsBattle erişim hatası ({root}): "
                f"{type(e).__name__}: {e}"
            )
            continue

        text = _strip_tags(page_html)
        text_n = _norm(text)

        if _norm(home) not in text_n or _norm(away) not in text_n:
            continue

        # Ana sayfadan yakın turnuva linklerini topla.
        links = []
        for m in re.finditer(
            r'href=["\']([^"\']*/en/tournament/\d+[^"\']*)["\']',
            page_html,
            flags=re.I,
        ):
            href = html.unescape(m.group(1))
            if href.startswith("http"):
                link = href
            else:
                domain = re.match(r"^(https?://[^/]+)", root).group(1)
                link = domain + (href if href.startswith("/") else "/" + href)

            if link not in links:
                links.append(link)

        # Önce ana sayfayı, sonra aday turnuvaları tara.
        pages = [(root, page_html)]
        for link in links[:12]:
            try:
                pr = _http_get(link, headers=HEADERS, timeout=20)
                pages.append((link, pr.text))
            except Exception:
                pass

        for page_url, candidate_html in pages:
            candidate_text = _strip_tags(candidate_html)

            if not any(df in candidate_text for df in date_forms):
                # Turnuva sayfasında yıl/tarih üst başlıkta başka biçimde olabilir;
                # iki takım çok güçlü eşleşiyorsa yine aşağıdaki yakınlık kontrolüne izin ver.
                pass

            h_pos = _norm(candidate_text).find(_norm(home))
            a_pos = _norm(candidate_text).find(_norm(away))
            if h_pos < 0 or a_pos < 0:
                continue

            # Takımlar birbirinden çok uzaksa aynı sayfadaki farklı maç olabilir.
            if abs(h_pos - a_pos) > 1200:
                continue

            lo = max(0, min(h_pos, a_pos) - 300)
            hi = min(len(candidate_text), max(h_pos, a_pos) + 500)
            snippet = candidate_text[lo:hi]

            # ESportsBattle bitmiş maçlarda 2:2 veya 85:83 gibi skor gösterir.
            score_matches = list(
                re.finditer(r"\b(\d{1,3})\s*:\s*(\d{1,3})\b", snippet)
            )

            finished = "Finished" in snippet

            if score_matches and finished:
                # İki takımın arasına/çevresine en yakın skor.
                sm = score_matches[0]
                s1, s2 = int(sm.group(1)), int(sm.group(2))

                # Kaynak metindeki takım sırasına göre yönlendir.
                if h_pos <= a_pos:
                    h_score, a_score = s1, s2
                else:
                    h_score, a_score = s2, s1

                logs.append(
                    f"ESportsBattle: BULUNDU -> "
                    f"{home} {h_score}-{a_score} {away}"
                )
                return _base_result(
                    "OK",
                    "ESportsBattle karşılaşması tamamlandı",
                    "ESportsBattle",
                    home,
                    away,
                    target_date,
                    score=f"{h_score}-{a_score}",
                    event_id=page_url,
                    game=(
                        "eFootball"
                        if "football." in root
                        else "eBasketball"
                    ),
                    source_url=page_url,
                )

            # Skor yoksa ama iki takım aynı yakın blokta ise planlanmış karşılaşma olabilir.
            if any(df in snippet for df in date_forms) or any(df in candidate_text for df in date_forms):
                logs.append(
                    f"ESportsBattle: planlanmış karşılaşma bulundu -> "
                    f"{home} - {away}"
                )
                return _base_result(
                    "SCHEDULED",
                    "ESportsBattle karşılaşması henüz tamamlanmadı",
                    "ESportsBattle",
                    home,
                    away,
                    target_date,
                    score=None,
                    event_id=page_url,
                    game=(
                        "eFootball"
                        if "football." in root
                        else "eBasketball"
                    ),
                    source_url=page_url,
                )

    logs.append(
        "ESportsBattle: bu iki katılımcı kendi eFootball/eBasketball "
        "etkinliklerinde bulunamadı."
    )
    return None


# ----------------------------------------------------------------------
# PUBLIC
# ----------------------------------------------------------------------

def _looks_like_virtual_sports(home, away):
    """Bookmaker eFootball/eBasketball adlarında sık görülen Team (Player) yapısı."""
    values = (str(home or ""), str(away or ""))
    return all(re.search(r"\([^()]{2,}\)\s*$", v) for v in values)


def find_esports_match(home, away, target_date, logs):
    """E-spor kaynağını katılımcı biçimine göre otomatik yönlendir."""
    virtual = _looks_like_virtual_sports(home, away)

    if virtual:
        logs.append(
            "E-Spor tür algılama: Team (Player) biçimi görüldü -> "
            "eFootball/eBasketball/sanal spor zinciri kullanılacak."
        )
        # CS2'ye özel Offstage/HLTV bu tür maçlarda bilinçli olarak çalıştırılmaz.
        finders = (_esportsbattle_find, _pandascore_find)
    else:
        logs.append(
            "E-Spor tür algılama: klasik takım adı -> PandaScore, ardından CS2 web fallback'leri."
        )
        finders = (_pandascore_find, _offstage_find, _hltv_find, _esportsbattle_find)

    for index, finder in enumerate(finders, 1):
        logs.append(f"E-Spor kaynak adımı {index}/{len(finders)}: {finder.__name__}")
        try:
            result = finder(home, away, target_date, logs)
        except Exception as e:
            logs.append(f"E-Spor kaynak hatası ({finder.__name__}): {type(e).__name__}: {e}")
            result = None
        if result:
            return result
    return None

