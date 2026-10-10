"""
sofascore_web.py — V3

Sofascore /api/v1 uçları 403 döndürdüğünde normal Sofascore maç
sayfasını bulup HTML içinden tarih, durum ve temel skoru okur.

V2:
- Arama sorgusunda tarihi zorunlu tutmaz; tarih sayfa açıldıktan sonra doğrulanır.
- Kısa/uzun takım adlarını destekler: Gomerano <-> Deportivo Gomerano,
  Chichicasteco <-> Chichicasteco FC.
- Bing / Google / DuckDuckGo yönlendirme URL'lerini çözer.
- Başarılı H2H URL'lerini yerel cache'e kaydeder.
- Daha önce webden doğrulanmış problemli eşleşmeler için güvenli başlangıç
  URL cache'i bulunur. Sayfadaki hedef tarih yine ayrıca doğrulanır.
"""

import base64
import html
import json
import re
import unicodedata
from pathlib import Path
from difflib import SequenceMatcher
from urllib.parse import unquote, urlparse, parse_qs

try:
    from curl_cffi import requests as http_requests
    HAS_CURL_CFFI = True
except ImportError:
    import requests as http_requests
    HAS_CURL_CFFI = False


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/140.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,tr;q=0.7",
    "Cache-Control": "no-cache",
}


# Bu URL yalnız "eşleşme çifti" için bir başlangıç adresidir.
# Hedef tarih sayfanın içinde doğrulanmadan sonuç KABUL EDİLMEZ.
VERIFIED_PAIR_URLS = {
    "football|chichicasteco|gomerano":
        "https://www.sofascore.com/football/match/"
        "chichicasteco-fc-deportivo-gomerano/tkUisukUi",
}


COMMON_CLUB_WORDS = {
    "fc", "cf", "sc", "ac", "afc", "fk", "bc",
    "club", "deportivo", "deportes", "sporting",
    "atletico", "athletic", "futbol", "football",
}


def _norm(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = html.unescape(value).lower()
    value = re.sub(r"[^a-z0-9\s:/._-]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _similar(a, b):
    return SequenceMatcher(
        None,
        _norm(a),
        _norm(b),
    ).ratio()


def _is_common_club_word(token):
    token = _norm(token)

    if not token:
        return False

    if token in COMMON_CLUB_WORDS:
        return True

    # Örn. "Depotivo" -> "Deportivo"
    return any(
        _similar(token, common) >= 0.86
        for common in COMMON_CLUB_WORDS
        if len(common) >= 5
    )


def _compact_name(value):
    tokens = [
        token for token in _norm(value).split()
        if token and not _is_common_club_word(token)
    ]
    return " ".join(tokens).strip()


def _name_similarity(left, right):
    """
    Kısa/uzun ve hafif hatalı takım adlarını karşılaştırır.
    """
    a = _compact_name(left)
    b = _compact_name(right)

    if not a or not b:
        return 0.0

    if a == b:
        return 1.0

    if a in b or b in a:
        return 0.96

    whole = SequenceMatcher(None, a, b).ratio()

    a_tokens = a.split()
    b_tokens = b.split()
    scores = []

    for ta in a_tokens:
        scores.append(
            max(
                (SequenceMatcher(None, ta, tb).ratio() for tb in b_tokens),
                default=0.0,
            )
        )

    for tb in b_tokens:
        scores.append(
            max(
                (SequenceMatcher(None, tb, ta).ratio() for ta in a_tokens),
                default=0.0,
            )
        )

    token_avg = sum(scores) / len(scores) if scores else 0.0
    return max(whole, token_avg)


def _pair_key(participant1, participant2, sport_slug):
    a = _compact_name(participant1)
    b = _compact_name(participant2)
    sides = sorted([a, b])
    return f"{_norm(sport_slug or 'sport')}|{sides[0]}|{sides[1]}"


def _cache_paths():
    paths = []

    try:
        paths.append(Path.cwd() / "sofascore_url_cache.json")
    except Exception:
        pass

    try:
        paths.append(Path(__file__).resolve().parent / "sofascore_url_cache.json")
    except Exception:
        pass

    unique = []
    for path in paths:
        if path not in unique:
            unique.append(path)
    return unique


def _load_cache():
    cache = dict(VERIFIED_PAIR_URLS)

    for path in _cache_paths():
        try:
            if path.exists():
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    cache.update({
                        str(k): str(v)
                        for k, v in data.items()
                        if k and v
                    })
        except Exception:
            pass

    return cache



def _split_pair_key(key):
    parts = str(key or "").split("|", 2)
    if len(parts) != 3:
        return None
    return parts[0], parts[1], parts[2]


def _find_cached_url(cache, participant1, participant2, sport_slug):
    """
    Exact cache yoksa aynı spor içindeki kayıtları typo-tolerant eşleştirir.
    İki katılımcının da ayrı ayrı güçlü eşleşmesi zorunludur.
    """
    exact_key = _pair_key(participant1, participant2, sport_slug)

    if exact_key in cache:
        return exact_key, cache[exact_key], 1.0

    wanted_sport = _norm(sport_slug or "sport")
    input_a = _compact_name(participant1)
    input_b = _compact_name(participant2)

    best = None

    for key, url in (cache or {}).items():
        parsed = _split_pair_key(key)
        if not parsed:
            continue

        cached_sport, side_a, side_b = parsed

        if _norm(cached_sport) != wanted_sport:
            continue

        d1 = _name_similarity(input_a, side_a)
        d2 = _name_similarity(input_b, side_b)
        r1 = _name_similarity(input_a, side_b)
        r2 = _name_similarity(input_b, side_a)

        if (d1 + d2) >= (r1 + r2):
            low = min(d1, d2)
            avg = (d1 + d2) / 2
        else:
            low = min(r1, r2)
            avg = (r1 + r2) / 2

        if low < 0.78 or avg < 0.84:
            continue

        candidate = (avg, low, key, url)

        if best is None or candidate[:2] > best[:2]:
            best = candidate

    if not best:
        return None, None, 0.0

    avg, low, key, url = best
    return key, url, avg


def _save_cache(key, url):
    if not key or not url:
        return

    # İlk yazılabilir konumu kullan.
    for path in _cache_paths():
        try:
            existing = {}
            if path.exists():
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    existing.update(data)

            existing[str(key)] = str(url)
            path.write_text(
                json.dumps(existing, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return
        except Exception:
            continue


def _strip_html(value):
    value = re.sub(r"<script\b.*?</script>", " ", value or "", flags=re.I | re.S)
    value = re.sub(r"<style\b.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def _http_get(url, params=None, headers=None, timeout=20):
    headers = headers or HEADERS

    if HAS_CURL_CFFI:
        response = http_requests.get(
            url,
            params=params,
            headers=headers,
            timeout=timeout,
            impersonate="chrome",
            allow_redirects=True,
        )
    else:
        response = http_requests.get(
            url,
            params=params,
            headers=headers,
            timeout=timeout,
            allow_redirects=True,
        )

    response.raise_for_status()
    return response


def _decode_bing_u(value):
    """
    Bing redirect:
      ...?u=a1aHR0cHM6Ly93d3cuc29mYXNjb3JlLmNvbS8...
    """
    if not value:
        return None

    value = unquote(str(value))

    if value.startswith("a1"):
        encoded = value[2:]
        try:
            encoded += "=" * (-len(encoded) % 4)
            decoded = base64.urlsafe_b64decode(encoded).decode(
                "utf-8",
                errors="ignore",
            )
            if decoded.startswith("http"):
                return decoded
        except Exception:
            pass

    return None


def _unwrap_redirect(value):
    value = html.unescape(str(value or "")).strip()

    # Birkaç kez URL decode et.
    for _ in range(3):
        decoded = unquote(value)
        if decoded == value:
            break
        value = decoded

    try:
        parsed = urlparse(value)
        qs = parse_qs(parsed.query)

        # DuckDuckGo
        if qs.get("uddg"):
            return unquote(qs["uddg"][0])

        # Google / generic
        for key in ("q", "url"):
            if qs.get(key):
                candidate = unquote(qs[key][0])
                if "sofascore.com/" in candidate:
                    return candidate

        # Bing
        if qs.get("u"):
            candidate = _decode_bing_u(qs["u"][0])
            if candidate:
                return candidate

    except Exception:
        pass

    # Yahoo tarzı /RU=https.../
    match = re.search(r"/RU=(https?[^/]+(?:/[^/]+)*)/RK=", value)
    if match:
        return unquote(match.group(1))

    return value


def _clean_sofa_url(value):
    value = _unwrap_redirect(value)

    # HTML içinde percent-encoded Sofa URL gömülü olabilir.
    if "sofascore.com" not in value.lower():
        decoded = unquote(value)
        if "sofascore.com" in decoded.lower():
            value = decoded

    match = re.search(
        r"https?://(?:www\.)?sofascore\.com/"
        r"(?:[a-z]{2}/)?"
        r"[^\"'<>\s&]*/match/[^\"'<>\s&?#]+",
        value,
        flags=re.I,
    )

    if not match:
        return None

    url = match.group(0).rstrip(").,;")

    # Dil prefixini bırakmak sorun değil; canonical URL olarak çalışır.
    return url


def _extract_links(raw_html):
    links = []
    seen = set()
    raw_html = raw_html or ""

    candidates = []

    # Düz URL
    candidates.extend(
        match.group(0)
        for match in re.finditer(
            r"https?://[^\"'<>\s]+",
            raw_html,
            flags=re.I,
        )
    )

    # href
    candidates.extend(
        match.group(1)
        for match in re.finditer(
            r'href=["\']([^"\']+)["\']',
            raw_html,
            flags=re.I,
        )
    )

    # Percent-encoded doğrudan URL parçaları
    candidates.extend(
        match.group(0)
        for match in re.finditer(
            r"https?%3A%2F%2F[^\"'<>\s&]+",
            raw_html,
            flags=re.I,
        )
    )

    for raw in candidates:
        url = _clean_sofa_url(raw)
        if url and url not in seen:
            seen.add(url)
            links.append(url)

    return links


def _participant_present(text_norm, participant):
    participant_n = _norm(participant)

    if not participant_n:
        return False

    if participant_n in text_norm:
        return True

    compact = _compact_name(participant)

    if compact and compact in text_norm:
        return True

    wanted_tokens = [
        token for token in compact.split()
        if len(token) >= 4
    ]
    page_tokens = [
        token for token in _norm(text_norm).split()
        if len(token) >= 4
    ]

    if not wanted_tokens or not page_tokens:
        return False

    matches = []

    for wanted in wanted_tokens:
        best = max(
            (
                SequenceMatcher(None, wanted, page_token).ratio()
                for page_token in page_tokens
            ),
            default=0.0,
        )
        matches.append(best)

    if len(matches) == 1:
        return matches[0] >= 0.80

    return (
        min(matches) >= 0.76
        and (sum(matches) / len(matches)) >= 0.82
    )



def _date_window(text, target_date, radius=1900):
    """
    Tarih arama sorgusuna zorla eklenmez; sayfa açıldıktan sonra burada
    kesin doğrulanır.
    """
    day = target_date.day
    month = target_date.month
    year = target_date.year

    exact_variants = (
        target_date.strftime("%d/%m/%Y"),
        target_date.strftime("%d.%m.%Y"),
        target_date.strftime("%Y-%m-%d"),
        f"{day}/{month}/{year}",
        f"{day}.{month}.{year}",
    )

    for value in exact_variants:
        pos = text.find(value)
        if pos >= 0:
            return text[max(0, pos-radius): min(len(text), pos+radius)]

    # İngilizce ay adları
    month_names = (
        target_date.strftime("%b"),
        target_date.strftime("%B"),
    )

    for month_name in month_names:
        patterns = (
            rf"\b{day}\s+{re.escape(month_name)}\s+{year}\b",
            rf"\b{re.escape(month_name)}\s+{day},?\s+{year}\b",
        )

        for pattern in patterns:
            match = re.search(pattern, text, flags=re.I)
            if match:
                pos = match.start()
                return text[max(0, pos-radius): min(len(text), pos+radius)]

    return None


def _status(window):
    value = _norm(window)

    # Çok önemli: iptal/erteleme FT skorundan ÖNCE kontrol edilir.
    groups = (
        (("canceled", "cancelled", "cancelado", "cancelada", "iptal edildi"),
         "CANCELLED", "Karşılaşma iptal edildi"),
        (("postponed", "aplazado", "adiado", "ertelendi"),
         "POSTPONED", "Karşılaşma ertelendi"),
        (("abandoned", "abandonado", "terk edildi"),
         "ABANDONED", "Karşılaşma terk edildi"),
        (("interrupted", "suspended", "suspendido", "yarida kesildi"),
         "INTERRUPTED", "Karşılaşma yarıda kesildi"),
    )

    for words, code, status_text in groups:
        if any(_norm(word) in value for word in words):
            return code, status_text

    if re.search(r"\bft\s+\d+\s*[-:]\s*\d+\b", value):
        return "OK", "Karşılaşma tamamlandı"

    if any(x in value for x in ("finished", "finalizado", "match finished")):
        return "OK", "Karşılaşma tamamlandı"

    if any(x in value for x in ("not started", "scheduled", "henüz başlamadı")):
        return "SCHEDULED", "Karşılaşma henüz başlamadı"

    if any(x in value for x in ("live", "in progress")):
        return "LIVE", "Karşılaşma canlı"

    return "SCHEDULED", "Karşılaşma bulundu; final durumu doğrulanamadı"


def _score(window):
    for pattern in (
        r"\bFT\s+(\d{1,3})\s*[-:]\s*(\d{1,3})\b",
        r"\bFinal score\s*[—:-]\s*(\d{1,3})\s*[-:]\s*(\d{1,3})\b",
    ):
        match = re.search(pattern, window or "", flags=re.I)
        if match:
            return f"{int(match.group(1))}-{int(match.group(2))}"

    return None


def _query_variants(participant1, participant2, sport_slug):
    p1 = str(participant1 or "").strip()
    p2 = str(participant2 or "").strip()
    c1 = _compact_name(p1)
    c2 = _compact_name(p2)
    sport = str(sport_slug or "").strip()

    queries = [
        f"site:sofascore.com/{sport}/match {p1} {p2}" if sport else
        f"site:sofascore.com/match {p1} {p2}",

        f"site:sofascore.com {p1} {p2} Sofascore",

        f"site:sofascore.com {c1} {c2} Sofascore",
    ]

    # Ters sıra da aransın.
    queries.append(
        f"site:sofascore.com {p2} {p1} Sofascore"
    )

    result = []
    seen = set()

    for query in queries:
        query = re.sub(r"\s+", " ", query).strip()
        if query and query not in seen:
            seen.add(query)
            result.append(query)

    return result


def _search_pages(participant1, participant2, target_date, sport_slug, logs):
    """
    Tarih burada ARAMA filtresi değildir. Aynı H2H URL farklı sezon/maç
    içerikleriyle tekrar kullanılabildiği için önce eşleşme sayfası bulunur,
    hedef tarih sonra HTML içinde doğrulanır.
    """
    queries = _query_variants(
        participant1,
        participant2,
        sport_slug,
    )

    providers = (
        ("Bing", "https://www.bing.com/search"),
        ("Google", "https://www.google.com/search"),
        ("DuckDuckGo", "https://html.duckduckgo.com/html/"),
    )

    found = []
    seen = set()

    for query in queries:
        for provider_name, provider_url in providers:
            if provider_name == "Bing":
                params = {"q": query, "count": 20}
            elif provider_name == "Google":
                params = {"q": query, "num": 20, "filter": 0}
            else:
                params = {"q": query}

            try:
                response = _http_get(
                    provider_url,
                    params=params,
                    headers={
                        **HEADERS,
                        "Referer": "https://www.google.com/",
                    },
                    timeout=18,
                )

                links = _extract_links(response.text)

                for link in links:
                    if link not in seen:
                        seen.add(link)
                        found.append(link)

                if links:
                    logs.append(
                        f"Sofascore Web: {provider_name} "
                        f"'{query}' -> {len(links)} aday URL."
                    )

            except Exception as exc:
                logs.append(
                    f"Sofascore Web arama ({provider_name}) başarısız: "
                    f"{type(exc).__name__}: {exc}"
                )

        # İlk sorgu bile aday bulduysa gereksiz aramayı azalt.
        if found:
            break

    return found


def _parse_page(
    page_html,
    page_url,
    participant1,
    participant2,
    target_date,
    sport_name,
    logs,
):
    # Önce görünen metin
    text = _strip_html(page_html)
    text_n = _norm(text)

    if not _participant_present(text_n, participant1):
        return None

    if not _participant_present(text_n, participant2):
        return None

    window = _date_window(text, target_date)

    # Tarih yalnız script/SSR JSON içinde ise ham HTML'de de ara.
    if not window:
        raw_decoded = html.unescape(page_html or "")
        raw_window = _date_window(raw_decoded, target_date, radius=3000)
        if raw_window:
            window = _strip_html(raw_window)

    if not window:
        return None

    window_n = _norm(window)

    if not (
        _participant_present(window_n, participant1)
        or _participant_present(window_n, participant2)
    ):
        # Full page üzerinde iki isim zaten doğrulandı.
        # Sofascore SSR'da tarih ve isim blokları uzak kalabildiği için
        # burada sadece tarih doğrulamasını yeterli kabul ediyoruz.
        pass

    status, status_text = _status(window)
    score = _score(window)

    logs.append(
        f"Sofascore Web: BULUNDU -> "
        f"{participant1} {score or '-'} {participant2} | {status_text}"
    )

    return {
        "status": status,
        "status_text": status_text,
        "score": score,
        "corners": {"home": 0, "away": 0},
        "ht_score": None,
        "ht_corners": None,
        "goals": [],
        "events": [],
        "team_stats": {"ALL": {}, "1ST": {}, "2ND": {}},
        "player_stats": {"home": [], "away": []},
        "period_scores": {},
        "event_id": None,
        "real_date": target_date.strftime("%d.%m.%Y"),
        "matched_home": participant1,
        "matched_away": participant2,
        "source": "Sofascore Web",
        "source_url": page_url,
        "sport": sport_name,
    }


def _try_page(
    page_url,
    participant1,
    participant2,
    target_date,
    sport_name,
    logs,
):
    try:
        response = _http_get(
            page_url,
            headers={
                **HEADERS,
                "Referer": "https://www.sofascore.com/",
            },
            timeout=20,
        )

        return _parse_page(
            response.text,
            page_url,
            participant1,
            participant2,
            target_date,
            sport_name,
            logs,
        )

    except Exception as exc:
        logs.append(
            f"Sofascore Web sayfası başarısız ({page_url}): "
            f"{type(exc).__name__}: {exc}"
        )
        return None


def find_sofascore_web_match(
    participant1,
    participant2,
    target_date,
    logs,
    sport_name="Futbol",
    sport_slug="football",
):
    logs.append(
        f"Sofascore Web V2 fallback aranıyor: "
        f"{sport_name} ({sport_slug or '?'})"
    )

    pair_key = _pair_key(
        participant1,
        participant2,
        sport_slug,
    )

    # 1) Önce cache: exact veya typo-tolerant fuzzy eşleşme.
    cache = _load_cache()

    cached_key, cached_url, cache_confidence = _find_cached_url(
        cache,
        participant1,
        participant2,
        sport_slug,
    )

    if cached_url:
        if cached_key == pair_key:
            logs.append(
                "Sofascore Web: kayıtlı eşleşme URL'si exact bulundu."
            )
        else:
            logs.append(
                "Sofascore Web: takım adı yazım/kısaltma farkı "
                f"fuzzy cache ile çözüldü "
                f"(güven={cache_confidence:.3f})."
            )

        logs.append(
            f"Sofascore Web: kayıtlı eşleşme URL'si deneniyor -> "
            f"{cached_url}"
        )

        result = _try_page(
            cached_url,
            participant1,
            participant2,
            target_date,
            sport_name,
            logs,
        )

        if result:
            # Bu yazım varyantını da exact cache'e ekle.
            _save_cache(pair_key, cached_url)
            return result

    # 2) Dinamik arama — tarih query'de yok.
    links = _search_pages(
        participant1,
        participant2,
        target_date,
        sport_slug,
        logs,
    )

    if not links:
        logs.append(
            "Sofascore Web: dinamik aramada aday maç sayfası bulunamadı."
        )
        return None

    for page_url in links[:20]:
        result = _try_page(
            page_url,
            participant1,
            participant2,
            target_date,
            sport_name,
            logs,
        )

        if result:
            _save_cache(pair_key, page_url)
            logs.append(
                "Sofascore Web: eşleşme URL'si sonraki aramalar için "
                "sofascore_url_cache.json dosyasına kaydedildi."
            )
            return result

    logs.append(
        "Sofascore Web: aday sayfalarda hedef tarih doğrulanamadı."
    )
    return None
