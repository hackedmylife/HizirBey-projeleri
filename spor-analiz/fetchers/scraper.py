"""
fetchers/scraper.py

Kaynak sırası (branşa göre değişir):
    Futbol: Flashscore -> API-FOOTBALL -> TheSportsDB -> football-data.org -> Sofascore -> BetsAPI -> Groq -> Puter -> Direct Web
    E-Spor: PandaScore/Offstage/HLTV/ESportsBattle -> TheSportsDB -> Sofascore -> BetsAPI -> Groq -> Puter -> Direct Web
    Diğer sporlar: Flashscore Multi-Sport -> TheSportsDB -> Sofascore -> BetsAPI -> Groq -> Puter -> Direct Web

GUI sözleşmesi:
    fetch_flashscore_data_multi_source(home, away, match_date) -> dict

Başarılı örnek:
{
    "status": "OK",
    "score": "4-0",
    "corners": {"home": 8, "away": 1},
    "source": "Flashscore",
    "debug_logs": [...]
}

Token kullanımı:
- BetsAPI: BETSAPI_TOKEN veya betsapi_token.txt
- API-FOOTBALL: API_FOOTBALL_TOKEN veya api_football_token.txt
- football-data.org: FOOTBALL_DATA_TOKEN veya football_data_token.txt
- TheSportsDB: ücretsiz 123 anahtarı varsayılan; isteğe bağlı THESPORTSDB_API_KEY
- Groq Web AI: GROQ_API_KEY veya groq_api_key.txt

Önemli:
Flashscore ve Sofascore burada resmi/public geliştirici API'leri değildir.
Site tarafındaki endpoint'ler zaman içinde değişebilir.
"""

import os
import re
import unicodedata
import json
import urllib.parse
import urllib.request
import urllib.error
import time
import threading
from pathlib import Path
from difflib import SequenceMatcher
from datetime import datetime, timedelta

try:
    from esports_sources import find_esports_match
except ImportError:
    find_esports_match = None

try:
    from sofascore_web import find_sofascore_web_match
except ImportError:
    find_sofascore_web_match = None

try:
    from groq_web_fallback import (
        run_groq_web_fallback,
        resolve_flashscore_public_url,
    )
except ImportError:
    run_groq_web_fallback = None
    resolve_flashscore_public_url = None

try:
    from puter_web_fallback import run_puter_web_fallback
except ImportError:
    run_puter_web_fallback = None

try:
    from direct_web_fallback import run_direct_web_fallback
except ImportError:
    run_direct_web_fallback = None

try:
    from sports_config import get_sport_config
except ImportError:
    def get_sport_config(name):
        return {'sofa_slug':'football','bets_id':1,'family':'football','unit':'gol','flashscore_id':1,'flashscore_hints':[],'flashscore_scan_ids':[],'sportsdb_sport':'Soccer','flashscore_verified':True}

try:
    from curl_cffi import requests as http_requests
    HAS_CURL_CFFI = True
except ImportError:
    import requests as http_requests
    HAS_CURL_CFFI = False


# ---------------------------------------------------------------------------
# AYARLAR
# ---------------------------------------------------------------------------

FLASH_FEED_HOSTS = [
    "https://www.flashscore.com/x/feed",
    "https://local-global.flashscore.ninja/2/x/feed",
    "https://2.flashscore.ninja/2/x/feed",
]

# Sofascore resmi olarak genel kullanıma açık bir spor veri API'si sunmuyor.
# 403 üreten dahili /api/v1 uçlarına zorla istek atmak yerine mevcut
# sofascore_web.py web-sayfası fallback'i kullanılır.
SOFA_BASES = []

BETS_BASES = [
    "https://api.b365api.com",
    "https://api.betsapi.com",
]

FLASH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/140.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
    "Referer": "https://www.flashscore.com/",
    "Origin": "https://www.flashscore.com",
    "x-fsign": "SW9D1eZo",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    "Pragma": "no-cache",
    "Cache-Control": "no-cache",
}

SOFA_HEADERS = {
    "User-Agent": FLASH_HEADERS["User-Agent"],
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
    "Referer": "https://www.sofascore.com/",
    "Origin": "https://www.sofascore.com",
    "X-Requested-With": "XMLHttpRequest",
    "Cache-Control": "no-cache",
}

BETS_HEADERS = {
    "User-Agent": FLASH_HEADERS["User-Agent"],
    "Accept": "application/json, text/plain, */*",
}


# ---------------------------------------------------------------------------
# TAKIM ADI NORMALİZASYONU
# ---------------------------------------------------------------------------

TEAM_ALIASES = {
    # Milli takımlar
    "arjantin": "Argentina",
    "bolivya": "Bolivia",
    "brezilya": "Brazil",
    "sili": "Chile",
    "kolombiya": "Colombia",
    "ekvador": "Ecuador",
    "paraguay": "Paraguay",
    "peru": "Peru",
    "uruguay": "Uruguay",
    "venezuela": "Venezuela",
    "turkiye": "Turkey",
    "almanya": "Germany",
    "fransa": "France",
    "hollanda": "Netherlands",
    "ingiltere": "England",
    "ispanya": "Spain",
    "italya": "Italy",
    "portekiz": "Portugal",
    "belcika": "Belgium",
    "hirvatistan": "Croatia",
    "danimarka": "Denmark",
    "isvec": "Sweden",
    "norvec": "Norway",
    "finlandiya": "Finland",
    "isvicre": "Switzerland",
    "avusturya": "Austria",
    "polonya": "Poland",
    "cekya": "Czechia",
    "ukrayna": "Ukraine",
    "yunanistan": "Greece",
    "macaristan": "Hungary",
    "romanya": "Romania",
    "bulgaristan": "Bulgaria",
    "sirbistan": "Serbia",
    "slovakya": "Slovakia",
    "slovenya": "Slovenia",
    "estonya": "Estonia",
    "letonya": "Latvia",
    "arnavutluk": "Albania",
    "galler": "Wales",
    "iskocya": "Scotland",
    "irlanda": "Republic of Ireland",
    "kuzey irlanda": "Northern Ireland",
    "japonya": "Japan",
    "guney kore": "South Korea",
    "cin": "China",
    "abd": "United States",
    "amerika": "United States",
    "meksika": "Mexico",
    "misir": "Egypt",
    "fas": "Morocco",
    "nijerya": "Nigeria",
    "senegal": "Senegal",
    "kamerun": "Cameroon",
    "avustralya": "Australia",
    "yeni zelanda": "New Zealand",

    # Türkiye kulüpleri
    "fenerbahce": "Fenerbahçe",
    "galatasaray": "Galatasaray",
    "besiktas": "Beşiktaş",
    "trabzonspor": "Trabzonspor",
    "basaksehir": "İstanbul Başakşehir",
    "samsunspor": "Samsunspor",
}


def _norm(value: str) -> str:
    value = str(value or "")
    value = value.translate(str.maketrans({
        "ı": "i", "İ": "I",
        "ş": "s", "Ş": "S",
        "ğ": "g", "Ğ": "G",
        "ç": "c", "Ç": "C",
        "ö": "o", "Ö": "O",
        "ü": "u", "Ü": "U",
    }))
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = value.lower().strip()
    value = re.sub(r"[\u2018\u2019'`]", "", value)
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _basketball_team_name(value: str) -> str:
    """Basketbol takım adındaki kadın takım işaretlerini eşleştirme için temizler.

    (W), (K), [W], [K], Women/Women's, Kadın/Kadin aynı anlamda kabul edilir.
    Kaynakta takım adı sade ise kullanıcıdaki kadın etiketi eşleşmeyi bozmaz.
    """
    text = str(value or "").strip()
    text = re.sub(r"\s*[\(\[]\s*(?:w|k)\s*[\)\]]\s*$", "", text, flags=re.I)
    text = re.sub(r"\s+(?:women(?:'s)?|woman|kadin|kadın)\s*$", "", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def _basketball_norm(value: str) -> str:
    return _norm(_basketball_team_name(value))


def _resolve_name(name: str) -> str:
    return TEAM_ALIASES.get(_norm(name), name)


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()


def _tokenized_name(value):
    return [x for x in _norm(value).split() if x]


def _abbreviated_person_score(actual, requested):
    """
    Tenis / masa tenisi gibi kaynaklarda:
        'Shao Y.'  <-> 'Yushan Shao'
        'Zakharova A.' <-> 'Anastasia Zakharova'
    eşleşmelerini güvenilir biçimde yakalar.
    """
    a_tokens = _tokenized_name(actual)
    r_tokens = _tokenized_name(requested)

    if len(a_tokens) < 2 or len(r_tokens) < 2:
        return 0.0

    a_long = [x for x in a_tokens if len(x) >= 3]
    r_long = [x for x in r_tokens if len(x) >= 3]

    common_long = set(a_long) & set(r_long)
    if not common_long:
        return 0.0

    a_short = [x for x in a_tokens if x not in common_long]
    r_short = [x for x in r_tokens if x not in common_long]

    if not a_short or not r_short:
        return 0.90

    # En az bir isim/initial çifti aynı harfle başlıyorsa güçlü eşleşme.
    for x in a_short:
        for y in r_short:
            if x and y and x[0] == y[0]:
                return 0.96

    return 0.84


def _team_score(actual: str, requested: str) -> float:
    """
    Takım / oyuncu / dövüşçü adlarını eşleştirir.
    Kısaltılmış oyuncu adlarını da destekler.
    """
    resolved = _resolve_name(requested)

    a = _norm(actual)
    r = _norm(requested)
    rr = _norm(resolved)

    if not a:
        return 0.0

    if a == r or a == rr:
        return 1.0

    if r and (r in a or a in r):
        return 0.94

    if rr and (rr in a or a in rr):
        return 0.94

    # Token sırası değişmiş tam isimler.
    if set(_tokenized_name(actual)) == set(_tokenized_name(requested)):
        return 0.98

    return max(
        _similar(actual, requested),
        _similar(actual, resolved),
        _abbreviated_person_score(actual, requested),
        _abbreviated_person_score(actual, resolved),
    )


def _parse_date(date_str: str):
    value = (date_str or "").strip()

    for fmt in (
        "%d.%m.%Y",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d.%m.%y",
    ):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            pass

    return None



# ---------------------------------------------------------------------------
# GELİŞMİŞ TAKIM İSTATİSTİKLERİ
# ---------------------------------------------------------------------------

STAT_DEFINITIONS = {
    "total_shots": {"label": "Toplam şut", "aliases": ["total shots", "shots total", "total attempts"], "keys": ["totalshots", "shots"]},
    "shots_on_target": {"label": "İsabetli şut", "aliases": ["shots on target", "shots on goal"], "keys": ["shotsontarget", "shotsongoal"]},
    "corners": {"label": "Kornerler", "aliases": ["corner kicks", "corners"], "keys": ["cornerkicks", "corners"]},
    "yellow_cards": {"label": "Sarı kart", "aliases": ["yellow cards", "yellow card"], "keys": ["yellowcards"]},
    "shots_off_target": {"label": "İsabetsiz şut", "aliases": ["shots off target", "shots wide", "off target"], "keys": ["shotsofftarget"]},
    "blocked_shots": {"label": "Engellenen şut", "aliases": ["blocked shots", "shots blocked"], "keys": ["blockedshots"]},
    "shots_inside_box": {"label": "Ceza sahası içinden şut", "aliases": ["shots inside box", "shots inside the box"], "keys": ["shotsinsidebox"]},
    "shots_outside_box": {"label": "Ceza sahası dışından şut", "aliases": ["shots outside box", "shots outside the box"], "keys": ["shotsoutsidebox"]},
    "hit_woodwork": {"label": "Direkten dönen şutlar", "aliases": ["hit woodwork", "woodwork", "shots off woodwork"], "keys": ["hitwoodwork"]},
    "headed_goals": {"label": "Kafa golleri", "aliases": ["headed goals", "header goals"], "keys": ["headedgoals"]},
    "touches_opposition_box": {
        "label": "Rakip ceza sahasında topla buluşma",
        "aliases": ["touches in opposition box", "touches in opponent box", "touches in penalty area", "touches in opp box"],
        "keys": ["touchesinoppositionbox", "touchesinoppbox", "touchesinpenaltyarea"],
    },
    "accurate_passes": {"label": "İsabetli pas", "aliases": ["accurate passes", "successful passes", "completed passes"], "keys": ["accuratepasses", "successfulpasses"]},
    "offsides": {"label": "Ofsayt", "aliases": ["offsides", "offside"], "keys": ["offsides"]},
    "free_kicks": {"label": "Serbest vuruşlar", "aliases": ["free kicks", "free kick"], "keys": ["freekicks"]},
    "throw_ins": {"label": "Taçlar", "aliases": ["throw ins", "throw-ins", "throw in"], "keys": ["throwins"]},
    "fouls": {"label": "Fauller", "aliases": ["fouls", "fouls committed"], "keys": ["fouls"]},
    "tackles": {"label": "Müdahale", "aliases": ["tackles", "tackles won"], "keys": ["tackles", "tacklewon"]},
    "duels_won": {"label": "Kazanılan ikili mücadele", "aliases": ["duels won", "ground duels won", "total duels won"], "keys": ["duelswon", "duelwon"]},
    "goalkeeper_saves": {"label": "Kaleci kurtarışları", "aliases": ["goalkeeper saves", "saves"], "keys": ["goalkeepersaves", "saves"]},
    "goals_prevented": {"label": "Engellenen gol", "aliases": ["goals prevented", "goal prevented"], "keys": ["goalsprevented"]},
    "goal_kicks": {"label": "Aut atışları", "aliases": ["goal kicks", "goal kick"], "keys": ["goalkicks"]},
}

STAT_ORDER = list(STAT_DEFINITIONS.keys())


def _canonical_stat_key(name="", key=""):
    name_n = _norm(name)
    key_n = _norm(key).replace(" ", "")

    for canonical, info in STAT_DEFINITIONS.items():
        if key_n and key_n in info["keys"]:
            return canonical

        for alias in info["aliases"]:
            if name_n == _norm(alias):
                return canonical

    return None


def _new_team_stats():
    return {"ALL": {}, "1ST": {}, "2ND": {}}


def _add_team_stat(target, period, name, key, home, away):
    canonical = _canonical_stat_key(name, key)
    if not canonical:
        return

    period = period if period in ("ALL", "1ST", "2ND") else "ALL"
    target.setdefault(period, {})[canonical] = {
        "label": STAT_DEFINITIONS[canonical]["label"],
        "home": home,
        "away": away,
        "source_name": name,
        "source_key": key,
    }


def _corners_from_team_stats(team_stats, period="ALL"):
    row = (team_stats.get(period) or {}).get("corners")
    if not row:
        return None

    try:
        return {
            "home": int(float(str(row.get("home", "0")).replace("%", ""))),
            "away": int(float(str(row.get("away", "0")).replace("%", ""))),
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def _http_get(url, params=None, headers=None, timeout=20):
    headers = headers or {}

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


def _http_json(url, params=None, headers=None, timeout=20):
    return _http_get(
        url,
        params=params,
        headers=headers,
        timeout=timeout,
    ).json()



# ---------------------------------------------------------------------------
# RESMÎ FUTBOL API'LERİ — API-FOOTBALL + FOOTBALL-DATA.ORG
# ---------------------------------------------------------------------------

API_FOOTBALL_BASE = "https://v3.football.api-sports.io"
FOOTBALL_DATA_BASE = "https://api.football-data.org/v4"

API_FOOTBALL_CACHE_TTL = 60 * 60
FOOTBALL_DATA_CACHE_TTL = 60 * 60
API_FOOTBALL_MAX_REQUESTS_PER_MINUTE = 8   # Free plan 10/dk; güvenlik payı.
FOOTBALL_DATA_MAX_REQUESTS_PER_MINUTE = 8  # Free plan 10/dk; güvenlik payı.

_API_FOOTBALL_CACHE = {}
_API_FOOTBALL_REQUEST_TIMES = []
_API_FOOTBALL_LOCK = threading.Lock()
_FOOTBALL_DATA_CACHE = {}
_FOOTBALL_DATA_REQUEST_TIMES = []
_FOOTBALL_DATA_LOCK = threading.Lock()


def _read_optional_token(env_name, filenames):
    token = str(os.environ.get(env_name) or "").strip().strip('"\'')
    if token:
        return token

    bases = [Path(__file__).resolve().parent, Path(__file__).resolve().parent.parent, Path.cwd()]
    for base in bases:
        for filename in filenames:
            path = base / filename
            try:
                if path.exists():
                    token = path.read_text(encoding="utf-8").strip().strip('"\'')
                    if token:
                        return token
            except OSError:
                continue
    return ""


def _api_football_token():
    return _read_optional_token(
        "API_FOOTBALL_TOKEN",
        ("api_football_token.txt", "apifootball_token.txt"),
    )


def _football_data_token():
    return _read_optional_token(
        "FOOTBALL_DATA_TOKEN",
        ("football_data_token.txt", "footballdata_token.txt"),
    )


def _rate_limited_json(
    base_url,
    endpoint,
    params,
    headers,
    cache,
    request_times,
    lock,
    max_per_minute,
    cache_ttl,
    source_name,
    logs,
    timeout=18,
):
    params = params or {}
    cache_key = (endpoint, tuple(sorted((str(k), str(v)) for k, v in params.items())))
    now = time.monotonic()

    with lock:
        cached = cache.get(cache_key)
        if cached and now - cached[0] <= cache_ttl:
            return cached[1], cached[2], "cache"

        request_times[:] = [stamp for stamp in request_times if now - stamp < 60.0]
        if len(request_times) >= max_per_minute:
            logs.append(f"{source_name}: yerel rate-limit koruması devrede; bu sorguda atlandı.")
            raise RuntimeError(f"{source_name} yerel rate-limit koruması")
        request_times.append(now)

    url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
    response = _http_get(url, params=params, headers=headers, timeout=timeout)
    data = response.json()
    final_url = getattr(response, "url", None) or url

    with lock:
        cache[cache_key] = (time.monotonic(), data, final_url)

    return data, final_url, response


def _api_football_json(endpoint, params, logs, timeout=18):
    token = _api_football_token()
    if not token:
        raise RuntimeError("API-FOOTBALL token yok")
    headers = {
        "x-apisports-key": token,
        "Accept": "application/json",
        "User-Agent": FLASH_HEADERS["User-Agent"],
    }
    data, url, response = _rate_limited_json(
        API_FOOTBALL_BASE,
        endpoint,
        params,
        headers,
        _API_FOOTBALL_CACHE,
        _API_FOOTBALL_REQUEST_TIMES,
        _API_FOOTBALL_LOCK,
        API_FOOTBALL_MAX_REQUESTS_PER_MINUTE,
        API_FOOTBALL_CACHE_TTL,
        "API-FOOTBALL",
        logs,
        timeout=timeout,
    )
    if isinstance(data, dict) and data.get("errors"):
        errors = data.get("errors")
        if errors not in ({}, [], None):
            raise RuntimeError(f"API-FOOTBALL API hatası: {errors}")
    if response != "cache" and hasattr(response, "headers"):
        remaining = response.headers.get("x-ratelimit-requests-remaining")
        if remaining not in (None, ""):
            logs.append(f"API-FOOTBALL: günlük kalan istek bilgisi={remaining}.")
    return data, url


def _football_data_json(endpoint, params, logs, timeout=18):
    token = _football_data_token()
    if not token:
        raise RuntimeError("football-data.org token yok")
    headers = {
        "X-Auth-Token": token,
        "Accept": "application/json",
        "User-Agent": FLASH_HEADERS["User-Agent"],
    }
    data, url, response = _rate_limited_json(
        FOOTBALL_DATA_BASE,
        endpoint,
        params,
        headers,
        _FOOTBALL_DATA_CACHE,
        _FOOTBALL_DATA_REQUEST_TIMES,
        _FOOTBALL_DATA_LOCK,
        FOOTBALL_DATA_MAX_REQUESTS_PER_MINUTE,
        FOOTBALL_DATA_CACHE_TTL,
        "football-data.org",
        logs,
        timeout=timeout,
    )
    if response != "cache" and hasattr(response, "headers"):
        remaining = response.headers.get("X-Requests-Available-Minute")
        if remaining not in (None, ""):
            logs.append(f"football-data.org: dakikalık kalan istek={remaining}.")
    return data, url


def _api_football_status(short_status, long_status=""):
    status = str(short_status or "").upper().strip()
    label = str(long_status or short_status or "").strip()
    if status in {"FT", "AET", "PEN"}:
        return "OK", label or "Karşılaşma tamamlandı"
    if status in {"PST"}:
        return "POSTPONED", label or "Karşılaşma ertelendi"
    if status in {"CANC"}:
        return "CANCELLED", label or "Karşılaşma iptal edildi"
    if status in {"ABD", "SUSP", "INT"}:
        return "INTERRUPTED", label or "Karşılaşma yarıda kesildi"
    if status in {"AWD", "WO"}:
        return "AWARDED", label or "Hükmen sonuçlandırıldı"
    if status in {"1H", "HT", "2H", "ET", "BT", "P", "LIVE"}:
        return "LIVE", label or "Karşılaşma canlı"
    return "SCHEDULED", label or "Karşılaşma henüz başlamadı"


def _api_football_extract_detail(item, result, logs):
    statistics = item.get("statistics") or []
    team_stats = _new_team_stats()
    if isinstance(statistics, list):
        # API-FOOTBALL istatistikleri takım başına bloklar halinde gelir.
        side_rows = []
        for team_block in statistics[:2]:
            if not isinstance(team_block, dict):
                continue
            values = {}
            for stat in team_block.get("statistics") or []:
                if not isinstance(stat, dict):
                    continue
                values[str(stat.get("type") or "")] = stat.get("value")
            side_rows.append(values)
        if len(side_rows) >= 2:
            keys = set(side_rows[0]) | set(side_rows[1])
            for name in keys:
                _add_team_stat(
                    team_stats,
                    "ALL",
                    name,
                    re.sub(r"[^a-z0-9]", "", _norm(name)),
                    side_rows[0].get(name),
                    side_rows[1].get(name),
                )
    if team_stats.get("ALL"):
        result["team_stats"] = team_stats
        corners = _corners_from_team_stats(team_stats, "ALL")
        if corners:
            result["corners"] = corners
        result["stats_source"] = "API-FOOTBALL"
        logs.append(f"API-FOOTBALL: {len(team_stats['ALL'])} takım istatistiği alındı.")

    events = []
    goals = []
    for row in item.get("events") or []:
        if not isinstance(row, dict):
            continue
        time_info = row.get("time") or {}
        player = row.get("player") or {}
        assist = row.get("assist") or {}
        team = row.get("team") or {}
        event = {
            "minute": time_info.get("elapsed"),
            "extra": time_info.get("extra"),
            "type": row.get("type") or "",
            "detail": row.get("detail") or "",
            "player": player.get("name") or "",
            "assist": assist.get("name") or "",
            "team": team.get("name") or "",
            "comment": row.get("comments") or "",
        }
        events.append(event)
        if _norm(event["type"]) == "goal" or "goal" in _norm(event["detail"]):
            goals.append(event.copy())
    if events:
        result["events"] = events
        result["goals"] = goals
        logs.append(f"API-FOOTBALL: {len(events)} maç olayı alındı.")

    player_stats = {"home": [], "away": []}
    players_blocks = item.get("players") or []
    home_id = str(((item.get("teams") or {}).get("home") or {}).get("id") or "")
    away_id = str(((item.get("teams") or {}).get("away") or {}).get("id") or "")
    for block in players_blocks:
        if not isinstance(block, dict):
            continue
        team = block.get("team") or {}
        team_id = str(team.get("id") or "")
        side = "home" if team_id == home_id else "away" if team_id == away_id else None
        if side is None:
            continue
        for row in block.get("players") or []:
            if not isinstance(row, dict):
                continue
            player = row.get("player") or {}
            raw_stats = (row.get("statistics") or [{}])[0] or {}
            games = raw_stats.get("games") or {}
            shots = raw_stats.get("shots") or {}
            goals_info = raw_stats.get("goals") or {}
            passes = raw_stats.get("passes") or {}
            tackles = raw_stats.get("tackles") or {}
            duels = raw_stats.get("duels") or {}
            cards = raw_stats.get("cards") or {}
            stats = {
                "rating": games.get("rating"),
                "minutesPlayed": games.get("minutes"),
                "goals": goals_info.get("total"),
                "assists": goals_info.get("assists"),
                "shotsTotal": shots.get("total"),
                "shotsOnTarget": shots.get("on"),
                "passesTotal": passes.get("total"),
                "passesAccurate": passes.get("accuracy"),
                "tackles": tackles.get("total"),
                "duelsTotal": duels.get("total"),
                "duelsWon": duels.get("won"),
                "yellowCards": cards.get("yellow"),
                "redCards": cards.get("red"),
                "saves": goals_info.get("saves"),
            }
            player_stats[side].append({
                "name": player.get("name") or "Bilinmeyen",
                "player_id": player.get("id"),
                "image": player.get("photo"),
                "statistics": stats,
            })
    if player_stats["home"] or player_stats["away"]:
        result["player_stats"] = player_stats
        logs.append(
            "API-FOOTBALL: oyuncu maç istatistikleri alındı "
            f"({len(player_stats['home']) + len(player_stats['away'])} oyuncu)."
        )
    return result


def _api_football_find_match(home_team, away_team, target_date, logs):
    token = _api_football_token()
    if not token:
        logs.append(
            "API-FOOTBALL: token yok. Ücretsiz anahtarı API-SPORTS hesabından alıp "
            "proje ana klasörüne api_football_token.txt olarak ekleyebilirsin."
        )
        return None

    logs.append("API-FOOTBALL V3 aranıyor (ücretsiz plan destekli).")
    data, source_url = _api_football_json(
        "fixtures",
        {"date": target_date.isoformat()},
        logs,
    )
    rows = data.get("response") or [] if isinstance(data, dict) else []
    best = None
    best_score = 0.0
    best_direct = True
    for item in rows:
        if not isinstance(item, dict):
            continue
        teams = item.get("teams") or {}
        actual_home = str((teams.get("home") or {}).get("name") or "")
        actual_away = str((teams.get("away") or {}).get("name") or "")
        direct = _team_score(actual_home, home_team) + _team_score(actual_away, away_team)
        reverse = _team_score(actual_home, away_team) + _team_score(actual_away, home_team)
        score = max(direct, reverse)
        if score > best_score:
            best = item
            best_score = score
            best_direct = direct >= reverse

    logs.append(f"API-FOOTBALL: {len(rows)} günlük fixture tarandı.")
    if best is None or best_score < 1.35:
        logs.append("API-FOOTBALL: iki takım için güvenilir eşleşme bulunamadı.")
        return None

    fixture = best.get("fixture") or {}
    teams = best.get("teams") or {}
    goals_data = best.get("goals") or {}
    actual_home = str((teams.get("home") or {}).get("name") or home_team)
    actual_away = str((teams.get("away") or {}).get("name") or away_team)
    home_data = teams.get("home") or {}
    away_data = teams.get("away") or {}
    hs, aws = goals_data.get("home"), goals_data.get("away")
    if not best_direct:
        actual_home, actual_away = actual_away, actual_home
        home_data, away_data = away_data, home_data
        hs, aws = aws, hs

    status_data = fixture.get("status") or {}
    status, status_text = _api_football_status(status_data.get("short"), status_data.get("long"))
    score = None
    if hs is not None and aws is not None:
        score = f"{hs}-{aws}"

    result = {
        "status": status,
        "status_text": status_text,
        "score": score,
        "corners": {"home": 0, "away": 0},
        "source": "API-FOOTBALL",
        "source_url": source_url,
        "matched_home": actual_home,
        "matched_away": actual_away,
        "home_logo": home_data.get("logo"),
        "away_logo": away_data.get("logo"),
        "event_id": fixture.get("id"),
        "sport": "Futbol",
        "team_stats": _new_team_stats(),
        "player_stats": {"home": [], "away": []},
        "events": [],
        "goals": [],
    }

    # Bir fixture id çağrısı olaylar + kadrolar + takım/oyuncu istatistiklerini
    # birlikte döndürebiliyor; böylece ücretsiz 100/gün kotasını koruyoruz.
    if fixture.get("id") and status in {"OK", "LIVE"}:
        try:
            detail_data, detail_url = _api_football_json(
                "fixtures",
                {"id": fixture.get("id")},
                logs,
            )
            detail_rows = detail_data.get("response") or [] if isinstance(detail_data, dict) else []
            if detail_rows:
                result["source_url"] = detail_url
                result = _api_football_extract_detail(detail_rows[0], result, logs)
        except Exception as exc:
            logs.append(f"API-FOOTBALL detayları alınamadı: {type(exc).__name__}: {exc}")

    logs.append(
        f"API-FOOTBALL: BULUNDU -> {actual_home} {score or '-'} {actual_away}."
    )
    return result


def _football_data_status(raw_status):
    status = str(raw_status or "").upper().strip()
    if status == "FINISHED":
        return "OK", "Karşılaşma tamamlandı"
    if status == "POSTPONED":
        return "POSTPONED", "Karşılaşma ertelendi"
    if status == "CANCELLED":
        return "CANCELLED", "Karşılaşma iptal edildi"
    if status in {"SUSPENDED"}:
        return "INTERRUPTED", "Karşılaşma yarıda kesildi"
    if status in {"LIVE", "IN_PLAY", "PAUSED"}:
        return "LIVE", "Karşılaşma canlı"
    return "SCHEDULED", "Karşılaşma henüz başlamadı"


def _football_data_find_match(home_team, away_team, target_date, logs):
    token = _football_data_token()
    if not token:
        logs.append(
            "football-data.org: token yok. Ücretsiz hesabından token alıp proje ana klasörüne "
            "football_data_token.txt olarak ekleyebilirsin."
        )
        return None

    logs.append("football-data.org V4 aranıyor (Free Forever plan destekli).")
    data, source_url = _football_data_json(
        "matches",
        {"dateFrom": target_date.isoformat(), "dateTo": target_date.isoformat()},
        logs,
    )
    rows = data.get("matches") or [] if isinstance(data, dict) else []
    best = None
    best_score = 0.0
    best_direct = True
    for match in rows:
        if not isinstance(match, dict):
            continue
        home = match.get("homeTeam") or {}
        away = match.get("awayTeam") or {}
        actual_home = str(home.get("name") or home.get("shortName") or "")
        actual_away = str(away.get("name") or away.get("shortName") or "")
        direct = _team_score(actual_home, home_team) + _team_score(actual_away, away_team)
        reverse = _team_score(actual_home, away_team) + _team_score(actual_away, home_team)
        score = max(direct, reverse)
        if score > best_score:
            best = match
            best_score = score
            best_direct = direct >= reverse

    logs.append(f"football-data.org: {len(rows)} günlük maç tarandı.")
    if best is None or best_score < 1.35:
        logs.append("football-data.org: ücretsiz kapsamdaki liglerde güvenilir eşleşme bulunamadı.")
        return None

    home = best.get("homeTeam") or {}
    away = best.get("awayTeam") or {}
    actual_home = str(home.get("name") or home_team)
    actual_away = str(away.get("name") or away_team)
    score_info = best.get("score") or {}
    full_time = score_info.get("fullTime") or {}
    hs, aws = full_time.get("home"), full_time.get("away")
    if not best_direct:
        actual_home, actual_away = actual_away, actual_home
        home, away = away, home
        hs, aws = aws, hs

    status, status_text = _football_data_status(best.get("status"))
    score = f"{hs}-{aws}" if hs is not None and aws is not None else None
    result = {
        "status": status,
        "status_text": status_text,
        "score": score,
        "corners": {"home": 0, "away": 0},
        "source": "football-data.org",
        "source_url": source_url,
        "matched_home": actual_home,
        "matched_away": actual_away,
        "home_logo": home.get("crest"),
        "away_logo": away.get("crest"),
        "event_id": best.get("id"),
        "sport": "Futbol",
        "team_stats": _new_team_stats(),
        "player_stats": {"home": [], "away": []},
        "events": [],
        "goals": [],
    }
    logs.append(
        f"football-data.org: BULUNDU -> {actual_home} {score or '-'} {actual_away}."
    )
    return result


# ---------------------------------------------------------------------------
# ESPN BASKETBOL BOXSCORE (oyuncu prop fallback)
# ---------------------------------------------------------------------------

ESPN_BASKETBALL_LEAGUES = ("wnba", "nba", "womens-college-basketball", "mens-college-basketball")

ESPN_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.espn.com/",
}

NBA_HEADERS = {
    **ESPN_HEADERS,
    "Origin": "https://www.nba.com",
    "Referer": "https://www.nba.com/",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
}


def _safe_http_json(url, params=None, headers=None, timeout=12):
    """curl_cffi engellenirse stdlib urllib ile ikinci yol dener."""
    headers = headers or ESPN_HEADERS
    first_error = None
    try:
        return _http_json(url, params=params, headers=headers, timeout=timeout), "curl_cffi/requests"
    except Exception as e:
        first_error = e
    try:
        full = url
        if params:
            full += ("&" if "?" in full else "?") + urllib.parse.urlencode(params)
        req = urllib.request.Request(full, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", "replace")), "urllib"
    except Exception as e2:
        raise RuntimeError(f"ilk={type(first_error).__name__}: {first_error}; urllib={type(e2).__name__}: {e2}")


def _basket_sim(a, b):
    a, b = _basketball_norm(a), _basketball_norm(b)
    if not a or not b: return 0.0
    if a in b or b in a: return .96
    return SequenceMatcher(None, a, b).ratio()


def _espn_date_candidates(target_date):
    # ABD liglerinde kullanıcı tarihi UTC/Türkiye günü olabilir. ESPN scoreboard
    # çoğu zaman yerel ABD maç gününü kullanır; bu nedenle ±1 gün taranır.
    return [target_date, target_date - timedelta(days=1), target_date + timedelta(days=1)]


def _parse_espn_players(summary, home_team, away_team):
    out={"home":[],"away":[]}
    for team_group in ((summary.get("boxscore") or {}).get("players") or []):
        team=team_group.get("team") or {}
        tname=team.get("displayName") or team.get("name") or ""
        side="home" if _basket_sim(home_team,tname)>=_basket_sim(away_team,tname) else "away"
        for block in team_group.get("statistics") or []:
            labels=block.get("labels") or block.get("names") or []
            keys=block.get("keys") or []
            for athlete in block.get("athletes") or []:
                a=athlete.get("athlete") or {}; vals=athlete.get("stats") or []; st={}
                for i,val in enumerate(vals):
                    key=keys[i] if i<len(keys) else (labels[i] if i<len(labels) else f"stat{i}")
                    st[key]=val
                labelmap={str(k).upper():v for k,v in st.items()}
                aliases={"points":["PTS","POINTS"],"rebounds":["REB","REBOUNDS"],"assists":["AST","ASSISTS"],"steals":["STL","STEALS"],"blocks":["BLK","BLOCKS"],"threePointFieldGoalsMade":["3PM","3PT","3-PT"]}
                for canon,opts in aliases.items():
                    for opt in opts:
                        if opt in labelmap: st[canon]=labelmap[opt]; break
                out[side].append({"name":a.get("displayName") or a.get("shortName") or "Bilinmeyen","short_name":a.get("shortName"),"player_id":a.get("id"),"statistics":st})
    return out


def _nba_live_boxscore(game_id, home_team, away_team, logs):
    """NBA/WNBA CDN liveData boxscore. WNBA game id'leri de aynı şemayı kullanır."""
    url=f"https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{game_id}.json"
    try:
        data, engine=_safe_http_json(url, headers=NBA_HEADERS, timeout=12)
        game=(data.get("game") or {})
        out={"home":[],"away":[]}
        for side,key in (("home","homeTeam"),("away","awayTeam")):
            team=game.get(key) or {}
            for pl in team.get("players") or []:
                st=pl.get("statistics") or {}
                if not st: continue
                out[side].append({"name":pl.get("name") or pl.get("nameI") or "Bilinmeyen","short_name":pl.get("nameI"),"player_id":pl.get("personId"),"statistics":{"points":st.get("points"),"rebounds":st.get("reboundsTotal"),"assists":st.get("assists"),"steals":st.get("steals"),"blocks":st.get("blocks"),"threePointFieldGoalsMade":st.get("threePointersMade"),**st}})
        if out["home"] or out["away"]:
            logs.append(f"NBA/WNBA CDN: {len(out['home'])+len(out['away'])} oyuncu boxscore kaydı alındı ({engine}).")
            return out
    except Exception as e:
        logs.append(f"NBA/WNBA CDN boxscore başarısız: {type(e).__name__}: {e}")
    return None


def _nba_stats_find_wnba(home_team, away_team, target_date, logs):
    """WNBA için ESPN'den bağımsız ikinci ücretsiz yol: NBA Stats ScoreboardV3."""
    for day in _espn_date_candidates(target_date):
        params={"GameDate":day.strftime("%Y-%m-%d"),"LeagueID":"10"}
        try:
            data,engine=_safe_http_json("https://stats.nba.com/stats/scoreboardv3",params=params,headers=NBA_HEADERS,timeout=6)
        except Exception as e:
            logs.append(f"NBA Stats WNBA {day:%Y-%m-%d}: alınamadı: {e}")
            continue
        games=((data.get("scoreboard") or {}).get("games") or [])
        logs.append(f"NBA Stats WNBA {day:%Y-%m-%d}: {len(games)} maç taranıyor ({engine}).")
        for g in games:
            ht=g.get("homeTeam") or {}; at=g.get("awayTeam") or {}
            hn=" ".join(x for x in [ht.get("teamCity"),ht.get("teamName")] if x)
            an=" ".join(x for x in [at.get("teamCity"),at.get("teamName")] if x)
            if max(_basket_sim(home_team,hn)+_basket_sim(away_team,an),_basket_sim(home_team,an)+_basket_sim(away_team,hn)) < 1.45: continue
            gid=str(g.get("gameId") or "")
            try: hs=int(ht.get("score")); aws=int(at.get("score"))
            except Exception: continue
            result={"status":"OK","sport":"Basketbol","home":hn,"away":an,"home_score":hs,"away_score":aws,"score":f"{hs}-{aws}","source":"NBA Stats WNBA","source_url":f"https://www.wnba.com/game/{gid}","event_id":gid}
            ps=_nba_live_boxscore(gid,home_team,away_team,logs)
            if ps: result["player_stats"]=ps; result["stats_source"]="NBA/WNBA CDN"
            logs.append(f"NBA Stats WNBA: maç bulundu: {hn} {hs}-{aws} {an}.")
            return result
    return None


def _espn_basketball_boxscore(home_team, away_team, target_date, logs, preferred_event_id=None, preferred_league=None):
    leagues=[preferred_league] if preferred_league else list(ESPN_BASKETBALL_LEAGUES)
    for league in [x for x in leagues if x]:
        for day in _espn_date_candidates(target_date):
            date_key=day.strftime("%Y%m%d")
            try:
                board,engine=_safe_http_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/scoreboard",params={"dates":date_key},headers=ESPN_HEADERS,timeout=6)
            except Exception as e:
                logs.append(f"ESPN {league} {date_key}: program alınamadı: {e}"); continue
            for event in board.get("events",[]) or []:
                comp=(event.get("competitions") or [{}])[0]; competitors=comp.get("competitors") or []
                names=[((c.get("team") or {}).get("displayName") or (c.get("team") or {}).get("name") or "") for c in competitors]
                if len(names)<2: continue
                if preferred_event_id and str(event.get("id"))!=str(preferred_event_id): continue
                if max(_basket_sim(home_team,names[0])+_basket_sim(away_team,names[1]),_basket_sim(home_team,names[1])+_basket_sim(away_team,names[0]))<1.35: continue
                eid=event.get("id")
                try:
                    summary,se=_safe_http_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/summary",params={"event":eid},headers=ESPN_HEADERS,timeout=6)
                    out=_parse_espn_players(summary,home_team,away_team)
                    if out["home"] or out["away"]:
                        logs.append(f"ESPN {league.upper()}: {len(out['home'])+len(out['away'])} oyuncu boxscore kaydı alındı ({se}).")
                        return out,f"ESPN {league.upper()}"
                except Exception as e: logs.append(f"ESPN {league} summary {eid}: {e}")
                # ESPN summary olmazsa aynı event id NBA CDN id'si olmayabilir; yine de denemek zararsız
                cdn=_nba_live_boxscore(str(eid),home_team,away_team,logs)
                if cdn: return cdn,"NBA/WNBA CDN"
    logs.append("ESPN Basketbol: eşleşen oyuncu boxscore'u bulunamadı.")
    return None,None


def _extract_team_logo_url(team_obj):
    """ESPN takım nesnesinden en iyi logo URL'sini döndürür."""
    if not isinstance(team_obj, dict):
        return None

    direct = team_obj.get("logo")
    if isinstance(direct, str) and direct.startswith(("https://", "http://")):
        return direct

    logos = team_obj.get("logos") or []
    if isinstance(logos, list):
        for item in logos:
            if isinstance(item, dict):
                href = item.get("href") or item.get("url")
                if isinstance(href, str) and href.startswith(("https://", "http://")):
                    return href
            elif isinstance(item, str) and item.startswith(("https://", "http://")):
                return item

    return None


def _espn_basketball_find_match(home_team, away_team, target_date, logs):
    logs.append("ESPN Basketbol: W/K kadın etiketi temizleniyor; hedef gün + ABD yerel günü için ±1 gün taranıyor.")
    raw_names = f"{home_team} {away_team}"
    women_hint = bool(re.search(r"[\(\[]\s*(?:w|k)\s*[\)\]]|women|kadın|kadin", raw_names, re.I))
    leagues = ("wnba", "womens-college-basketball") if women_hint else ESPN_BASKETBALL_LEAGUES
    if women_hint:
        logs.append("ESPN Basketbol: kadın etiketi algılandı; erkek NBA/NCAA kaynakları atlandı.")
    for league in leagues:
        for day in _espn_date_candidates(target_date):
            date_key=day.strftime("%Y%m%d")
            try:
                board,engine=_safe_http_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/scoreboard",params={"dates":date_key},headers=ESPN_HEADERS,timeout=6)
            except Exception as e:
                logs.append(f"ESPN {league} {date_key}: HTTP başarısız: {e}"); continue
            events=board.get("events",[]) or []
            logs.append(f"ESPN {league} {date_key}: {len(events)} karşılaşma taranıyor ({engine}).")
            for event in events:
                comp=(event.get("competitions") or [{}])[0]; competitors=comp.get("competitors") or []
                if len(competitors)<2: continue
                by_side={}; names=[]
                for c in competitors:
                    team=c.get("team") or {}; name=team.get("displayName") or team.get("shortDisplayName") or team.get("name") or ""
                    names.append(name); by_side[c.get("homeAway") or ""]=(name,c)
                sd=_basket_sim(home_team,names[0])+_basket_sim(away_team,names[1]); sr=_basket_sim(home_team,names[1])+_basket_sim(away_team,names[0])
                if max(sd,sr)<1.45: continue
                hp=by_side.get("home"); ap=by_side.get("away")
                if not hp or not ap: hp,ap=((names[0],competitors[0]),(names[1],competitors[1])) if sd>=sr else ((names[1],competitors[1]),(names[0],competitors[0]))
                hn,hc=hp; an,ac=ap
                try: hs=int(float(hc.get("score"))); aws=int(float(ac.get("score")))
                except Exception: continue
                completed=bool((((event.get("status") or {}).get("type") or {}).get("completed")))
                if not completed: continue
                eid=event.get("id")
                home_team_obj = hc.get("team") or {}
                away_team_obj = ac.get("team") or {}
                result = {
                    "status": "OK",
                    "sport": "Basketbol",
                    "home": hn,
                    "away": an,
                    "home_score": hs,
                    "away_score": aws,
                    "score": f"{hs}-{aws}",
                    "source": f"ESPN {league.upper()}",
                    "source_url": (
                        "https://www.espn.com/"
                        f"{'wnba' if league == 'wnba' else 'nba' if league == 'nba' else 'college-basketball'}"
                        f"/game/_/gameId/{eid}"
                    ),
                    "event_id": eid,
                    "home_logo_url": _extract_team_logo_url(home_team_obj),
                    "away_logo_url": _extract_team_logo_url(away_team_obj),
                }
                logs.append(f"ESPN {league.upper()}: maç bulundu ({day:%Y-%m-%d}): {hn} {hs}-{aws} {an}.")
                stats,src=_espn_basketball_boxscore(home_team,away_team,target_date,logs,eid,league)
                if stats: result["player_stats"]=stats; result["stats_source"]=src
                return result
    logs.append("ESPN başarısız; WNBA ise NBA Stats ScoreboardV3 yedeği deneniyor.")
    alt=_nba_stats_find_wnba(home_team,away_team,target_date,logs)
    if alt: return alt
    logs.append("ESPN/NBA Stats Basketbol: eşleşen tamamlanmış maç bulunamadı.")
    return None


def _enrich_basketball_player_stats(result, home_team, away_team, target_date, logs):
    if not result or result.get("status")!="OK": return result
    existing=result.get("player_stats") or {}
    if existing.get("home") or existing.get("away"): return result
    # WNBA/NBA id mevcutsa önce doğrudan CDN boxscore dene.
    eid=result.get("event_id")
    if eid:
        stats=_nba_live_boxscore(str(eid),home_team,away_team,logs)
        if stats: result["player_stats"]=stats; result["stats_source"]="NBA/WNBA CDN"; return result
    stats,source=_espn_basketball_boxscore(home_team,away_team,target_date,logs)
    if stats: result["player_stats"]=stats; result["stats_source"]=source
    return result


# ---------------------------------------------------------------------------
# MAÇ DURUMU
# ---------------------------------------------------------------------------

FLASH_STAGE_MAP = {
    "1": ("SCHEDULED", "Maç henüz başlamadı"),
    "2": ("LIVE", "Maç canlı"),
    "3": ("FINISHED", "Maç tamamlandı"),
    "4": ("POSTPONED", "Maç ertelendi"),
    "5": ("CANCELLED", "Maç iptal edildi"),
    "9": ("WALKOVER", "Hükmen sonuç / walkover"),
    "10": ("FINISHED", "Uzatma sonrası tamamlandı"),
    "11": ("FINISHED", "Penaltılar sonrası tamamlandı"),
    "36": ("INTERRUPTED", "Maç yarıda kesildi"),
    "37": ("ABANDONED", "Maç terk edildi"),
    "43": ("DELAYED", "Maç gecikti"),
    "54": ("AWARDED", "Maç hükmen sonuçlandırıldı"),
}

TERMINAL_NON_RESULT_STATUSES = {
    "POSTPONED",
    "CANCELLED",
    "INTERRUPTED",
    "ABANDONED",
    "DELAYED",
    "SCHEDULED",
    "LIVE",
    "WALKOVER",
    "AWARDED",
}


def _safe_int(value):
    try:
        if value is None or str(value).strip() == "":
            return None
        return int(float(str(value).strip()))
    except Exception:
        return None


def _flash_stage_info(code):
    return FLASH_STAGE_MAP.get(
        str(code or "").strip(),
        ("UNKNOWN", f"Bilinmeyen maç durumu (kod={code or '?'})"),
    )


def _build_status_result(
    status,
    status_text,
    source,
    home,
    away,
    target_date,
    event_id=None,
    score=None,
):
    return {
        "status": status,
        "status_text": status_text,
        "score": score,
        "corners": {"home": 0, "away": 0},
        "ht_score": None,
        "ht_corners": None,
        "goals": [],
        "events": [],
        "team_stats": _new_team_stats(),
        "player_stats": {"home": [], "away": []},
        "event_id": event_id,
        "real_date": (
            target_date.strftime("%d.%m.%Y")
            if target_date
            else None
        ),
        "matched_home": home,
        "matched_away": away,
        "source": source,
    }


# ---------------------------------------------------------------------------
# FLASHSCORE PARSER
# ---------------------------------------------------------------------------

def _flash_parse_fields(section: str) -> dict:
    """
    Flashscore feed formatı:
       ~AA÷MATCH_ID¬AD÷TIMESTAMP¬AE÷HOME¬AF÷AWAY¬AG÷4¬AH÷0...
    """
    result = {}

    section = (section or "").lstrip("~")

    for item in section.split("¬"):
        if "÷" not in item:
            continue

        key, value = item.split("÷", 1)
        key = key.strip().lstrip("~")

        if key:
            result[key] = value.strip()

    return result


def _flash_parse_matches(raw: str) -> list:
    matches = []

    # Her "~" genellikle yeni kayıt/blok.
    for section in (raw or "").split("~"):
        fields = _flash_parse_fields(section)

        # AA = maç ID
        if not fields.get("AA"):
            continue

        matches.append(fields)

    return matches


def _flash_parse_stats_feed(raw: str):
    rows = []
    current_period = "ALL"
    current_group = ""
    current_row = None

    def flush():
        nonlocal current_row
        if current_row and current_row.get("name"):
            current_row["period"] = current_period
            current_row["group"] = current_group
            rows.append(current_row)
        current_row = None

    for token in [x.lstrip("~") for x in (raw or "").split("¬") if x]:
        if "÷" not in token:
            continue

        key, value = token.split("÷", 1)
        key = key.strip().lstrip("~")
        value = value.strip()
        value_n = _norm(value)

        if value_n in ("1st half", "first half", "1 half", "ilk yari"):
            flush()
            current_period = "1ST"
            continue
        if value_n in ("2nd half", "second half", "2 half", "ikinci yari"):
            flush()
            current_period = "2ND"
            continue
        if value_n in ("match", "full match", "full time", "overall", "toplam"):
            flush()
            current_period = "ALL"
            continue

        if key == "SF":
            flush()
            current_group = value
        elif key == "SD":
            flush()
            current_row = {"id": value, "name": "", "key": "", "home": "", "away": ""}
        elif key == "SG":
            if current_row is None:
                current_row = {"id": "", "name": "", "key": "", "home": "", "away": ""}
            current_row["name"] = value
        elif key == "SH" and current_row is not None:
            current_row["home"] = value
        elif key == "SI" and current_row is not None:
            current_row["away"] = value

    flush()
    return rows


def _flashscore_team_stats(match_id: str, logs: list):
    stats = _new_team_stats()
    if not match_id:
        return stats

    endpoint = f"df_st_1_{match_id}"

    for base in FLASH_FEED_HOSTS:
        try:
            raw = _http_get(
                f"{base}/{endpoint}",
                headers=FLASH_HEADERS,
                timeout=15,
            ).text
        except Exception:
            continue

        rows = _flash_parse_stats_feed(raw)
        if not rows:
            continue

        for row in rows:
            _add_team_stat(
                stats,
                row.get("period", "ALL"),
                row.get("name", ""),
                row.get("key", ""),
                row.get("home", ""),
                row.get("away", ""),
            )

        count = sum(len(v) for v in stats.values())
        if count:
            logs.append(
                f"Flashscore: {count} gelişmiş istatistik satırı eşleştirildi."
            )
            return stats

    logs.append("Flashscore: Gelişmiş maç istatistikleri alınamadı.")
    return stats


def _flashscore_corners(match_id: str, logs: list, team_stats=None) -> dict:
    team_stats = team_stats or _flashscore_team_stats(match_id, logs)
    return _corners_from_team_stats(team_stats, "ALL") or {"home": 0, "away": 0}



def _flashscore_goal_events(match_id: str, logs: list):
    """
    df_sui_1 özet akışından gol olaylarını best-effort okur.
    Alanlar sitenin iç feed yapısına bağlıdır; okunamaması ana sonucu bozmaz.
    """
    if not match_id:
        return []

    endpoint = f"df_sui_1_{match_id}"

    for base in FLASH_FEED_HOSTS:
        try:
            raw = _http_get(
                f"{base}/{endpoint}",
                headers=FLASH_HEADERS,
                timeout=15,
            ).text
        except Exception:
            continue

        goals = []

        for section in (raw or "").split("~"):
            fields = _flash_parse_fields(section)

            # IA=1 güncel araştırma notlarında goal event.
            event_type = str(fields.get("IA", "")).strip().lower()

            if event_type not in ("1", "goal"):
                continue

            minute_raw = str(fields.get("IB", "")).strip()
            minute_num = None

            minute_match = re.search(r"\d+", minute_raw)
            if minute_match:
                minute_num = int(minute_match.group(0))

            player = (
                fields.get("IF")
                or fields.get("CX")
                or fields.get("PN")
                or ""
            )

            side_raw = _norm(str(fields.get("IK", "")))

            if side_raw in ("1", "home", "h", "ev"):
                side = "home"
            elif side_raw in ("2", "away", "a", "dep"):
                side = "away"
            else:
                side = side_raw or None

            goals.append({
                "minute": minute_num,
                "minute_text": minute_raw or None,
                "team": side,
                "player": player or None,
                "type": "goal",
            })

        if goals:
            logs.append(
                f"Flashscore: {len(goals)} gol olayı ayrıştırıldı."
            )
            return goals

    return []


def _flashscore_half_score(best, home_goals, away_goals):
    """
    Flashscore feed varyasyonlarında BA/BB ilk yarı,
    BC/BD ikinci yarı skorları olarak görülebilir.
    Sadece final skorla matematiksel olarak tutarlıysa kabul edilir.
    Böylece farklı feed şemalarında yanlış HT skoru üretmeyiz.
    """
    hg = _safe_int(home_goals)
    ag = _safe_int(away_goals)

    if hg is None or ag is None:
        return None

    h1 = _safe_int(best.get("BA"))
    a1 = _safe_int(best.get("BB"))
    h2 = _safe_int(best.get("BC"))
    a2 = _safe_int(best.get("BD"))

    if None not in (h1, a1, h2, a2):
        if h1 + h2 == hg and a1 + a2 == ag:
            return f"{h1}-{a1}"

    if h1 is not None and a1 is not None:
        if 0 <= h1 <= hg and 0 <= a1 <= ag:
            # Çok yüksek değerler dakika alanı olabilir; gol skoru olarak reddet.
            if h1 <= 15 and a1 <= 15:
                return f"{h1}-{a1}"

    return None


FLASH_PUBLIC_SPORT_SLUGS = {
    "Futbol": "football",
    "Basketbol": "basketball",
    "Tenis": "tennis",
    "Masa Tenisi": "table-tennis",
    "Voleybol": "volleyball",
    "Plaj Voleybolu": "beach-volleyball",
    "Buz Hokeyi": "hockey",
    "Hentbol": "handball",
    "Futsal": "futsal",
    "Beyzbol": "baseball",
    "Amerikan Futbolu": "american-football",
    "Kriket": "cricket",
    "Badminton": "badminton",
    "Squash": "squash",
    "Padel": "padel",
    "Dart": "darts",
    "Snooker": "snooker",
    "Su Topu": "water-polo",
    "Ragbi Birliği": "rugby-union",
    "Ragbi Ligi": "rugby-league",
    "Avustralya Futbolu": "aussie-rules",
    "Floorball": "floorball",
    "Bandy": "bandy",
    "Minifutbol": "minifootball",
    "MMA / UFC": "mma",
    "Boks": "boxing",
    "E-Spor": "esports",
}


def _flashscore_safe_team_id(value):
    value = str(value or "").strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{5,24}", value):
        return value
    return ""


def _flashscore_url_slug(value):
    value = str(value or "").strip()
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.casefold()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value


def _flashscore_search_fallback_url(event_id, home_team, away_team):
    """Doğrudan canonical link çözülemezse bozuk URL yerine çalışan web araması ver."""
    query = f'site:flashscore.com/match "{event_id}" "{home_team}" "{away_team}"'
    return "https://www.google.com/search?q=" + urllib.parse.quote_plus(query)


def _flashscore_public_match_url(event, sport_name="Futbol", logs=None):
    """Flashscore kullanıcıya açık maç linkini güvenli biçimde döndürür.

    Feed'deki JA/JB/AU/AV katılımcı kimlikleri public URL'deki takım
    kimlikleriyle aynı olmayabildiği için artık bu alanlardan URL
    tahmini YAPILMAZ. Önce Groq Browser Search ile event_id üzerinden
    canonical public URL doğrulanır. Çözülemezse bozuk Flashscore linki
    yerine event_id + takım adlarını içeren çalışan site-arama URL'si
    döndürülür.
    """
    event = event or {}
    event_id = str(event.get("AA") or "").strip()
    home_team = str(event.get("AE") or "").strip()
    away_team = str(event.get("AF") or "").strip()
    log_list = logs if isinstance(logs, list) else []

    if event_id and resolve_flashscore_public_url is not None:
        try:
            resolved = resolve_flashscore_public_url(
                event_id,
                home_team,
                away_team,
                sport_name,
                log_list,
            )
            if resolved:
                return resolved
        except Exception as exc:
            log_list.append(
                f"Flashscore public link resolver hata verdi: {type(exc).__name__}: {exc}"
            )

    # Canonical URL bulunamazsa eski hatalı takım-ID tahminini kesinlikle
    # kullanma. Kullanıcı en azından event ID'yi içeren çalışan arama
    # bağlantısından doğru Flashscore sonucuna ulaşabilsin.
    if event_id:
        log_list.append(
            "Flashscore public link: doğrudan canonical URL çözülemedi; "
            "güvenli site arama bağlantısı kullanılacak."
        )
        return _flashscore_search_fallback_url(event_id, home_team, away_team)

    return "https://www.flashscore.com/"


def _flashscore_find_match(home: str, away: str, target_date, logs: list):
    logs.append("[1/3] Flashscore maç feed'i aranıyor...")

    if not target_date:
        logs.append("Flashscore: Tarih çözümlenemedi.")
        return None

    # Flashscore f_1_DAY_3_en_1 endpoint'indeki DAY mevcut güne göre offset.
    day_offset = (target_date - datetime.now().date()).days

    feed_name = f"f_1_{day_offset}_3_en_1"

    all_matches = None
    used_host = None

    for base in FLASH_FEED_HOSTS:
        url = f"{base}/{feed_name}"

        try:
            r = _http_get(
                url,
                headers=FLASH_HEADERS,
                timeout=20,
            )

            raw = r.text

            if "÷" not in raw or "AA÷" not in raw:
                logs.append(
                    f"Flashscore feed geçersiz/boş cevap verdi: {base}"
                )
                continue

            parsed = _flash_parse_matches(raw)

            if parsed:
                all_matches = parsed
                used_host = base
                break

        except Exception as e:
            logs.append(
                f"Flashscore host başarısız ({base}): "
                f"{type(e).__name__}: {e}"
            )

    if not all_matches:
        logs.append("Flashscore: Günlük maç feed'i alınamadı.")
        return None

    logs.append(
        f"Flashscore: {len(all_matches)} maç taranıyor "
        f"(gün offset={day_offset}, host={used_host})."
    )

    candidates = []

    for ev in all_matches:
        h = ev.get("AE", "")
        a = ev.get("AF", "")

        if not h or not a:
            continue

        hs = _team_score(h, home)
        aws = _team_score(a, away)

        # İki takım ve ev/deplasman yönü birlikte doğrulanmalı.
        if hs < 0.72 or aws < 0.72:
            continue

        exact_bonus = 0.0

        if _norm(h) == _norm(_resolve_name(home)):
            exact_bonus += 1.0

        if _norm(a) == _norm(_resolve_name(away)):
            exact_bonus += 1.0

        candidates.append(
            (
                hs + aws + exact_bonus,
                hs,
                aws,
                ev,
            )
        )

    if not candidates:
        # Debug için en yakın birkaç maçı yaz.
        nearest = []

        for ev in all_matches:
            h = ev.get("AE", "")
            a = ev.get("AF", "")

            if not h or not a:
                continue

            hs = _team_score(h, home)
            aws = _team_score(a, away)
            nearest.append((hs + aws, h, a))

        nearest.sort(key=lambda x: x[0], reverse=True)

        logs.append(
            "Flashscore: Tarihte doğru ev/deplasman eşleşmesi bulunamadı."
        )

        for score, h, a in nearest[:3]:
            logs.append(
                f"Flashscore yakın aday: {h} - {a} "
                f"(toplam eşleşme={score:.3f})"
            )

        return None

    candidates.sort(key=lambda x: x[0], reverse=True)

    best_score, hs_match, aws_match, best = candidates[0]

    # İki aday neredeyse aynıysa yanlış maç döndürme.
    if len(candidates) > 1:
        second_score = candidates[1][0]

        if abs(best_score - second_score) < 0.08:
            logs.append(
                "Flashscore: Birden fazla çok benzer maç adayı bulundu; "
                "güvenlik nedeniyle seçim yapılmadı."
            )
            return None

    match_id = best.get("AA")
    h = best.get("AE", "")
    a = best.get("AF", "")
    home_goals = best.get("AG")
    away_goals = best.get("AH")
    stage_code = best.get("AB", "")

    stage_status, stage_text = _flash_stage_info(stage_code)

    # Ertelenen / iptal / yarıda kalan / canlı / başlamamış maçları
    # "bulunamadı" gibi göstermeyip gerçek durumuyla döndür.
    if stage_status != "FINISHED":
        logs.append(
            f"Flashscore: MAÇ DURUMU -> {h} - {a}: "
            f"{stage_text} (AB={stage_code or '?'})"
        )

        result = _build_status_result(
            stage_status,
            stage_text,
            "Flashscore",
            h,
            a,
            target_date,
            event_id=match_id,
            score=(
                f"{home_goals}-{away_goals}"
                if home_goals is not None and away_goals is not None
                else None
            ),
        )
        result["source_url"] = _flashscore_public_match_url(best, "Futbol", logs)
        result["internal_source_url"] = (
            f"{used_host}/{feed_name}" if used_host and feed_name else None
        )
        return result

    if home_goals is None or away_goals is None:
        logs.append(
            "Flashscore: Maç tamamlandı görünüyor ancak skor alanları boş."
        )
        return None

    # Normal süre marketlerinde uzatma/penaltı toplamını yanlış kullanmamak için
    # period skorları tutarlıysa normal süre skorunu onlardan kur.
    display_home = _safe_int(home_goals)
    display_away = _safe_int(away_goals)

    h1 = _safe_int(best.get("BA"))
    a1 = _safe_int(best.get("BB"))
    h2 = _safe_int(best.get("BC"))
    a2 = _safe_int(best.get("BD"))

    if stage_code in ("10", "11") and None not in (h1, a1, h2, a2):
        display_home = h1 + h2
        display_away = a1 + a2
        logs.append(
            "Flashscore: Uzatma/penaltı maçı; normal süre skoru "
            "yarı skorlarından oluşturuldu."
        )

    team_stats = _flashscore_team_stats(match_id, logs)
    corners = _flashscore_corners(match_id, logs, team_stats)
    ht_corners = _corners_from_team_stats(team_stats, "1ST")

    ht_score = _flashscore_half_score(
        best,
        display_home,
        display_away,
    )
    goals = _flashscore_goal_events(match_id, logs)

    real_date = None

    try:
        if best.get("AD"):
            real_date = datetime.fromtimestamp(
                int(best["AD"])
            ).strftime("%d.%m.%Y")
    except Exception:
        pass

    logs.append(
        f"Flashscore: MAÇ BULUNDU -> "
        f"{h} {display_home}-{display_away} {a} "
        f"(AB={stage_code}, eşleşme={hs_match:.3f}/{aws_match:.3f})"
    )

    return {
        "status": "OK",
        "status_text": stage_text,
        "score": f"{display_home}-{display_away}",
        "corners": corners,
        "ht_score": ht_score,
        "ht_corners": ht_corners,
        "goals": goals,
        "events": goals,
        "team_stats": team_stats,
        "player_stats": {"home": [], "away": []},
        "event_id": match_id,
        "real_date": real_date or target_date.strftime("%d.%m.%Y"),
        "matched_home": h,
        "matched_away": a,
        "source": "Flashscore",
        "source_url": _flashscore_public_match_url(best, "Futbol", logs),
        "internal_source_url": (
            f"{used_host}/{feed_name}"
            if used_host and feed_name
            else None
        ),
    }



# ---------------------------------------------------------------------------
# FLASHSCORE - ÇOKLU SPOR
# ---------------------------------------------------------------------------

def _flashscore_fetch_day_feed(sport_id, target_date, logs):
    """
    Flashscore günlük feed'ini sınırlı ve deterministik şekilde dener.

    Eski sürümde 3 feed biçimi x 3 host x 18 saniye kombinasyonu, özellikle
    EXE ortamında bir sport_id için dakikalarca beklemeye yol açabiliyordu.
    Burada her sport_id için en fazla 3 HTTP denemesi ve 5 saniyelik istek
    timeout'u kullanılır. Bulunamazsa zincirdeki diğer kaynaklara geçilir.
    """
    day_offset = (target_date - datetime.now().date()).days

    feed_names = [
        f"f_{sport_id}_{day_offset}_3_en_1",
        f"f_{sport_id}_{day_offset}_2_en-gb_1",
        f"f_{sport_id}_{day_offset}_3_en-gb_1",
    ]

    # Önce ana host üzerinde en olası biçimleri dene, sonra tek yedek host.
    attempts = [
        (FLASH_FEED_HOSTS[0], feed_names[0]),
        (FLASH_FEED_HOSTS[0], feed_names[1]),
        (FLASH_FEED_HOSTS[1], feed_names[0]),
    ]

    last_error = None

    for base, feed_name in attempts:
        url = f"{base}/{feed_name}"
        try:
            r = _http_get(
                url,
                headers=FLASH_HEADERS,
                timeout=5,
            )
            raw = r.text

            if "AA÷" not in raw or "÷" not in raw:
                continue

            parsed = _flash_parse_matches(raw)
            if parsed:
                return parsed, url, feed_name

        except Exception as e:
            last_error = e

    if last_error:
        logs.append(
            f"Flashscore sport_id={sport_id}: feed alınamadı "
            f"({type(last_error).__name__}); hızlı fallback zincirine geçiliyor."
        )
    else:
        logs.append(
            f"Flashscore sport_id={sport_id}: feed boş/geçersiz; "
            "hızlı fallback zincirine geçiliyor."
        )

    return [], None, None


def _flashscore_pick_multisport_candidate(events, wanted1, wanted2):
    candidates = []

    for ev in events:
        p1 = ev.get("AE", "")
        p2 = ev.get("AF", "")
        if not p1 or not p2:
            continue

        direct_1 = _team_score(p1, wanted1)
        direct_2 = _team_score(p2, wanted2)
        reverse_1 = _team_score(p1, wanted2)
        reverse_2 = _team_score(p2, wanted1)

        direct = direct_1 + direct_2
        reverse = reverse_1 + reverse_2

        if direct >= reverse:
            s1, s2 = direct_1, direct_2
            orientation = "direct"
            total = direct
        else:
            s1, s2 = reverse_2, reverse_1
            orientation = "swapped"
            total = reverse

        # İki katılımcı da ayrı ayrı yeterli eşleşmeli.
        if s1 < 0.66 or s2 < 0.66:
            continue

        candidates.append(
            (total, s1, s2, orientation, ev)
        )

    candidates.sort(key=lambda x: x[0], reverse=True)

    if not candidates:
        return None

    # Aşırı yakın iki aday varsa yanlış maçı seçme.
    if len(candidates) > 1:
        if abs(candidates[0][0] - candidates[1][0]) < 0.05:
            return None

    return candidates[0]


def _flashscore_generic_period_scores(best, orientation):
    """
    Flashscore feed'indeki yaygın periyot çiftlerini ham olarak taşır.
    Bu alanlar spora göre set/periyot/çeyrek anlamına gelebilir.
    """
    pairs = [
        ("BA", "BB"),
        ("BC", "BD"),
        ("BE", "BF"),
        ("BG", "BH"),
        ("BI", "BJ"),
        ("BK", "BL"),
        ("BM", "BN"),
    ]

    result = {}

    for idx, (hk, ak) in enumerate(pairs, 1):
        h = _safe_int(best.get(hk))
        a = _safe_int(best.get(ak))

        if h is None or a is None:
            continue

        if orientation == "swapped":
            h, a = a, h

        result[str(idx)] = {
            "home": h,
            "away": a,
        }

    return result


def _flashscore_find_match_multisport(
    participant1,
    participant2,
    target_date,
    logs,
    sport_name,
    sport_id,
):
    logs.append(
        f"Flashscore çoklu spor: {sport_name} "
        f"(sport_id={sport_id}) aranıyor..."
    )

    events, source_url, feed_name = _flashscore_fetch_day_feed(
        sport_id,
        target_date,
        logs,
    )

    if not events:
        return None

    logs.append(
        f"Flashscore: {len(events)} kayıt taranıyor "
        f"(sport_id={sport_id})."
    )

    picked = _flashscore_pick_multisport_candidate(
        events,
        participant1,
        participant2,
    )

    if not picked:
        logs.append(
            f"Flashscore sport_id={sport_id}: "
            "iki katılımcı birlikte eşleşmedi."
        )
        return None

    total, p1_sim, p2_sim, orientation, best = picked

    src1 = best.get("AE", "")
    src2 = best.get("AF", "")
    raw1 = best.get("AG")
    raw2 = best.get("AH")

    if orientation == "direct":
        matched1, matched2 = src1, src2
        score1, score2 = raw1, raw2
    else:
        matched1, matched2 = src2, src1
        score1, score2 = raw2, raw1

    event_id = best.get("AA")
    stage_code = best.get("AB", "")
    stage_status, stage_text = _flash_stage_info(stage_code)

    current_score = (
        f"{score1}-{score2}"
        if score1 is not None and score2 is not None
        else None
    )

    if stage_status != "FINISHED":
        logs.append(
            f"Flashscore {sport_name}: BULUNDU -> "
            f"{matched1} - {matched2} | {stage_text}"
        )

        result = _build_status_result(
            stage_status,
            stage_text,
            f"Flashscore ({sport_name})",
            matched1,
            matched2,
            target_date,
            event_id=event_id,
            score=current_score,
        )
        result.update({
            "sport": sport_name,
            "source_url": _flashscore_public_match_url(best, sport_name, logs),
            "internal_source_url": source_url,
            "flashscore_sport_id": sport_id,
            "period_scores": _flashscore_generic_period_scores(
                best, orientation
            ),
        })
        return result

    if score1 is None or score2 is None:
        logs.append(
            f"Flashscore {sport_name}: bitmiş karşılaşma bulundu "
            "ama nihai skor alanı boş."
        )
        return None

    # Analyzer integer skoru bekliyor.
    s1 = _safe_int(score1)
    s2 = _safe_int(score2)
    if s1 is None or s2 is None:
        logs.append(
            f"Flashscore {sport_name}: skor sayısal değil "
            f"({score1}-{score2})."
        )
        return None

    period_scores = _flashscore_generic_period_scores(
        best,
        orientation,
    )

    logs.append(
        f"Flashscore {sport_name}: KARŞILAŞMA BULUNDU -> "
        f"{matched1} {s1}-{s2} {matched2} "
        f"(eşleşme={p1_sim:.3f}/{p2_sim:.3f})"
    )

    return {
        "status": "OK",
        "status_text": stage_text,
        "score": f"{s1}-{s2}",
        "corners": {"home": 0, "away": 0},
        "ht_score": None,
        "ht_corners": None,
        "goals": [],
        "events": [],
        "team_stats": _new_team_stats(),
        "player_stats": {"home": [], "away": []},
        "period_scores": period_scores,
        "event_id": event_id,
        "real_date": target_date.strftime("%d.%m.%Y"),
        "matched_home": matched1,
        "matched_away": matched2,
        "source": f"Flashscore ({sport_name})",
        "source_url": _flashscore_public_match_url(best, sport_name, logs),
        "internal_source_url": source_url,
        "flashscore_sport_id": sport_id,
        "sport": sport_name,
    }


def _flashscore_try_sport_config(
    participant1,
    participant2,
    target_date,
    logs,
    sport_name,
    cfg,
):
    """
    Önce doğrulanmış ID, sonra hint ID'ler; gerekirse yalnız o branş için
    tanımlı dar discovery listesi.
    """
    tried = []

    primary = cfg.get("flashscore_id")
    hints = cfg.get("flashscore_hints") or []
    scan_ids = cfg.get("flashscore_scan_ids") or []

    ids = []
    if primary is not None:
        ids.append(int(primary))
    for value in hints:
        if int(value) not in ids:
            ids.append(int(value))

    for sport_id in ids:
        tried.append(sport_id)
        result = _flashscore_find_match_multisport(
            participant1,
            participant2,
            target_date,
            logs,
            sport_name,
            sport_id,
        )
        if result:
            return result

    # Doğrulanmış bir sport ID varsa başka spor ID'lerini taramıyoruz.
    # Böylece basketbol/tenis/baseball gibi branşlarda yanlış veri riski yok.
    if cfg.get("flashscore_verified"):
        return None

    # Doğrulanmamış branşlarda da sınırsız sport_id taraması yapma.
    # Maksimum 2 discovery ID veya yaklaşık 25 saniyelik bütçe sonrası
    # diğer veri kaynaklarına geçilir.
    discovery_started = time.monotonic()
    discovery_count = 0

    for sport_id in scan_ids:
        sport_id = int(sport_id)
        if sport_id in tried:
            continue
        if discovery_count >= 2 or (time.monotonic() - discovery_started) >= 25:
            logs.append(
                f"Flashscore discovery: {sport_name} için hızlı tarama bütçesi "
                "doldu; diğer kaynaklara geçiliyor."
            )
            break

        discovery_count += 1
        result = _flashscore_find_match_multisport(
            participant1,
            participant2,
            target_date,
            logs,
            sport_name,
            sport_id,
        )
        if result:
            logs.append(
                f"Flashscore discovery: {sport_name} için "
                f"çalışan sport_id={sport_id} bulundu."
            )
            return result

    return None


# ---------------------------------------------------------------------------
# TENNIS EXPLORER - TENİS İÇİN EK FALLBACK
# ---------------------------------------------------------------------------

def _strip_html_basic(value):
    value = re.sub(
        r"<script\b.*?</script>",
        " ",
        value or "",
        flags=re.I | re.S,
    )
    value = re.sub(
        r"<style\b.*?</style>",
        " ",
        value,
        flags=re.I | re.S,
    )
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"&nbsp;|&#160;", " ", value)
    value = re.sub(r"&amp;", "&", value)
    return re.sub(r"\s+", " ", value).strip()


def _tennis_explorer_alias(full_name):
    tokens = [x for x in str(full_name or "").strip().split() if x]
    if len(tokens) < 2:
        return str(full_name or "").strip()

    first = tokens[0]
    surname = tokens[-1]
    return f"{surname} {first[0]}."


def _tennis_explorer_find_match(
    participant1,
    participant2,
    target_date,
    logs,
):
    logs.append("Tennis Explorer yedeği aranıyor...")

    day = target_date.strftime("%d")
    month = target_date.strftime("%m")
    year = target_date.strftime("%Y")

    a1 = _tennis_explorer_alias(participant1)
    a2 = _tennis_explorer_alias(participant2)

    urls = [
        (
            "https://www.tennisexplorer.com/results/",
            {"day": day, "month": month, "year": year},
            "results",
        ),
        (
            "https://www.tennisexplorer.com/next/",
            {
                "day": day,
                "month": month,
                "year": year,
                "type": "all",
            },
            "next",
        ),
    ]

    for url, params, kind in urls:
        try:
            r = _http_get(
                url,
                params=params,
                headers={
                    "User-Agent": FLASH_HEADERS["User-Agent"],
                    "Accept": "text/html,application/xhtml+xml,*/*",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer": "https://www.tennisexplorer.com/",
                },
                timeout=18,
            )
        except Exception as e:
            logs.append(
                f"Tennis Explorer erişim hatası: "
                f"{type(e).__name__}: {e}"
            )
            continue

        text = _strip_html_basic(r.text)
        text_n = _norm(text)
        a1_n = _norm(a1)
        a2_n = _norm(a2)

        pos1 = text_n.find(a1_n)
        pos2 = text_n.find(a2_n)

        if pos1 < 0 or pos2 < 0:
            continue

        if abs(pos1 - pos2) > 600:
            continue

        # TennisExplorer burada özellikle bir "bulundu / programlandı" yedeği.
        # Final set skorunu güvenilir çıkaramazsak uydurmuyoruz; Flashscore veya
        # sonraki JSON kaynakları final skor için kullanılmaya devam eder.
        if kind == "next":
            logs.append(
                f"Tennis Explorer: programda bulundu -> "
                f"{a1} - {a2}"
            )
            return {
                "status": "SCHEDULED",
                "status_text": "Tenis karşılaşması programda / henüz final değil",
                "score": None,
                "corners": {"home": 0, "away": 0},
                "ht_score": None,
                "ht_corners": None,
                "goals": [],
                "events": [],
                "team_stats": _new_team_stats(),
                "player_stats": {"home": [], "away": []},
                "period_scores": {},
                "event_id": None,
                "real_date": target_date.strftime("%d.%m.%Y"),
                "matched_home": participant1,
                "matched_away": participant2,
                "source": "Tennis Explorer",
                "source_url": getattr(r, "url", None) or url,
                "sport": "Tenis",
            }

        logs.append(
            "Tennis Explorer sonuç sayfasında iki oyuncu bulundu; "
            "skor ayrıştırması güvenilir olmadığı için sonraki kaynağa geçiliyor."
        )

    return None


# ---------------------------------------------------------------------------
# THESPORTSDB V1 - ÜCRETSİZ ÇOKLU SPOR KAYNAĞI
# ---------------------------------------------------------------------------

SPORTSDB_DEFAULT_KEY = "123"
SPORTSDB_HEADERS = {
    "User-Agent": FLASH_HEADERS["User-Agent"],
    "Accept": "application/json,*/*",
    "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
}
SPORTSDB_CACHE_TTL = 60 * 60
SPORTSDB_MAX_REQUESTS_PER_MINUTE = 27  # Resmî ücretsiz limit 30/dk; güvenlik payı.
_SPORTSDB_CACHE = {}
_SPORTSDB_REQUEST_TIMES = []
_SPORTSDB_LOCK = threading.Lock()


def _sportsdb_api_key():
    """Premium anahtar varsa kullanır, yoksa resmî ücretsiz 123 anahtarına düşer."""
    env = str(os.environ.get("THESPORTSDB_API_KEY") or "").strip()
    if env:
        return env

    candidates = [
        Path(__file__).resolve().parent / "thesportsdb_token.txt",
        Path(__file__).resolve().parent.parent / "thesportsdb_token.txt",
        Path.cwd() / "thesportsdb_token.txt",
    ]
    for path in candidates:
        try:
            if path.exists():
                token = path.read_text(encoding="utf-8").strip().strip('"\'')
                if token:
                    return token
        except OSError:
            continue

    return SPORTSDB_DEFAULT_KEY


def _sportsdb_base():
    return f"https://www.thesportsdb.com/api/v1/json/{_sportsdb_api_key()}"


def _sportsdb_cache_key(endpoint, params):
    pairs = sorted((str(k), str(v)) for k, v in (params or {}).items())
    return endpoint, tuple(pairs)


def _sportsdb_json(endpoint, params=None, logs=None, timeout=16):
    """Rate-limit korumalı ve cache'li V1 JSON çağrısı."""
    params = params or {}
    key = _sportsdb_cache_key(endpoint, params)
    now = time.monotonic()

    with _SPORTSDB_LOCK:
        cached = _SPORTSDB_CACHE.get(key)
        if cached and now - cached[0] <= SPORTSDB_CACHE_TTL:
            return cached[1], "cache"

        _SPORTSDB_REQUEST_TIMES[:] = [
            stamp for stamp in _SPORTSDB_REQUEST_TIMES
            if now - stamp < 60.0
        ]
        if len(_SPORTSDB_REQUEST_TIMES) >= SPORTSDB_MAX_REQUESTS_PER_MINUTE:
            if logs is not None:
                logs.append(
                    "TheSportsDB: ücretsiz 30 istek/dk limitine yaklaşmamak için "
                    "bu sorgudaki ek API çağrıları durduruldu."
                )
            raise RuntimeError("TheSportsDB yerel rate-limit koruması devrede")
        _SPORTSDB_REQUEST_TIMES.append(now)

    url = f"{_sportsdb_base()}/{endpoint}"
    try:
        response = _http_get(
            url,
            params=params,
            headers=SPORTSDB_HEADERS,
            timeout=timeout,
        )
        data = response.json()
    except Exception as exc:
        # 429'da aynı analiz içerisinde tekrar tekrar denemeyi engelle.
        if "429" in str(exc) and logs is not None:
            logs.append(
                "TheSportsDB: HTTP 429 rate-limit. Yaklaşık bir dakika sonra "
                "yeniden denenebilir."
            )
        raise

    with _SPORTSDB_LOCK:
        _SPORTSDB_CACHE[key] = (time.monotonic(), data)
    return data, getattr(response, "url", None) or url


def _sportsdb_status(event):
    status_raw = _norm(event.get("strStatus") or "")

    if "postpon" in status_raw:
        return "POSTPONED", "Karşılaşma ertelendi"
    if "cancel" in status_raw:
        return "CANCELLED", "Karşılaşma iptal edildi"
    if "suspend" in status_raw or "abandon" in status_raw:
        return "INTERRUPTED", "Karşılaşma yarıda kesildi"
    if "live" in status_raw or "progress" in status_raw:
        return "LIVE", "Karşılaşma canlı"

    hs = event.get("intHomeScore")
    aws = event.get("intAwayScore")

    if hs not in (None, "") and aws not in (None, ""):
        return "OK", "Karşılaşma tamamlandı"

    return "SCHEDULED", "Karşılaşma henüz başlamadı / final değil"


def _sportsdb_event_candidates(data):
    events = (
        data.get("event")
        or data.get("events")
        or []
    ) if isinstance(data, dict) else []
    if isinstance(events, dict):
        events = [events]
    return [event for event in events if isinstance(event, dict)]


def _sportsdb_event_match_score(event, participant1, participant2):
    home = event.get("strHomeTeam") or event.get("strPlayer") or ""
    away = event.get("strAwayTeam") or ""
    if home and away:
        direct = _team_score(home, participant1) + _team_score(away, participant2)
        reverse = _team_score(home, participant2) + _team_score(away, participant1)
        return max(direct, reverse), direct >= reverse

    title = event.get("strEvent") or ""
    title_n = _norm(title)
    p1 = _norm(participant1)
    p2 = _norm(participant2)
    if p1 and p2 and p1 in title_n and p2 in title_n:
        return 1.6, True
    return 0.0, True


def _sportsdb_extract_stats(event_id, logs):
    team_stats = _new_team_stats()
    if not event_id:
        return team_stats
    try:
        data, _ = _sportsdb_json(
            "lookupeventstats.php",
            {"id": event_id},
            logs=logs,
        )
    except Exception as exc:
        logs.append(
            f"TheSportsDB event stats alınamadı: {type(exc).__name__}: {exc}"
        )
        return team_stats

    rows = (data or {}).get("eventstats") or []
    if isinstance(rows, dict):
        rows = [rows]
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = row.get("strStat") or ""
        _add_team_stat(
            team_stats,
            "ALL",
            name,
            re.sub(r"[^a-z0-9]", "", _norm(name)),
            row.get("intHome"),
            row.get("intAway"),
        )

    count = len(team_stats.get("ALL") or {})
    if count:
        logs.append(f"TheSportsDB: {count} takım istatistiği alındı.")
    return team_stats


def _sportsdb_extract_timeline(event_id, logs):
    if not event_id:
        return [], []
    try:
        data, _ = _sportsdb_json(
            "lookuptimeline.php",
            {"id": event_id},
            logs=logs,
        )
    except Exception as exc:
        logs.append(
            f"TheSportsDB timeline alınamadı: {type(exc).__name__}: {exc}"
        )
        return [], []

    rows = (data or {}).get("timeline") or []
    if isinstance(rows, dict):
        rows = [rows]
    events = []
    goals = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        timeline_type = str(row.get("strTimeline") or "").strip()
        detail = str(row.get("strTimelineDetail") or "").strip()
        event = {
            "minute": row.get("intTime"),
            "type": timeline_type,
            "detail": detail,
            "player": row.get("strPlayer") or "",
            "assist": row.get("strAssist") or "",
            "team": row.get("strTeam") or "",
            "side": "home" if _norm(row.get("strHome") or "") == "yes" else "away",
            "comment": row.get("strComment") or "",
        }
        events.append(event)
        if "goal" in _norm(timeline_type) or "goal" in _norm(detail):
            goals.append(event.copy())

    if events:
        logs.append(f"TheSportsDB: timeline'dan {len(events)} olay alındı.")
    return events, goals


def _sportsdb_extract_lineup(event_id, logs):
    result = {"home": [], "away": []}
    if not event_id:
        return result
    try:
        data, _ = _sportsdb_json(
            "lookuplineup.php",
            {"id": event_id},
            logs=logs,
        )
    except Exception as exc:
        logs.append(
            f"TheSportsDB kadro alınamadı: {type(exc).__name__}: {exc}"
        )
        return result

    rows = (data or {}).get("lineup") or []
    if isinstance(rows, dict):
        rows = [rows]
    for row in rows:
        if not isinstance(row, dict):
            continue
        side = "home" if _norm(row.get("strHome") or "") == "yes" else "away"
        result[side].append({
            "name": row.get("strPlayer") or "Bilinmeyen",
            "position": row.get("strPosition"),
            "substitute": _norm(row.get("strSubstitute") or "") == "yes",
            "shirt_number": row.get("intSquadNumber"),
            "player_id": row.get("idPlayer"),
            "team": row.get("strTeam"),
            "image": row.get("strCutout") or row.get("strThumb") or row.get("strRender"),
            "statistics": {},
        })

    total = len(result["home"]) + len(result["away"])
    if total:
        logs.append(f"TheSportsDB: kadrodan {total} oyuncu alındı.")
    return result


def _sportsdb_enrich_event_result(result, event, logs):
    event_id = str(event.get("idEvent") or result.get("event_id") or "").strip()
    if not event_id:
        return result

    # Free v1 lookup uçları endpoint başına en fazla 5 kayıt döndürür. Tek maçta
    # yalnızca ihtiyaç duyduğumuz stats/timeline/lineup çağrılarını yapıyoruz.
    team_stats = _sportsdb_extract_stats(event_id, logs)
    if any(team_stats.get(period) for period in ("ALL", "1ST", "2ND")):
        result["team_stats"] = team_stats
        corners = _corners_from_team_stats(team_stats, "ALL")
        if corners:
            result["corners"] = corners
        result["stats_source"] = "TheSportsDB"

    events, goals = _sportsdb_extract_timeline(event_id, logs)
    if events:
        result["events"] = events
    if goals:
        result["goals"] = goals

    lineups = _sportsdb_extract_lineup(event_id, logs)
    if lineups["home"] or lineups["away"]:
        result["player_stats"] = lineups

    return result


def _sportsdb_result_from_event(
    event,
    participant1,
    participant2,
    target_date,
    logs,
    sport_name,
    source_url=None,
):
    match_score, direct = _sportsdb_event_match_score(
        event,
        participant1,
        participant2,
    )
    if match_score < 1.35:
        return None

    home = event.get("strHomeTeam") or event.get("strPlayer") or participant1
    away = event.get("strAwayTeam") or participant2
    if direct:
        matched_home, matched_away = home, away
        hs, aws = event.get("intHomeScore"), event.get("intAwayScore")
        home_logo = (
            event.get("strHomeTeamBadge")
            or event.get("strHomeTeamLogo")
            or event.get("strHomeTeamFanart")
        )
        away_logo = (
            event.get("strAwayTeamBadge")
            or event.get("strAwayTeamLogo")
            or event.get("strAwayTeamFanart")
        )
    else:
        matched_home, matched_away = away, home
        hs, aws = event.get("intAwayScore"), event.get("intHomeScore")
        home_logo = (
            event.get("strAwayTeamBadge")
            or event.get("strAwayTeamLogo")
            or event.get("strAwayTeamFanart")
        )
        away_logo = (
            event.get("strHomeTeamBadge")
            or event.get("strHomeTeamLogo")
            or event.get("strHomeTeamFanart")
        )

    status, status_text = _sportsdb_status(event)
    score = None
    if hs not in (None, "") and aws not in (None, ""):
        try:
            score = f"{int(float(hs))}-{int(float(aws))}"
        except (TypeError, ValueError):
            score = f"{hs}-{aws}"

    result = {
        "status": status,
        "status_text": status_text,
        "score": score,
        "corners": {"home": 0, "away": 0},
        "ht_score": None,
        "ht_corners": None,
        "goals": [],
        "events": [],
        "team_stats": _new_team_stats(),
        "player_stats": {"home": [], "away": []},
        "period_scores": {},
        "event_id": event.get("idEvent"),
        "event_name": event.get("strLeague") or event.get("strEvent"),
        "real_date": event.get("dateEvent") or target_date.strftime("%d.%m.%Y"),
        "matched_home": matched_home,
        "matched_away": matched_away,
        "source": "TheSportsDB",
        "source_url": source_url,
        "home_logo_url": home_logo,
        "away_logo_url": away_logo,
        "sport": sport_name,
        "league": event.get("strLeague"),
        "venue": event.get("strVenue"),
        "time": event.get("strTime") or event.get("strTimestamp"),
    }

    logs.append(
        f"TheSportsDB: BULUNDU -> {matched_home} {score or '-'} "
        f"{matched_away} | {status_text}"
    )

    if status == "OK":
        result = _sportsdb_enrich_event_result(result, event, logs)
    return result


def _sportsdb_find_match(
    participant1,
    participant2,
    target_date,
    logs,
    sport_name,
    sportsdb_sport=None,
):
    logs.append(
        f"TheSportsDB V1 aranıyor (anahtar={('123 ücretsiz' if _sportsdb_api_key() == '123' else 'özel')})."
    )

    date_iso = target_date.strftime("%Y-%m-%d")
    queries = [
        f"{participant1}_vs_{participant2}",
        f"{participant2}_vs_{participant1}",
    ]
    best = None
    best_score = 0.0
    best_url = None

    for query in queries:
        try:
            data, source_url = _sportsdb_json(
                "searchevents.php",
                {"e": query, "d": date_iso},
                logs=logs,
            )
        except Exception as exc:
            logs.append(f"TheSportsDB arama hatası: {type(exc).__name__}: {exc}")
            continue

        for event in _sportsdb_event_candidates(data):
            if sportsdb_sport:
                event_sport = _norm(event.get("strSport") or "")
                wanted_sport = _norm(sportsdb_sport)
                if event_sport and wanted_sport and event_sport != wanted_sport:
                    continue
            score, _ = _sportsdb_event_match_score(event, participant1, participant2)
            if score > best_score:
                best, best_score, best_url = event, score, source_url

        # Free search endpoint tek kayıt döndürdüğü için ilk güçlü eşleşmede
        # reverse sorguya gereksiz istek atmayalım.
        if best is not None and best_score >= 1.65:
            break

    # Search endpoint sonuç vermediyse günlük program küçük bir ek fallback.
    # Ücretsiz katmanda eventsday yalnızca 3 kayıt döndürür, bu yüzden burada
    # "yok" sonucu kesin kanıt değildir.
    if (best is None or best_score < 1.35) and sport_name != "E-Spor":
        params = {"d": date_iso}
        if sportsdb_sport:
            params["s"] = sportsdb_sport
        try:
            data, source_url = _sportsdb_json(
                "eventsday.php",
                params,
                logs=logs,
            )
            events = _sportsdb_event_candidates(data)
            logs.append(
                f"TheSportsDB günlük fallback: {len(events)} kayıt taranıyor "
                "(ücretsiz limit en fazla 3 kayıt)."
            )
            for event in events:
                score, _ = _sportsdb_event_match_score(
                    event,
                    participant1,
                    participant2,
                )
                if score > best_score:
                    best, best_score, best_url = event, score, source_url
        except Exception as exc:
            logs.append(
                f"TheSportsDB günlük fallback hatası: {type(exc).__name__}: {exc}"
            )

    if best is None or best_score < 1.35:
        if sport_name == "E-Spor":
            logs.append(
                "TheSportsDB: E-Spor için yalnız doğrudan event araması kullanıldı; "
                "genel günlük liste yanlış eşleşme riskine karşı atlandı."
            )
        logs.append("TheSportsDB: iki katılımcı için güvenilir eşleşme bulunamadı.")
        return None

    return _sportsdb_result_from_event(
        best,
        participant1,
        participant2,
        target_date,
        logs,
        sport_name,
        source_url=best_url,
    )


def _sportsdb_merge_enrichment(primary, secondary, logs):
    """Birincil kaynak sonucunu bozmadan TheSportsDB detaylarını ekler."""
    if not primary or not secondary:
        return primary

    incoming_stats = secondary.get("team_stats") or _new_team_stats()
    current_stats = primary.get("team_stats") or _new_team_stats()
    added_stats = 0
    for period in ("ALL", "1ST", "2ND"):
        current_stats.setdefault(period, {})
        for key, value in (incoming_stats.get(period) or {}).items():
            if key not in current_stats[period]:
                current_stats[period][key] = value
                added_stats += 1
    primary["team_stats"] = current_stats

    if not primary.get("events") and secondary.get("events"):
        primary["events"] = secondary["events"]
    if not primary.get("goals") and secondary.get("goals"):
        primary["goals"] = secondary["goals"]

    current_players = primary.get("player_stats") or {"home": [], "away": []}
    if not current_players.get("home") and not current_players.get("away"):
        incoming_players = secondary.get("player_stats") or {}
        if incoming_players.get("home") or incoming_players.get("away"):
            primary["player_stats"] = incoming_players

    for key in ("home_logo_url", "away_logo_url", "league", "venue"):
        if not primary.get(key) and secondary.get(key):
            primary[key] = secondary[key]

    if (primary.get("corners") or {}) == {"home": 0, "away": 0}:
        secondary_corners = secondary.get("corners")
        if secondary_corners:
            primary["corners"] = secondary_corners

    if added_stats or secondary.get("events") or secondary.get("player_stats"):
        old = primary.get("stats_source") or primary.get("source") or "Ana kaynak"
        primary["stats_source"] = f"{old} + TheSportsDB"
        logs.append(
            "TheSportsDB: ana kaynak sonucu ek istatistik/kadro/timeline ile zenginleştirildi."
        )
    return primary


def _sportsdb_try_enrich_primary(
    primary,
    participant1,
    participant2,
    target_date,
    logs,
    sport_name,
    sportsdb_sport,
):
    """Ana kaynak bulunduysa TheSportsDB'yi yalnız destekleyici olarak kullanır."""
    if not primary or primary.get("status") != "OK":
        return primary
    try:
        extra = _sportsdb_find_match(
            participant1,
            participant2,
            target_date,
            logs,
            sport_name,
            sportsdb_sport,
        )
    except Exception as exc:
        logs.append(
            f"TheSportsDB zenginleştirme atlandı: {type(exc).__name__}: {exc}"
        )
        return primary
    if extra and extra.get("status") == "OK":
        return _sportsdb_merge_enrichment(primary, extra, logs)
    return primary


# ---------------------------------------------------------------------------
# SOFASCORE
# ---------------------------------------------------------------------------

def _sofa_json(path: str, params=None, logs=None):
    last_error = None

    for base in SOFA_BASES:
        url = f"{base}{path}"

        try:
            data = _http_json(
                url,
                params=params,
                headers=SOFA_HEADERS,
                timeout=20,
            )

            if logs is not None:
                logs.append(f"Sofascore host başarılı: {base}")

            return data

        except Exception as e:
            last_error = e

            if logs is not None:
                logs.append(
                    f"Sofascore host başarısız ({base}): "
                    f"{type(e).__name__}: {e}"
                )

    if last_error:
        raise last_error

    raise RuntimeError("Sofascore host bulunamadı.")


def _sofa_search_team(query: str, logs: list):
    data = _sofa_json(
        "/search/all",
        params={"q": query},
        logs=logs,
    )

    candidates = []

    for item in data.get("results", []):
        entity = item.get("entity", {})

        if item.get("type") != "team":
            continue

        if not entity.get("id"):
            continue

        score = _team_score(
            entity.get("name", ""),
            query,
        )

        candidates.append(
            (
                score,
                entity["id"],
                entity.get("name", ""),
            )
        )

    candidates.sort(key=lambda x: x[0], reverse=True)

    if not candidates or candidates[0][0] < 0.70:
        return None, None

    score, team_id, name = candidates[0]

    logs.append(
        f"Sofascore takım eşleşmesi: {name} "
        f"(ID={team_id}, skor={score:.3f})"
    )

    return team_id, name


def _sofa_team_events(team_id: int, logs: list):
    events = []

    for direction in ("last", "next"):
        for page in range(0, 5):
            try:
                data = _sofa_json(
                    f"/team/{team_id}/events/{direction}/{page}",
                    logs=logs,
                )

                batch = data.get("events", [])

                if not batch:
                    break

                events.extend(batch)

            except Exception:
                break

    # event id ile tekilleştir
    unique = {}

    for ev in events:
        ev_id = ev.get("id")

        if ev_id is not None:
            unique[ev_id] = ev

    return list(unique.values())


def _sofa_extract_match_stats(event_id, logs):
    result = {
        "corners": {"home": 0, "away": 0},
        "ht_corners": None,
        "team_stats": _new_team_stats(),
    }

    try:
        data = _sofa_json(
            f"/event/{event_id}/statistics",
            logs=logs,
        )
    except Exception:
        return result

    for period_obj in data.get("statistics", []) or []:
        period = str(period_obj.get("period", "ALL")).upper()
        if period not in ("ALL", "1ST", "2ND"):
            continue

        for group in period_obj.get("groups", []) or []:
            for item in group.get("statisticsItems", []) or []:
                _add_team_stat(
                    result["team_stats"],
                    period,
                    item.get("name", ""),
                    item.get("key", ""),
                    item.get("home", ""),
                    item.get("away", ""),
                )

    result["corners"] = (
        _corners_from_team_stats(result["team_stats"], "ALL")
        or {"home": 0, "away": 0}
    )
    result["ht_corners"] = _corners_from_team_stats(
        result["team_stats"], "1ST"
    )

    count = sum(len(v) for v in result["team_stats"].values())
    if count:
        logs.append(
            f"Sofascore: {count} takım istatistiği (ALL/1ST/2ND) alındı."
        )
    return result


def _sofa_extract_player_stats(event_id, logs):
    result = {"home": [], "away": []}

    try:
        data = _sofa_json(
            f"/event/{event_id}/lineups",
            logs=logs,
        )
    except Exception:
        return result

    for side in ("home", "away"):
        side_obj = data.get(side) or {}
        for item in side_obj.get("players", []) or []:
            player = item.get("player") or {}
            stats = item.get("statistics") or {}

            result[side].append({
                "name": player.get("name") or player.get("shortName") or "Bilinmeyen",
                "short_name": player.get("shortName"),
                "player_id": player.get("id"),
                "position": player.get("position") or item.get("position"),
                "shirt_number": item.get("shirtNumber") or player.get("jerseyNumber"),
                "substitute": bool(item.get("substitute", False)),
                "captain": bool(item.get("captain", False)),
                "statistics": stats,
            })

    total = len(result["home"]) + len(result["away"])
    if total:
        logs.append(f"Sofascore: {total} oyuncu istatistiği/kadro kaydı alındı.")

    return result



def _sofa_extract_goals(event_id, logs):
    try:
        data = _sofa_json(
            f"/event/{event_id}/incidents",
            logs=logs,
        )
    except Exception:
        return []

    goals = []

    for incident in data.get("incidents", []) or []:
        incident_type = _norm(incident.get("incidentType", ""))

        if incident_type != "goal":
            continue

        player_obj = incident.get("player") or {}
        player = (
            incident.get("playerName")
            or player_obj.get("name")
            or None
        )

        goals.append({
            "minute": incident.get("time"),
            "added_time": incident.get("addedTime"),
            "team": "home" if incident.get("isHome") else "away",
            "player": player,
            "home_score": incident.get("homeScore"),
            "away_score": incident.get("awayScore"),
            "type": "goal",
            "class": incident.get("incidentClass"),
        })

    if goals:
        logs.append(
            f"Sofascore: {len(goals)} gol olayı ayrıştırıldı."
        )

    return goals


def _sofa_find_match(home, away, target_date, logs):
    logs.append("[2/3] Sofascore aranıyor...")

    if not target_date:
        logs.append("Sofascore: Tarih çözümlenemedi.")
        return None

    home_resolved = _resolve_name(home)

    team_id, _ = _sofa_search_team(
        home_resolved,
        logs,
    )

    if not team_id and home_resolved != home:
        team_id, _ = _sofa_search_team(
            home,
            logs,
        )

    if not team_id:
        logs.append("Sofascore: Ev sahibi takım bulunamadı.")
        return None

    events = _sofa_team_events(
        team_id,
        logs,
    )

    candidates = []

    for ev in events:
        h = ev.get("homeTeam", {}).get("name", "")
        a = ev.get("awayTeam", {}).get("name", "")
        ts = ev.get("startTimestamp")

        if not h or not a or not ts:
            continue

        event_date = datetime.fromtimestamp(ts).date()

        if event_date != target_date:
            continue

        hs = _team_score(h, home)
        aws = _team_score(a, away)

        if hs < 0.72 or aws < 0.72:
            continue

        candidates.append(
            (
                hs + aws,
                hs,
                aws,
                ev,
            )
        )

    if not candidates:
        logs.append(
            "Sofascore: Girilen tarihte doğru ev/deplasman "
            "eşleşmesi bulunamadı."
        )
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)

    _, hs_match, aws_match, best = candidates[0]

    status_obj = best.get("status", {}) or {}
    status_type = _norm(status_obj.get("type", ""))
    status_desc = str(
        status_obj.get("description")
        or status_obj.get("type")
        or "Bilinmeyen durum"
    )

    h = best.get("homeTeam", {}).get("name", "")
    a = best.get("awayTeam", {}).get("name", "")
    event_id = best.get("id")

    sofa_status_map = {
        "postponed": ("POSTPONED", "Maç ertelendi"),
        "canceled": ("CANCELLED", "Maç iptal edildi"),
        "cancelled": ("CANCELLED", "Maç iptal edildi"),
        "suspended": ("INTERRUPTED", "Maç yarıda kesildi"),
        "interrupted": ("INTERRUPTED", "Maç yarıda kesildi"),
        "abandoned": ("ABANDONED", "Maç terk edildi"),
        "notstarted": ("SCHEDULED", "Maç henüz başlamadı"),
        "inprogress": ("LIVE", "Maç canlı"),
    }

    if status_type not in ("finished", "ended"):
        mapped_status, mapped_text = sofa_status_map.get(
            status_type,
            ("SCHEDULED", f"Maç final değil: {status_desc}"),
        )

        logs.append(
            f"Sofascore: MAÇ DURUMU -> {h} - {a}: "
            f"{mapped_text} (status={status_type or '?'})"
        )

        current_h = best.get("homeScore", {}).get("current")
        current_a = best.get("awayScore", {}).get("current")

        return _build_status_result(
            mapped_status,
            mapped_text,
            "Sofascore",
            h,
            a,
            target_date,
            event_id=event_id,
            score=(
                f"{current_h}-{current_a}"
                if current_h is not None and current_a is not None
                else None
            ),
        )

    home_score_data = best.get("homeScore", {})
    away_score_data = best.get("awayScore", {})

    # Normal süre varsa onu tercih et.
    home_goals = (
        home_score_data.get("normaltime")
        if home_score_data.get("normaltime") is not None
        else home_score_data.get("current")
    )
    away_goals = (
        away_score_data.get("normaltime")
        if away_score_data.get("normaltime") is not None
        else away_score_data.get("current")
    )

    if home_goals is None or away_goals is None:
        logs.append(
            "Sofascore: Maç bulundu ancak skor alanları boş."
        )
        return None

    stats = _sofa_extract_match_stats(
        event_id,
        logs,
    )
    player_stats = _sofa_extract_player_stats(
        event_id,
        logs,
    )
    goals = _sofa_extract_goals(
        event_id,
        logs,
    )

    ht_home = home_score_data.get("period1")
    ht_away = away_score_data.get("period1")

    ht_score = (
        f"{ht_home}-{ht_away}"
        if ht_home is not None and ht_away is not None
        else None
    )

    logs.append(
        f"Sofascore: MAÇ BULUNDU -> "
        f"{h} {home_goals}-{away_goals} {a} "
        f"(eşleşme={hs_match:.3f}/{aws_match:.3f})"
    )

    return {
        "status": "OK",
        "status_text": "Maç tamamlandı",
        "score": f"{home_goals}-{away_goals}",
        "corners": stats["corners"],
        "ht_score": ht_score,
        "ht_corners": stats["ht_corners"],
        "goals": goals,
        "events": goals,
        "team_stats": stats["team_stats"],
        "player_stats": player_stats,
        "event_id": event_id,
        "real_date": datetime.fromtimestamp(
            best["startTimestamp"]
        ).strftime("%d.%m.%Y"),
        "matched_home": h,
        "matched_away": a,
        "source": "Sofascore",
        "source_url": (
            f"https://www.sofascore.com/api/v1/event/{event_id}"
            if event_id is not None
            else "https://www.sofascore.com/"
        ),
        "home_logo_url": (
            f"https://img.sofascore.com/api/v1/team/{best.get('homeTeam', {}).get('id')}/image"
            if best.get("homeTeam", {}).get("id") is not None
            else None
        ),
        "away_logo_url": (
            f"https://img.sofascore.com/api/v1/team/{best.get('awayTeam', {}).get('id')}/image"
            if best.get("awayTeam", {}).get("id") is not None
            else None
        ),
    }



# ---------------------------------------------------------------------------
# SOFASCORE - ÇOKLU SPOR GÜNLÜK PROGRAM ARAMASI
# ---------------------------------------------------------------------------

def _collect_sofa_events(obj, output):
    if isinstance(obj, dict):
        if (
            obj.get("id") is not None
            and isinstance(obj.get("homeTeam"), dict)
            and isinstance(obj.get("awayTeam"), dict)
        ):
            output.append(obj)

        for value in obj.values():
            _collect_sofa_events(value, output)

    elif isinstance(obj, list):
        for value in obj:
            _collect_sofa_events(value, output)


def _sofa_scheduled_events(sport_slug, target_date, logs):
    date_iso = target_date.strftime("%Y-%m-%d")
    events = []

    # Çoğu spor için standart günlük program endpoint'i.
    try:
        data = _sofa_json(
            f"/sport/{sport_slug}/scheduled-events/{date_iso}",
            logs=logs,
        )
        _collect_sofa_events(data, events)
    except Exception as e:
        logs.append(
            f"Sofascore günlük program endpoint'i başarısız "
            f"({sport_slug}): {type(e).__name__}"
        )

    # Tenis günlük programı bazı sürümlerde scheduled-tournaments ile gelir.
    if not events and sport_slug == "tennis":
        for page in range(1, 7):
            try:
                data = _sofa_json(
                    f"/sport/tennis/scheduled-tournaments/{date_iso}/page/{page}",
                    logs=logs,
                )
                before = len(events)
                _collect_sofa_events(data, events)

                if len(events) == before and page > 1:
                    break
            except Exception:
                break

    unique = {}
    for ev in events:
        ev_id = ev.get("id")
        if ev_id is not None:
            unique[ev_id] = ev

    result = list(unique.values())
    logs.append(
        f"Sofascore: {sport_slug} / {date_iso} için "
        f"{len(result)} karşılaşma taranacak."
    )
    return result


def _sofa_generic_result(best, target_date, logs, sport_name):
    status_obj = best.get("status", {}) or {}
    status_type = _norm(status_obj.get("type", ""))
    status_desc = str(
        status_obj.get("description")
        or status_obj.get("type")
        or "Bilinmeyen durum"
    )

    h = best.get("homeTeam", {}).get("name", "")
    a = best.get("awayTeam", {}).get("name", "")
    event_id = best.get("id")

    sofa_status_map = {
        "postponed": ("POSTPONED", "Karşılaşma ertelendi"),
        "canceled": ("CANCELLED", "Karşılaşma iptal edildi"),
        "cancelled": ("CANCELLED", "Karşılaşma iptal edildi"),
        "suspended": ("INTERRUPTED", "Karşılaşma yarıda kesildi"),
        "interrupted": ("INTERRUPTED", "Karşılaşma yarıda kesildi"),
        "abandoned": ("ABANDONED", "Karşılaşma terk edildi"),
        "notstarted": ("SCHEDULED", "Karşılaşma henüz başlamadı"),
        "inprogress": ("LIVE", "Karşılaşma canlı"),
    }

    if status_type not in ("finished", "ended"):
        mapped_status, mapped_text = sofa_status_map.get(
            status_type,
            ("SCHEDULED", f"Karşılaşma final değil: {status_desc}"),
        )

        current_h = best.get("homeScore", {}).get("current")
        current_a = best.get("awayScore", {}).get("current")

        result = _build_status_result(
            mapped_status,
            mapped_text,
            "Sofascore",
            h,
            a,
            target_date,
            event_id=event_id,
            score=(
                f"{current_h}-{current_a}"
                if current_h is not None and current_a is not None
                else None
            ),
        )
        result["sport"] = sport_name
        return result

    home_score_data = best.get("homeScore", {}) or {}
    away_score_data = best.get("awayScore", {}) or {}

    # Futbol dışı branşlarda "current" genellikle nihai sayı/set/harita skorudur.
    home_score = home_score_data.get("current")
    away_score = away_score_data.get("current")

    if home_score is None or away_score is None:
        home_score = home_score_data.get("display")
        away_score = away_score_data.get("display")

    if home_score is None or away_score is None:
        logs.append(
            f"Sofascore: {sport_name} karşılaşması bulundu ancak nihai skor alanı boş."
        )
        return None

    stats = _sofa_extract_match_stats(event_id, logs)
    player_stats = _sofa_extract_player_stats(event_id, logs)

    period_scores = {}
    for idx in range(1, 8):
        hk = home_score_data.get(f"period{idx}")
        ak = away_score_data.get(f"period{idx}")
        if hk is not None and ak is not None:
            period_scores[str(idx)] = {
                "home": hk,
                "away": ak,
            }

    logs.append(
        f"Sofascore: {sport_name} KARŞILAŞMA BULUNDU -> "
        f"{h} {home_score}-{away_score} {a}"
    )

    return {
        "status": "OK",
        "status_text": "Karşılaşma tamamlandı",
        "score": f"{home_score}-{away_score}",
        "corners": stats.get("corners") or {"home": 0, "away": 0},
        "ht_score": None,
        "ht_corners": None,
        "goals": [],
        "events": [],
        "team_stats": stats.get("team_stats") or _new_team_stats(),
        "player_stats": player_stats,
        "period_scores": period_scores,
        "event_id": event_id,
        "real_date": target_date.strftime("%d.%m.%Y"),
        "matched_home": h,
        "matched_away": a,
        "source": "Sofascore",
        "source_url": (
            f"https://www.sofascore.com/api/v1/event/{event_id}"
            if event_id is not None
            else "https://www.sofascore.com/"
        ),
        "home_logo_url": (
            f"https://img.sofascore.com/api/v1/team/{best.get('homeTeam', {}).get('id')}/image"
            if best.get("homeTeam", {}).get("id") is not None
            else None
        ),
        "away_logo_url": (
            f"https://img.sofascore.com/api/v1/team/{best.get('awayTeam', {}).get('id')}/image"
            if best.get("awayTeam", {}).get("id") is not None
            else None
        ),
        "sport": sport_name,
    }


def _sofa_find_match_by_sport(
    home,
    away,
    target_date,
    logs,
    sport_name,
    sport_slug,
):
    logs.append(f"Sofascore çoklu spor araması: {sport_name} ({sport_slug})")

    if not target_date or not sport_slug:
        return None

    events = _sofa_scheduled_events(
        sport_slug,
        target_date,
        logs,
    )

    candidates = []

    for ev in events:
        h = ev.get("homeTeam", {}).get("name", "")
        a = ev.get("awayTeam", {}).get("name", "")

        if not h or not a:
            continue

        hs = _team_score(h, home)
        aws = _team_score(a, away)

        if hs < 0.66 or aws < 0.66:
            continue

        # Event payload'ında sport slug varsa yanlış branşı ayrıca ele.
        ev_sport = (
            ev.get("tournament", {})
              .get("category", {})
              .get("sport", {})
              .get("slug")
            or ev.get("sport", {}).get("slug")
            or ""
        )

        if ev_sport and _norm(ev_sport) != _norm(sport_slug):
            continue

        candidates.append((hs + aws, hs, aws, ev))

    if not candidates:
        logs.append(
            f"Sofascore: {sport_name} için girilen iki katılımcı eşleşmedi."
        )
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)
    _, hs, aws, best = candidates[0]

    logs.append(
        f"Sofascore eşleşme güveni: {hs:.3f}/{aws:.3f}"
    )

    return _sofa_generic_result(
        best,
        target_date,
        logs,
        sport_name,
    )


# ---------------------------------------------------------------------------
# BETSAPI
# ---------------------------------------------------------------------------

def _get_betsapi_token():
    # 1) Ortam değişkeni
    token = os.getenv("BETSAPI_TOKEN", "").strip()

    if token:
        return token

    # 2) scraper.py yanındaki betsapi_token.txt
    try:
        token_files = [
            Path(__file__).resolve().parents[1] / "betsapi_token.txt",
            Path(__file__).resolve().with_name("betsapi_token.txt"),
        ]
        for token_file in token_files:
            if token_file.exists():
                token = token_file.read_text(encoding="utf-8").strip()
                if token:
                    return token
    except Exception:
        pass

    return ""


def _betsapi_find_match(home, away, target_date, logs, sport_id=1, sport_name='Futbol'):
    logs.append("[3/3] BetsAPI aranıyor...")

    token = _get_betsapi_token()

    if not token:
        logs.append(
            "BetsAPI: Token yok. BETSAPI_TOKEN ortam değişkeni "
            "veya proje ana klasörüne betsapi_token.txt ekleyebilirsin."
        )
        return None

    if not target_date:
        logs.append("BetsAPI: Tarih çözümlenemedi.")
        return None

    params = {
        "token": token,
        "sport_id": sport_id,
        "home": _resolve_name(home),
        "away": _resolve_name(away),
        "time": target_date.strftime("%Y%m%d"),
    }

    data = None

    for base in BETS_BASES:
        try:
            candidate = _http_json(
                f"{base}/v1/events/search",
                params=params,
                headers=BETS_HEADERS,
                timeout=20,
            )

            if str(candidate.get("success", "")) == "1":
                data = candidate
                logs.append(
                    f"BetsAPI host başarılı: {base}"
                )
                break

            logs.append(
                f"BetsAPI başarısız cevap ({base}): "
                f"{candidate.get('error') or candidate.get('error_detail') or 'unknown'}"
            )

        except Exception as e:
            logs.append(
                f"BetsAPI host başarısız ({base}): "
                f"{type(e).__name__}: {e}"
            )

    if not data:
        return None

    results = data.get("results") or []
    candidates = []

    for ev in results:
        h_obj = ev.get("home")
        a_obj = ev.get("away")

        h = (
            h_obj.get("name", "")
            if isinstance(h_obj, dict)
            else str(h_obj or "")
        )

        a = (
            a_obj.get("name", "")
            if isinstance(a_obj, dict)
            else str(a_obj or "")
        )

        hs = _team_score(h, home)
        aws = _team_score(a, away)

        if hs < 0.72 or aws < 0.72:
            continue

        candidates.append(
            (
                hs + aws,
                hs,
                aws,
                ev,
                h,
                a,
            )
        )

    if not candidates:
        logs.append(
            "BetsAPI: Doğru takım eşleşmesi bulunamadı."
        )
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)

    _, hs_match, aws_match, ev, h, a = candidates[0]

    score_value = str(
        ev.get("ss")
        or ev.get("score")
        or ""
    )

    score_match = re.search(
        r"(\d+)\s*[-:]\s*(\d+)",
        score_value,
    )

    if not score_match:
        logs.append(
            "BetsAPI: Maç bulundu fakat final skor alanı boş."
        )
        return None

    home_goals = score_match.group(1)
    away_goals = score_match.group(2)

    logs.append(
        f"BetsAPI: MAÇ BULUNDU -> "
        f"{h} {home_goals}-{away_goals} {a} "
        f"(eşleşme={hs_match:.3f}/{aws_match:.3f})"
    )

    return {
        "status": "OK",
        "score": f"{home_goals}-{away_goals}",
        "corners": {"home": 0, "away": 0},
        "ht_score": None,
        "ht_corners": None,
        "team_stats": _new_team_stats(),
        "player_stats": {"home": [], "away": []},
        "goals": [],
        "events": [],
        "event_id": ev.get("id"),
        "real_date": target_date.strftime("%d.%m.%Y"),
        "matched_home": h,
        "matched_away": a,
        "source": "BetsAPI",
        "source_url": "https://api.b365api.com/v1/events/search",
        "sport": sport_name,
    }


# ---------------------------------------------------------------------------
# ANA FONKSİYON
# ---------------------------------------------------------------------------

def _try_sofascore_web(
    home_team,
    away_team,
    target_date,
    logs,
    sport,
    sofa_slug,
):
    if not find_sofascore_web_match:
        return None

    try:
        result = find_sofascore_web_match(
            home_team,
            away_team,
            target_date,
            logs,
            sport_name=sport,
            sport_slug=sofa_slug,
        )

        if result and (
            result.get("status") == "OK"
            or result.get("status") in TERMINAL_NON_RESULT_STATUSES
        ):
            return result

    except Exception as exc:
        logs.append(
            f"Sofascore Web HATASI: {type(exc).__name__}: {exc}"
        )

    return None



def _merge_missing_real_source_data(primary, secondary, label, logs):
    """Birincil sonucu bozmadan ikinci GERCEK kaynaktaki eksik alanlari ekler."""
    if not isinstance(primary, dict) or not isinstance(secondary, dict):
        return 0
    if secondary.get("status") != "OK":
        return 0
    changed = 0

    for key in ("ht_score", "ht_corners", "goals", "events", "map_scores", "round_score", "home_logo_url", "away_logo_url", "league", "venue"):
        cur = primary.get(key)
        inc = secondary.get(key)
        missing = cur in (None, "", [], {})
        if missing and inc not in (None, "", [], {}):
            primary[key] = inc
            changed += 1

    current_corners = primary.get("corners")
    incoming_corners = secondary.get("corners")
    if isinstance(incoming_corners, dict):
        cur_missing = not isinstance(current_corners, dict) or (
            current_corners.get("home") in (None, "") or current_corners.get("away") in (None, "")
        )
        cur_zero = isinstance(current_corners, dict) and current_corners.get("home") == 0 and current_corners.get("away") == 0
        inc_nonzero = (incoming_corners.get("home") not in (None, 0, "") or incoming_corners.get("away") not in (None, 0, ""))
        if cur_missing or (cur_zero and inc_nonzero):
            primary["corners"] = incoming_corners
            changed += 1

    current_stats = primary.get("team_stats") or _new_team_stats()
    incoming_stats = secondary.get("team_stats") or {}
    if isinstance(incoming_stats, dict):
        for period in ("ALL", "1ST", "2ND"):
            current_stats.setdefault(period, {})
            rows = incoming_stats.get(period) or {}
            if not isinstance(rows, dict):
                continue
            for key, value in rows.items():
                if key not in current_stats[period] or current_stats[period].get(key) in (None, "", "—"):
                    current_stats[period][key] = value
                    changed += 1
        primary["team_stats"] = current_stats

    incoming_periods = secondary.get("period_scores") or {}
    if isinstance(incoming_periods, dict) and incoming_periods:
        current_periods = primary.get("period_scores") or {}
        for key, value in incoming_periods.items():
            if key not in current_periods or current_periods.get(key) in (None, "", {}, []):
                current_periods[key] = value
                changed += 1
        primary["period_scores"] = current_periods

    incoming_players = secondary.get("player_stats") or {}
    current_players = primary.get("player_stats") or {"home": [], "away": []}
    if isinstance(incoming_players, dict):
        for side in ("home", "away"):
            existing_rows = current_players.setdefault(side, [])
            new_rows = incoming_players.get(side) or []
            if not isinstance(new_rows, list):
                continue
            if not existing_rows and new_rows:
                current_players[side] = new_rows
                changed += len(new_rows)
        primary["player_stats"] = current_players

    if changed:
        sources = primary.setdefault("real_enrichment_sources", [])
        if label not in sources:
            sources.append(label)
        old = primary.get("stats_source") or primary.get("source") or "Ana kaynak"
        if label.casefold() not in str(old).casefold():
            primary["stats_source"] = f"{old} + {label}"
        logs.append(f"Gercek kaynak zenginlestirme: {label} eksik alanlara {changed} veri ekledi.")
    else:
        logs.append(f"Gercek kaynak zenginlestirme: {label} eslesmesi bulundu ancak yeni eksik alan eklemedi.")
    return changed


def enrich_match_data_with_all_real_sources(match_data, home_team, away_team, match_date, sport, logs=None):
    """AI'dan ONCE tum uygun gercek kaynaklari eksik veri icin tarar.

    Mevcut dogrulanmis skor/veri ezilmez; yalniz bos alanlar tamamlanir.
    """
    if not isinstance(match_data, dict) or match_data.get("status") != "OK":
        return match_data
    logs = logs if isinstance(logs, list) else match_data.setdefault("debug_logs", [])
    target_date = _parse_date(match_date) if not hasattr(match_date, "year") else match_date
    if not target_date:
        return match_data
    cfg = get_sport_config(sport)
    sofa_slug = cfg.get("sofa_slug")
    bets_id = cfg.get("bets_id")
    primary_source = str(match_data.get("source") or "")
    logs.append("AI oncesi eksik-veri zinciri: uygun TUM gercek spor kaynaklari sirayla kontrol ediliyor...")

    candidates = []
    if sport == "Futbol":
        candidates = [
            ("API-FOOTBALL", lambda: _api_football_find_match(home_team, away_team, target_date, logs)),
            ("TheSportsDB", lambda: _sportsdb_find_match(home_team, away_team, target_date, logs, sport, cfg.get("sportsdb_sport"))),
            ("football-data.org", lambda: _football_data_find_match(home_team, away_team, target_date, logs)),
            ("Sofascore Web", lambda: _try_sofascore_web(home_team, away_team, target_date, logs, sport, sofa_slug)),
            ("Sofascore", lambda: _sofa_find_match(home_team, away_team, target_date, logs)),
        ]
    elif sport == "E-Spor":
        candidates = [
            ("TheSportsDB", lambda: _sportsdb_find_match(home_team, away_team, target_date, logs, sport, cfg.get("sportsdb_sport"))),
            ("Sofascore Web", lambda: _try_sofascore_web(home_team, away_team, target_date, logs, sport, sofa_slug)),
            ("Sofascore", lambda: _sofa_find_match_by_sport(home_team, away_team, target_date, logs, sport, sofa_slug) if sofa_slug else None),
        ]
    else:
        if sport == "Basketbol":
            candidates.append(("ESPN Basketbol", lambda: _espn_basketball_find_match(home_team, away_team, target_date, logs)))
        candidates.extend([
            ("Flashscore", lambda: _flashscore_try_sport_config(home_team, away_team, target_date, logs, sport, cfg)),
            ("Tennis Explorer", lambda: _tennis_explorer_find_match(home_team, away_team, target_date, logs) if sport == "Tenis" else None),
            ("TheSportsDB", lambda: _sportsdb_find_match(home_team, away_team, target_date, logs, sport, cfg.get("sportsdb_sport"))),
            ("Sofascore Web", lambda: _try_sofascore_web(home_team, away_team, target_date, logs, sport, sofa_slug)),
            ("Sofascore", lambda: _sofa_find_match_by_sport(home_team, away_team, target_date, logs, sport, sofa_slug) if sofa_slug else None),
        ])

    if bets_id is not None:
        candidates.append(("BetsAPI", lambda: _betsapi_find_match(home_team, away_team, target_date, logs, sport_id=bets_id, sport_name=sport)))

    for label, getter in candidates:
        if label.casefold() in primary_source.casefold():
            logs.append(f"Gercek kaynak zenginlestirme: {label} zaten ana kaynak; tekrar sorgulanmadi.")
            continue
        try:
            extra = getter()
            if extra and extra.get("status") == "OK":
                _merge_missing_real_source_data(match_data, extra, label, logs)
        except Exception as exc:
            logs.append(f"Gercek kaynak zenginlestirme {label} HATASI: {type(exc).__name__}: {exc}")

    match_data["debug_logs"] = logs
    logs.append("AI oncesi gercek kaynak zenginlestirme zinciri tamamlandi.")
    return match_data


def fetch_flashscore_data_multi_source(
    home_team: str,
    away_team: str,
    match_date: str,
    sport: str = "Futbol",
    bet_choice: str | None = None,
    bet_subchoice: str | None = None,
) -> dict:
    """
    Branş bazlı güvenli kaynak zinciri.

    Futbol:
        Flashscore -> API-FOOTBALL -> TheSportsDB -> football-data.org -> Sofascore -> BetsAPI

    E-Spor:
        PandaScore -> Offstage -> HLTV -> ESportsBattle
        -> TheSportsDB (varsa) -> Sofascore -> BetsAPI

    Diğer sporlar:
        Flashscore Multi-Sport
        -> (Teniste Tennis Explorer)
        -> TheSportsDB
        -> Sofascore
        -> BetsAPI
    """

    logs = []
    cfg = get_sport_config(sport)
    sofa_slug = cfg.get("sofa_slug")
    bets_id = cfg.get("bets_id")

    logs.append(
        "HTTP motoru: "
        + (
            "curl_cffi (Chrome TLS)"
            if HAS_CURL_CFFI
            else "requests"
        )
    )
    logs.append(
        f"Spor='{sport}' | Katılımcı1='{home_team}' "
        f"Katılımcı2='{away_team}' | Tarih='{match_date}'"
    )

    target_date = _parse_date(match_date)

    if not target_date:
        logs.append(
            "HATA: Tarih çözümlenemedi. Örnek format: 01.10.2026"
        )
        return {
            "status": "ERROR",
            "score": None,
            "sport": sport,
            "debug_logs": logs,
        }

    logs.append(f"Tarih parse edildi: {target_date.isoformat()}")

    # ----------------------------------------------------------
    # FUTBOL
    # ----------------------------------------------------------
    if sport == "Futbol":
        logs.append(
            "Futbol kaynak zinciri: Flashscore -> API-FOOTBALL -> "
            "TheSportsDB -> football-data.org -> Sofascore -> BetsAPI"
        )
        try:
            result = _flashscore_find_match(
                home_team,
                away_team,
                target_date,
                logs,
            )

            if result:
                result["sport"] = sport
                result_status = result.get("status")

                if result_status in TERMINAL_NON_RESULT_STATUSES:
                    result["debug_logs"] = logs
                    return result

                if result_status == "OK":
                    result = _sportsdb_try_enrich_primary(
                        result,
                        home_team,
                        away_team,
                        target_date,
                        logs,
                        sport,
                        cfg.get("sportsdb_sport"),
                    )
                    try:
                        extra = _sofa_find_match(
                            home_team,
                            away_team,
                            target_date,
                            logs,
                        )

                        if extra and extra.get("status") == "OK":
                            current = result.get("team_stats") or _new_team_stats()
                            incoming = extra.get("team_stats") or _new_team_stats()

                            for period in ("ALL", "1ST", "2ND"):
                                current.setdefault(period, {})
                                for key, value in incoming.get(period, {}).items():
                                    current[period].setdefault(key, value)

                            result["team_stats"] = current

                            if extra.get("player_stats"):
                                result["player_stats"] = extra["player_stats"]

                            for key in (
                                "ht_score",
                                "ht_corners",
                                "goals",
                                "events",
                            ):
                                if not result.get(key) and extra.get(key):
                                    result[key] = extra[key]

                            result["stats_source"] = "Flashscore + Sofascore"

                    except Exception as enrich_error:
                        logs.append(
                            "Sofascore ek istatistikleri alınamadı; "
                            f"Flashscore sonucu korunuyor "
                            f"({type(enrich_error).__name__})."
                        )

                    result["debug_logs"] = logs
                    return result

        except Exception as e:
            logs.append(
                f"Flashscore HATASI: {type(e).__name__}: {e}"
            )

        try:
            result = _api_football_find_match(
                home_team,
                away_team,
                target_date,
                logs,
            )
            if result and (
                result.get("status") == "OK"
                or result.get("status") in TERMINAL_NON_RESULT_STATUSES
            ):
                result["debug_logs"] = logs
                return result
        except Exception as e:
            logs.append(
                f"API-FOOTBALL Futbol HATASI: {type(e).__name__}: {e}"
            )

        try:
            result = _sportsdb_find_match(
                home_team,
                away_team,
                target_date,
                logs,
                sport,
                cfg.get("sportsdb_sport"),
            )
            if result and (
                result.get("status") == "OK"
                or result.get("status") in TERMINAL_NON_RESULT_STATUSES
            ):
                result["debug_logs"] = logs
                return result
        except Exception as e:
            logs.append(
                f"TheSportsDB {sport} HATASI: {type(e).__name__}: {e}"
            )

        try:
            result = _football_data_find_match(
                home_team,
                away_team,
                target_date,
                logs,
            )
            if result and (
                result.get("status") == "OK"
                or result.get("status") in TERMINAL_NON_RESULT_STATUSES
            ):
                if result.get("status") == "OK":
                    result = _sportsdb_try_enrich_primary(
                        result,
                        home_team,
                        away_team,
                        target_date,
                        logs,
                        sport,
                        cfg.get("sportsdb_sport"),
                    )
                result["debug_logs"] = logs
                return result
        except Exception as e:
            logs.append(
                f"football-data.org Futbol HATASI: {type(e).__name__}: {e}"
            )

        result = _try_sofascore_web(
            home_team,
            away_team,
            target_date,
            logs,
            sport,
            sofa_slug,
        )
        if result:
            result["debug_logs"] = logs
            return result

        try:
            result = _sofa_find_match(
                home_team,
                away_team,
                target_date,
                logs,
            )
            if result:
                result["sport"] = sport
                if (
                    result.get("status") == "OK"
                    or result.get("status") in TERMINAL_NON_RESULT_STATUSES
                ):
                    result["debug_logs"] = logs
                    return result
        except Exception as e:
            logs.append(
                f"Sofascore HATASI: {type(e).__name__}: {e}"
            )

    # ----------------------------------------------------------
    # E-SPOR
    # ----------------------------------------------------------
    elif sport == "E-Spor":
        logs.append(
            "E-Spor özel kaynak zinciri: "
            "PandaScore -> Offstage.gg -> HLTV -> "
            "ESportsBattle -> TheSportsDB -> Sofascore -> BetsAPI"
        )

        if find_esports_match:
            try:
                result = find_esports_match(
                    home_team,
                    away_team,
                    target_date,
                    logs,
                )
                if result and (
                    result.get("status") == "OK"
                    or result.get("status") in TERMINAL_NON_RESULT_STATUSES
                ):
                    if result.get("status") == "OK":
                        result = _sportsdb_try_enrich_primary(
                            result,
                            home_team,
                            away_team,
                            target_date,
                            logs,
                            sport,
                            cfg.get("sportsdb_sport"),
                        )
                    result["debug_logs"] = logs
                    return result
            except Exception as e:
                logs.append(
                    f"E-Spor özel kaynakları HATASI: "
                    f"{type(e).__name__}: {e}"
                )

        try:
            result = _sportsdb_find_match(
                home_team,
                away_team,
                target_date,
                logs,
                sport,
                cfg.get("sportsdb_sport"),
            )
            if result and (
                result.get("status") == "OK"
                or result.get("status") in TERMINAL_NON_RESULT_STATUSES
            ):
                result["debug_logs"] = logs
                return result
        except Exception as e:
            logs.append(
                f"TheSportsDB E-Spor HATASI: {type(e).__name__}: {e}"
            )

        result = _try_sofascore_web(
            home_team,
            away_team,
            target_date,
            logs,
            sport,
            sofa_slug,
        )
        if result:
            result["debug_logs"] = logs
            return result

        if sofa_slug:
            try:
                result = _sofa_find_match_by_sport(
                    home_team,
                    away_team,
                    target_date,
                    logs,
                    sport,
                    sofa_slug,
                )
                if result and (
                    result.get("status") == "OK"
                    or result.get("status") in TERMINAL_NON_RESULT_STATUSES
                ):
                    result["debug_logs"] = logs
                    return result
            except Exception as e:
                logs.append(
                    f"Sofascore {sport} HATASI: "
                    f"{type(e).__name__}: {e}"
                )

    # ----------------------------------------------------------
    # TÜM DİĞER BRANŞLAR
    # ----------------------------------------------------------
    else:
        logs.append(
            "Çoklu spor kaynak zinciri: "
            "Flashscore Multi-Sport"
            + (" -> Tennis Explorer" if sport == "Tenis" else "")
            + " -> TheSportsDB V1 (stats/timeline/lineup) -> Sofascore -> BetsAPI"
        )

        # Basketbolda ESPN'i bağımsız ve erken kaynak olarak dene.
        # Böylece WNBA/NBA maçları Flashscore/Sofascore başarısına bağlı kalmaz.
        if sport == "Basketbol":
            try:
                result = _espn_basketball_find_match(home_team, away_team, target_date, logs)
                if result and result.get("status") == "OK":
                    result = _sportsdb_try_enrich_primary(
                        result,
                        home_team,
                        away_team,
                        target_date,
                        logs,
                        sport,
                        cfg.get("sportsdb_sport"),
                    )
                    result["debug_logs"] = logs
                    return result
            except Exception as e:
                logs.append(f"ESPN Basketbol HATASI: {type(e).__name__}: {e}")

        # 1) Flashscore çoklu spor feed
        try:
            result = _flashscore_try_sport_config(
                home_team,
                away_team,
                target_date,
                logs,
                sport,
                cfg,
            )
            if result and (
                result.get("status") == "OK"
                or result.get("status") in TERMINAL_NON_RESULT_STATUSES
            ):
                if result.get("status") == "OK":
                    result = _sportsdb_try_enrich_primary(
                        result,
                        home_team,
                        away_team,
                        target_date,
                        logs,
                        sport,
                        cfg.get("sportsdb_sport"),
                    )
                if sport == "Basketbol" and result.get("status") == "OK":
                    result = _enrich_basketball_player_stats(result, home_team, away_team, target_date, logs)
                result["debug_logs"] = logs
                return result
        except Exception as e:
            logs.append(
                f"Flashscore {sport} HATASI: "
                f"{type(e).__name__}: {e}"
            )

        # 2) Tennis Explorer sadece tenis için
        if sport == "Tenis":
            try:
                result = _tennis_explorer_find_match(
                    home_team,
                    away_team,
                    target_date,
                    logs,
                )
                if result:
                    result["debug_logs"] = logs
                    return result
            except Exception as e:
                logs.append(
                    f"Tennis Explorer HATASI: "
                    f"{type(e).__name__}: {e}"
                )

        # 3) Ücretsiz generic JSON API
        try:
            result = _sportsdb_find_match(
                home_team,
                away_team,
                target_date,
                logs,
                sport,
                cfg.get("sportsdb_sport"),
            )
            if result and (
                result.get("status") == "OK"
                or result.get("status") in TERMINAL_NON_RESULT_STATUSES
            ):
                if sport == "Basketbol" and result.get("status") == "OK":
                    result = _enrich_basketball_player_stats(result, home_team, away_team, target_date, logs)
                result["debug_logs"] = logs
                return result
        except Exception as e:
            logs.append(
                f"TheSportsDB {sport} HATASI: "
                f"{type(e).__name__}: {e}"
            )

        # 4) Sofascore
        result = _try_sofascore_web(
            home_team,
            away_team,
            target_date,
            logs,
            sport,
            sofa_slug,
        )
        if result:
            result["debug_logs"] = logs
            return result

        if sofa_slug:
            try:
                result = _sofa_find_match_by_sport(
                    home_team,
                    away_team,
                    target_date,
                    logs,
                    sport,
                    sofa_slug,
                )
                if result and (
                    result.get("status") == "OK"
                    or result.get("status") in TERMINAL_NON_RESULT_STATUSES
                ):
                    result["debug_logs"] = logs
                    return result
            except Exception as e:
                logs.append(
                    f"Sofascore {sport} HATASI: "
                    f"{type(e).__name__}: {e}"
                )
        else:
            logs.append(
                f"Sofascore: {sport} için slug tanımlı değil; atlandı."
            )

    # ----------------------------------------------------------
    # BETSAPI - TÜM BRANŞLARDA SON YEDEK
    # ----------------------------------------------------------
    if bets_id is not None:
        try:
            result = _betsapi_find_match(
                home_team,
                away_team,
                target_date,
                logs,
                sport_id=bets_id,
                sport_name=sport,
            )
            if result:
                result["debug_logs"] = logs
                return result
        except Exception as e:
            logs.append(
                f"BetsAPI {sport} HATASI: "
                f"{type(e).__name__}: {e}"
            )
    else:
        logs.append(
            f"BetsAPI: {sport} için sport_id tanımlı değil; atlandı."
        )

    # ----------------------------------------------------------
    # ONLINE SON YEDEKLER — YALNIZ TUM GERCEK KAYNAKLAR BITTIKTEN SONRA
    # Sira: Groq -> Puter -> AI'siz Direct Web parser
    # ----------------------------------------------------------
    best_fallback = None

    def _remember_fallback(candidate):
        nonlocal best_fallback
        if not isinstance(candidate, dict):
            return
        if candidate.get("status") == "OK":
            best_fallback = candidate
            return
        if candidate.get("status") != "AI_FALLBACK":
            return
        try:
            new_conf = float(candidate.get("ai_confidence") or 0)
            old_conf = float((best_fallback or {}).get("ai_confidence") or 0)
        except Exception:
            new_conf, old_conf = 0.0, 0.0
        if best_fallback is None or new_conf > old_conf:
            best_fallback = candidate

    if run_groq_web_fallback is not None:
        logs.append("Son yedek 1/3: Groq Web AI + Browser Search deneniyor...")
        try:
            ai_result = run_groq_web_fallback(
                home_team, away_team, target_date.isoformat(), sport, logs,
                bet_choice=bet_choice, bet_subchoice=bet_subchoice,
            )
            if ai_result and ai_result.get("status") == "OK":
                ai_result["debug_logs"] = logs
                return ai_result
            _remember_fallback(ai_result)
        except Exception as exc:
            logs.append(f"Groq Web AI fallback HATASI: {type(exc).__name__}: {exc}")
    else:
        logs.append("Groq Web AI fallback modulu bulunamadi; Puter'a geciliyor.")

    if run_puter_web_fallback is not None:
        logs.append("Son yedek 2/3: Puter Web AI deneniyor...")
        try:
            ai_result = run_puter_web_fallback(
                home_team, away_team, target_date.isoformat(), sport, logs,
                bet_choice=bet_choice, bet_subchoice=bet_subchoice,
            )
            if ai_result and ai_result.get("status") == "OK":
                ai_result["debug_logs"] = logs
                return ai_result
            _remember_fallback(ai_result)
        except Exception as exc:
            logs.append(f"Puter Web AI fallback HATASI: {type(exc).__name__}: {exc}")
    else:
        logs.append("Puter Web AI fallback modulu bulunamadi; direkt web parser'a geciliyor.")

    if run_direct_web_fallback is not None:
        try:
            web_result = run_direct_web_fallback(
                home_team, away_team, target_date.isoformat(), sport, logs,
                bet_choice=bet_choice, bet_subchoice=bet_subchoice,
            )
            if web_result and web_result.get("status") == "OK":
                web_result["debug_logs"] = logs
                return web_result
            _remember_fallback(web_result)
        except Exception as exc:
            logs.append(f"Direkt web fallback HATASI: {type(exc).__name__}: {exc}")
    else:
        logs.append("Direkt web fallback modulu bulunamadi; atlandi.")

    if best_fallback is not None:
        best_fallback["debug_logs"] = logs
        return best_fallback

    logs.append(f"SONUÇ: {sport} branşında güvenilir karşılaşma bulunamadı.")

    return {
        "status": "ERROR",
        "score": None,
        "sport": sport,
        "debug_logs": logs,
    }
