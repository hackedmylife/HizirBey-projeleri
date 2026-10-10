"""GroqCloud + Browser Search son-yedek web AI katmanı.

Amaç: Spor veri sağlayıcılarının hiçbiri doğrulanmış sonuç bulamadığında,
kurulum gerektirmeyen çevrimiçi bir LLM ile gerçek web taraması yapmak.

Varsayılan model Groq üzerindeki ``openai/gpt-oss-20b`` modelidir ve
``browser_search`` aracı sunucu tarafında çalışır. Böylece son kullanıcı
bilgisayarında Ollama/model/GPU kurulumu gerekmez.

Güvenlik ilkesi:
- AI yalnızca web taramasından dönen kanıta dayanmalı.
- Otomatik bahis settlement'ı ancak final skor + yeterli güven + kaynak URL
  şartları sağlandığında yapılır.
- Şartlar sağlanmıyorsa yanıt ``AI_FALLBACK`` olarak gösterilir ve bahis
  otomatik kazanmış/kaybetmiş sayılmaz.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
import urllib.parse
import tempfile
from pathlib import Path
from typing import Any

DEFAULT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-20b"


def _module_dir() -> Path:
    return Path(__file__).resolve().parent


def _runtime_dir() -> Path:
    if getattr(sys, "frozen", False):
        try:
            return Path(sys.executable).resolve().parent
        except Exception:
            pass
    return _module_dir()


def _bool_env(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().casefold() not in {
        "0", "false", "no", "off", "kapali", "kapalı"
    }


def _load_config() -> dict[str, Any]:
    config: dict[str, Any] = {
        "enabled": True,
        "endpoint": DEFAULT_ENDPOINT,
        "model": DEFAULT_MODEL,
        "timeout_seconds": 70,
        "max_debug_lines": 35,
        "min_confidence_for_settlement": 0.84,
        "min_sources_for_settlement": 2,
        "min_confidence_for_enrichment": 0.86,
        "min_sources_for_enrichment": 2,
        "max_completion_tokens": 2400,
        "reasoning_effort": "low",
    }

    candidates = [
        Path.cwd() / "groq_web_config.json",
        _runtime_dir() / "groq_web_config.json",
        _module_dir() / "groq_web_config.json",
    ]
    for path in candidates:
        if not path.exists():
            continue
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                config.update(loaded)
                break
        except (OSError, ValueError, TypeError):
            continue

    if "GROQ_WEB_AI_ENABLED" in os.environ:
        config["enabled"] = _bool_env("GROQ_WEB_AI_ENABLED", True)
    if os.environ.get("GROQ_WEB_AI_MODEL"):
        config["model"] = os.environ["GROQ_WEB_AI_MODEL"].strip()
    if os.environ.get("GROQ_WEB_AI_ENDPOINT"):
        config["endpoint"] = os.environ["GROQ_WEB_AI_ENDPOINT"].strip()

    endpoint = str(config.get("endpoint") or DEFAULT_ENDPOINT).strip()
    if not endpoint.startswith("https://"):
        endpoint = DEFAULT_ENDPOINT
    config["endpoint"] = endpoint

    model = str(config.get("model") or DEFAULT_MODEL).strip()
    config["model"] = model or DEFAULT_MODEL

    try:
        config["timeout_seconds"] = max(
            15, min(180, int(config.get("timeout_seconds", 70)))
        )
    except (TypeError, ValueError):
        config["timeout_seconds"] = 70

    try:
        config["max_debug_lines"] = max(
            10, min(80, int(config.get("max_debug_lines", 35)))
        )
    except (TypeError, ValueError):
        config["max_debug_lines"] = 35

    try:
        config["min_confidence_for_settlement"] = max(
            0.50,
            min(0.99, float(config.get("min_confidence_for_settlement", 0.84))),
        )
    except (TypeError, ValueError):
        config["min_confidence_for_settlement"] = 0.84

    try:
        config["min_sources_for_settlement"] = max(
            1, min(3, int(config.get("min_sources_for_settlement", 2)))
        )
    except (TypeError, ValueError):
        config["min_sources_for_settlement"] = 2

    try:
        config["min_confidence_for_enrichment"] = max(
            0.50,
            min(0.99, float(config.get("min_confidence_for_enrichment", 0.86))),
        )
    except (TypeError, ValueError):
        config["min_confidence_for_enrichment"] = 0.86

    try:
        config["min_sources_for_enrichment"] = max(
            1, min(3, int(config.get("min_sources_for_enrichment", 2)))
        )
    except (TypeError, ValueError):
        config["min_sources_for_enrichment"] = 2

    try:
        config["max_completion_tokens"] = max(
            700, min(3500, int(config.get("max_completion_tokens", 1800)))
        )
    except (TypeError, ValueError):
        config["max_completion_tokens"] = 1800

    effort = str(config.get("reasoning_effort") or "low").strip().casefold()
    if effort not in {"low", "medium", "high"}:
        effort = "low"
    config["reasoning_effort"] = effort
    config["enabled"] = bool(config.get("enabled", True))
    return config


def _candidate_key_dirs() -> list[Path]:
    """Groq anahtarı için kaynak/EXE/PyInstaller ve kullanıcı dizinlerini tara."""
    candidates: list[Path] = []

    def add(path: Path | str | None) -> None:
        if not path:
            return
        try:
            resolved = Path(path).expanduser().resolve()
        except Exception:
            try:
                resolved = Path(path).expanduser()
            except Exception:
                return
        if resolved not in candidates:
            candidates.append(resolved)

    cwd = Path.cwd()
    runtime = _runtime_dir()
    module = _module_dir()

    add(cwd)
    add(cwd / "project")
    add(runtime)
    add(runtime / "project")
    add(runtime.parent)
    add(runtime.parent / "project")
    add(module)
    add(module / "project")
    add(module.parent)
    add(module.parent / "project")

    # PyInstaller one-file çalışma dizini. Anahtar burada olmak zorunda değil ama
    # config/data dosyalarıyla aynı yerde bırakılmışsa yine bulabilsin.
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        add(Path(meipass))
        add(Path(meipass) / "project")

    # Kullanıcı kalıcı ayar klasörleri.
    for env_name in ("LOCALAPPDATA", "APPDATA"):
        root = os.environ.get(env_name)
        if root:
            add(Path(root) / "HizirBeySports")
            add(Path(root) / "HizirBeySports" / "project")

    # Kullanıcının home klasörü son güvenli fallback.
    try:
        add(Path.home() / ".hizirbey_sports")
    except Exception:
        pass

    return candidates


def _clean_api_key_text(raw: str) -> str:
    """TXT/env/KEY=VALUE/JSON biçimlerinden yalnız anahtar değerini çıkar."""
    if not raw:
        return ""

    text = str(raw).replace("\ufeff", "").strip()
    if not text:
        return ""

    # JSON ile saklayan kullanıcıları da kabul et.
    if text.startswith("{"):
        try:
            payload = json.loads(text)
            if isinstance(payload, dict):
                for key_name in ("GROQ_API_KEY", "groq_api_key", "api_key", "key"):
                    value = payload.get(key_name)
                    if value:
                        text = str(value).strip()
                        break
        except Exception:
            pass

    # İlk gerçek satırı kullan. Yorum ve boş satırları atla.
    lines = [line.strip() for line in text.splitlines()]
    line = next((line for line in lines if line and not line.startswith(("#", ";"))), "")
    if not line:
        return ""

    # GROQ_API_KEY=gsk_... veya export GROQ_API_KEY=... biçimi.
    line = re.sub(r"^\s*export\s+", "", line, flags=re.I)
    if "=" in line:
        left, right = line.split("=", 1)
        if left.strip().upper() in {"GROQ_API_KEY", "GROQ_KEY", "API_KEY"}:
            line = right.strip()

    # Authorization satırı gibi yapıştırılmışsa Bearer önekini temizle.
    line = re.sub(r"^Bearer\s+", "", line, flags=re.I)
    line = line.strip().strip('"\'').strip()

    # Paket içindeki açıklama/placeholder yanlışlıkla anahtar sayılmasın.
    lowered = line.casefold()
    placeholders = (
        "buraya", "your_api", "your-api", "api key here", "api_key_here",
        "groq api key", "groq_api_key=", "example", "örnek", "ornek",
    )
    if any(token in lowered for token in placeholders):
        return ""
    return line


def _read_api_key(return_source: bool = False):
    """Groq API anahtarını çoklu konumdan güvenli biçimde oku.

    ``return_source=True`` yalnız debug amacıyla anahtarın bulunduğu konumu döndürür;
    anahtarın kendisi hiçbir zaman loglanmamalıdır.
    """
    env_value = _clean_api_key_text(str(os.environ.get("GROQ_API_KEY") or ""))
    if env_value:
        return (env_value, "GROQ_API_KEY ortam değişkeni") if return_source else env_value

    filenames = (
        "groq_api_key.txt",
        "groq_api_key.txt.txt",  # Windows gizli uzantı kaynaklı yaygın hata
        "groq_token.txt",
        "groq_key.txt",
        "groq-api-key.txt",
        "grok_api_key.txt",      # yaygın yazım hatası
    )

    checked: set[str] = set()
    for base in _candidate_key_dirs():
        paths: list[Path] = [base / name for name in filenames]

        # Kullanıcının dosya adını küçükçe değiştirdiği durumlar.
        try:
            for pattern in ("groq*key*.txt", "grok*key*.txt"):
                paths.extend(sorted(base.glob(pattern)))
        except OSError:
            pass

        for path in paths:
            marker = str(path)
            if marker in checked:
                continue
            checked.add(marker)
            try:
                if not path.is_file():
                    continue
                raw = path.read_text(encoding="utf-8-sig", errors="replace")
                value = _clean_api_key_text(raw)
                if value:
                    source = str(path)
                    return (value, source) if return_source else value
            except OSError:
                continue

    return ("", "") if return_source else ""


def _api_key_missing_hint() -> str:
    """Anahtar bulunamadığında anahtarı ifşa etmeden kısa konum özeti üret."""
    dirs = _candidate_key_dirs()
    preview = []
    for base in dirs[:6]:
        preview.append(str(base / "groq_api_key.txt"))
    if not preview:
        return ""
    return " | Aranan örnek konumlar: " + " ; ".join(preview)


def _http_json(
    url: str,
    *,
    api_key: str,
    payload: dict[str, Any],
    timeout: int,
) -> dict[str, Any]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "HizirBeySportsAnalyzer/36",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read(8 * 1024 * 1024)
    parsed = json.loads(raw.decode("utf-8", "replace"))
    return parsed if isinstance(parsed, dict) else {}


def _extract_json_object(text: str) -> dict[str, Any] | None:
    clean = str(text or "").strip()
    marker = re.search(
        r"FINAL_JSON_BEGIN\s*(\{.*?\})\s*FINAL_JSON_END",
        clean,
        flags=re.I | re.S,
    )
    if marker:
        try:
            value = json.loads(marker.group(1))
            if isinstance(value, dict):
                return value
        except ValueError:
            pass

    # Browser-search yanıtlarında arama parçaları JSON'dan önce gelebilir.
    # Her "{" konumunda raw_decode deneyerek ilk geçerli JSON nesnesini bul.
    decoder = json.JSONDecoder()
    for match in re.finditer(r"\{", clean):
        try:
            value, _end = decoder.raw_decode(clean[match.start():])
        except ValueError:
            continue
        if isinstance(value, dict):
            return value
    return None


def _normalize_url(value: Any) -> str:
    url = str(value or "").strip().strip("<>[](){}'\"")
    if not url.startswith(("https://", "http://")):
        return ""
    if len(url) > 2000:
        return ""
    return url


def _unique_urls(values: Any) -> list[str]:
    urls: list[str] = []
    if isinstance(values, str):
        values = [values]
    if not isinstance(values, (list, tuple)):
        return urls
    for item in values:
        url = _normalize_url(item)
        if url and url not in urls:
            urls.append(url)
    return urls[:5]


def _urls_from_text(text: str) -> list[str]:
    urls = []
    for found in re.findall(r"https?://[^\s\]\[<>{}\"']+", str(text or "")):
        url = _normalize_url(found.rstrip(".,;:)"))
        if url and url not in urls:
            urls.append(url)
    return urls[:5]


def _normalize_score(value: Any) -> str | None:
    text = str(value or "").strip()
    match = re.fullmatch(r"(\d{1,3})\s*[-:–—]\s*(\d{1,3})", text)
    if not match:
        return None
    return f"{int(match.group(1))}-{int(match.group(2))}"


def _normalize_optional_score(value: Any) -> str | None:
    return _normalize_score(value)


def _int_or_none(value: Any) -> int | None:
    if value in (None, "", "null", "—", "-"):
        return None
    try:
        number = int(float(str(value).replace(",", ".")))
    except (TypeError, ValueError):
        return None
    return number if 0 <= number <= 99 else None


def _groq_chat(
    endpoint: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    timeout: int,
    max_completion_tokens: int,
    reasoning_effort: str,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.1,
        "max_completion_tokens": max_completion_tokens,
        "reasoning_effort": reasoning_effort,
        "stream": False,
        "tool_choice": "required",
        "tools": [{"type": "browser_search"}],
    }
    return _http_json(
        endpoint,
        api_key=api_key,
        payload=payload,
        timeout=timeout,
    )


def _error_hint(exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        if exc.code == 401:
            return "Groq API anahtarı geçersiz veya yetkisiz (401)."
        if exc.code == 429:
            return "Groq ücretsiz kullanım/rate-limit sınırına ulaşıldı (429)."
        if exc.code in {400, 404, 422}:
            return f"Groq isteği/model-browser_search uyumluluk hatası ({exc.code})."
        return f"Groq HTTP hatası ({exc.code})."
    if isinstance(exc, urllib.error.URLError):
        return "Groq'a internet bağlantısı kurulamadı."
    return f"Groq hatası: {type(exc).__name__}: {exc}"


def run_groq_web_fallback(
    home_team: str,
    away_team: str,
    target_date: str,
    sport: str,
    debug_logs: list[str],
    *,
    bet_choice: str | None = None,
    bet_subchoice: str | None = None,
) -> dict[str, Any] | None:
    """Tüm veri kaynakları başarısızsa Groq Browser Search ile web'i tara."""

    config = _load_config()
    if not config["enabled"]:
        debug_logs.append("Groq Web AI fallback: yapılandırmada devre dışı.")
        return None

    api_key, key_source = _read_api_key(return_source=True)
    if not api_key:
        debug_logs.append(
            "Groq Web AI fallback: API anahtarı bulunamadı. "
            "GROQ_API_KEY veya groq_api_key.txt kullanabilirsin."
            + _api_key_missing_hint()
        )
        return None
    debug_logs.append(f"Groq Web AI: API anahtarı bulundu ({key_source}).")

    max_lines = int(config["max_debug_lines"])
    compact_logs = [str(line)[:420] for line in (debug_logs or [])[-max_lines:]]
    evidence = "\n".join(f"- {line}" for line in compact_logs)

    system_prompt = (
        "Sen canlı web taraması yapan, kanıt odaklı bir spor sonucu doğrulama ajanısın. "
        "Browser Search aracını MUTLAKA kullan. Tahmin yapma; gelecekteki maçı oynanmış gibi gösterme. "
        "Sadece aynı spor, aynı tarih ve aynı katılımcılara ait karşılaşmayı kabul et. "
        "Takım/oyuncu aliaslarını toleranslı değerlendir ancak farklı karşılaşmayı eşleştirme. "
        "Skor, devre skoru veya korner sayısını yalnızca ziyaret ettiğin web kaynaklarında açıkça "
        "görüyorsan yaz. Çelişkili kaynak varsa found=false yap. Kaynak URL'lerini yalnız gerçekten "
        "browser_search ile gördüğün sayfalardan ver. Sonunda istenen JSON dışında yorum ekleme."
    )

    user_prompt = f"""Web'de şu karşılaşmayı araştır ve sonucu doğrula:
Spor: {sport}
Tarih: {target_date}
Katılımcı 1 / ev sahibi: {home_team}
Katılımcı 2 / deplasman: {away_team}
Seçilen bahis: {bet_choice or 'Belirtilmedi'}
Bahis alt seçeneği: {bet_subchoice or 'Belirtilmedi'}

Programın daha önce denediği kaynaklardan kısa debug özeti:
{evidence}

Özellikle seçilen bahsi sonuçlandırmak için gerekli bilgiyi de ara. Maç bittiyse final skoru doğrula.
Mümkünse devre skoru ve futbol ise kornerleri de doğrula. En az iki bağımsız kaynak bulmaya çalış.

Yanıtın EN SONUNDA tam olarak şu biçimde olsun:
FINAL_JSON_BEGIN
{{
  "found": true,
  "confidence": 0.0,
  "canonical_home": "webde doğrulanan ad",
  "canonical_away": "webde doğrulanan ad",
  "match_status": "FINAL veya LIVE veya SCHEDULED veya POSTPONED veya CANCELLED veya UNKNOWN",
  "score": "0-0 veya null",
  "ht_score": "0-0 veya null",
  "corners_home": null,
  "corners_away": null,
  "summary": "Türkçe kısa kanıt özeti",
  "source_urls": ["https://...", "https://..."],
  "source_names": ["kaynak adı", "kaynak adı"],
  "notes": ["en fazla 3 kısa not"]
}}
FINAL_JSON_END

Kurallar:
- Maçın final sonucu bulunmadıysa score=null.
- FINAL değilse final bahis sonucu üretme.
- confidence 0 ile 1 arasında olsun.
- Yanlış tarih/spor/katılımcı eşleşmesinde found=false.
- URL uydurma; yalnız browser search ile gerçekten ziyaret/gördüğün URL'leri yaz.
"""

    model = str(config["model"])
    try:
        response = _groq_chat(
            str(config["endpoint"]),
            api_key,
            model,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            int(config["timeout_seconds"]),
            int(config["max_completion_tokens"]),
            str(config["reasoning_effort"]),
        )
    except Exception as exc:
        debug_logs.append(f"Groq Web AI fallback: {_error_hint(exc)}")
        return None

    choices = response.get("choices") or []
    message = choices[0].get("message") if choices and isinstance(choices[0], dict) else {}
    if not isinstance(message, dict):
        message = {}
    content = str(message.get("content") or "").strip()
    parsed = _extract_json_object(content)

    if not parsed:
        debug_logs.append(
            "Groq Web AI fallback: web taraması yanıt verdi ancak yapılandırılmış sonuç okunamadı."
        )
        urls = _urls_from_text(content)
        return {
            "status": "AI_FALLBACK",
            "score": None,
            "sport": sport,
            "source": f"Groq Web AI ({model})",
            "source_url": urls[0] if urls else "",
            "web_source_urls": urls,
            "matched_home": home_team,
            "matched_away": away_team,
            "ai_answer": content[-1800:] if content else "Web taraması tamamlandı fakat doğrulanmış sonuç çıkarılamadı.",
            "ai_confidence": 0.0,
            "ai_suggested_searches": [],
            "ai_notes": ["Yapılandırılmış web sonucu okunamadı; otomatik settlement yapılmadı."],
            "ai_model": model,
            "ai_web_search": True,
            "debug_logs": debug_logs,
        }

    found = bool(parsed.get("found", False))
    try:
        confidence = max(0.0, min(1.0, float(parsed.get("confidence", 0.0))))
    except (TypeError, ValueError):
        confidence = 0.0

    matched_home = str(parsed.get("canonical_home") or home_team).strip() or home_team
    matched_away = str(parsed.get("canonical_away") or away_team).strip() or away_team
    status_text = str(parsed.get("match_status") or "UNKNOWN").strip().upper()
    summary = str(parsed.get("summary") or "Groq web taraması tamamlandı.").strip()
    notes_raw = parsed.get("notes") or []
    notes = [str(item).strip() for item in notes_raw if str(item).strip()][:3] if isinstance(notes_raw, list) else []

    urls = _unique_urls(parsed.get("source_urls"))
    for url in _urls_from_text(content):
        if url not in urls:
            urls.append(url)
    urls = urls[:5]

    names_raw = parsed.get("source_names") or []
    source_names = [str(item).strip() for item in names_raw if str(item).strip()][:5] if isinstance(names_raw, list) else []

    score = _normalize_score(parsed.get("score"))
    ht_score = _normalize_optional_score(parsed.get("ht_score"))
    corners_home = _int_or_none(parsed.get("corners_home"))
    corners_away = _int_or_none(parsed.get("corners_away"))

    final_status = status_text in {"FINAL", "FT", "COMPLETED", "FINISHED"}
    min_conf = float(config["min_confidence_for_settlement"])
    min_sources = int(config["min_sources_for_settlement"])
    can_settle = (
        found
        and final_status
        and score is not None
        and confidence >= min_conf
        and len(urls) >= min_sources
    )

    debug_logs.append(
        "Groq Web AI fallback devreye girdi: "
        f"model={model}, found={found}, status={status_text}, "
        f"confidence={confidence:.2f}, sources={len(urls)}."
    )

    if can_settle:
        debug_logs.append(
            "Groq Web AI: final skor web kaynaklarıyla yeterli güven seviyesinde doğrulandı; "
            "normal bahis analiz akışına aktarılıyor."
        )
        corners = {
            "home": corners_home if corners_home is not None else 0,
            "away": corners_away if corners_away is not None else 0,
        }
        return {
            "status": "OK",
            "score": score,
            "sport": sport,
            "corners": corners,
            "ht_score": ht_score,
            "ht_corners": None,
            "goals": [],
            "events": [],
            "team_stats": {},
            "player_stats": {"home": [], "away": []},
            "period_scores": {},
            "source": f"Groq Web AI ({model})",
            "source_url": urls[0],
            "web_source_urls": urls,
            "web_source_names": source_names,
            "matched_home": matched_home,
            "matched_away": matched_away,
            "ai_answer": summary,
            "ai_confidence": confidence,
            "ai_model": model,
            "ai_web_search": True,
            "ai_web_verified": True,
            "debug_logs": debug_logs,
        }

    reason_parts = []
    if not found:
        reason_parts.append("aynı maç güvenilir biçimde bulunamadı")
    if not final_status:
        reason_parts.append(f"maç durumu final değil ({status_text})")
    if score is None:
        reason_parts.append("final skor doğrulanamadı")
    if confidence < min_conf:
        reason_parts.append(f"güven eşiğin altında (%{confidence * 100:.0f})")
    if len(urls) < min_sources:
        reason_parts.append(f"yeterli bağımsız kaynak yok ({len(urls)}/{min_sources})")
    reason = "; ".join(reason_parts) or "otomatik doğrulama koşulları sağlanmadı"
    debug_logs.append(
        f"Groq Web AI: otomatik settlement yapılmadı; {reason}."
    )

    return {
        "status": "AI_FALLBACK",
        "score": None,
        "sport": sport,
        "source": f"Groq Web AI ({model})",
        "source_url": urls[0] if urls else "",
        "web_source_urls": urls,
        "web_source_names": source_names,
        "matched_home": matched_home,
        "matched_away": matched_away,
        "ai_answer": summary,
        "ai_confidence": confidence,
        "ai_suggested_searches": [],
        "ai_notes": notes + ([f"Otomatik settlement yapılmadı: {reason}."] if reason else []),
        "ai_model": model,
        "ai_web_search": True,
        "ai_web_verified": False,
        "ai_detected_status": status_text,
        "ai_detected_score": score,
        "debug_logs": debug_logs,
    }


# ---------------------------------------------------------------------------
# BULUNMUŞ MAÇTA EKSİK VERİYİ GROQ WEB İLE TAMAMLAMA
# ---------------------------------------------------------------------------

_TEAM_STAT_KEYS = {
    "total_shots",
    "shots_on_target",
    "corners",
    "yellow_cards",
    "shots_off_target",
    "blocked_shots",
    "shots_inside_box",
    "shots_outside_box",
    "hit_woodwork",
    "headed_goals",
    "touches_opposition_box",
    "accurate_passes",
    "offsides",
    "free_kicks",
    "throw_ins",
    "fouls",
    "tackles",
    "duels_won",
    "goalkeeper_saves",
    "goals_prevented",
    "goal_kicks",
}

_PLAYER_STAT_KEYS = {
    "points", "rebounds", "assists", "threes", "threePointersMade",
    "steals", "blocks", "minutes", "minutesPlayed", "goals", "goalAssist",
    "totalShots", "shotsOnTarget", "accuratePass", "totalPass", "tackles",
    "tackleWon", "duelWon", "saves", "goalkeeperSaves", "rating",
}


def _clean_stat_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    text = str(value).strip()
    if not text or text.casefold() in {"null", "none", "bilinmiyor", "—"}:
        return None
    if len(text) > 80:
        return None
    return text


def _normalize_pair(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    home = _clean_stat_value(value.get("home"))
    away = _clean_stat_value(value.get("away"))
    if home is None or away is None:
        return None
    return {"home": home, "away": away}


def _merge_team_stats(target: dict[str, Any], incoming: Any) -> int:
    if not isinstance(incoming, dict):
        return 0
    changed = 0
    for period in ("ALL", "1ST", "2ND"):
        rows = incoming.get(period)
        if not isinstance(rows, dict):
            continue
        dest_period = target.setdefault(period, {})
        if not isinstance(dest_period, dict):
            dest_period = {}
            target[period] = dest_period
        for key, raw_pair in rows.items():
            if key not in _TEAM_STAT_KEYS:
                continue
            pair = _normalize_pair(raw_pair)
            if pair is None:
                continue
            existing = dest_period.get(key)
            if not isinstance(existing, dict) or any(
                existing.get(side) in (None, "", "—") for side in ("home", "away")
            ):
                dest_period[key] = pair
                changed += 1
    return changed


def _merge_period_scores(target: dict[str, Any], incoming: Any) -> int:
    if not isinstance(incoming, dict):
        return 0
    changed = 0
    for key, raw_pair in incoming.items():
        pair = _normalize_pair(raw_pair)
        if pair is None:
            continue
        skey = str(key).strip()
        if not skey or len(skey) > 24:
            continue
        existing = target.get(skey)
        if not isinstance(existing, dict):
            target[skey] = pair
            changed += 1
    return changed


def _merge_player_stats(target: dict[str, Any], incoming: Any) -> int:
    if not isinstance(incoming, list):
        return 0
    changed = 0
    target.setdefault("home", [])
    target.setdefault("away", [])
    for row in incoming[:20]:
        if not isinstance(row, dict):
            continue
        team = str(row.get("team") or "").strip().casefold()
        if team not in {"home", "away"}:
            continue
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        stats_raw = row.get("statistics") or {}
        if not isinstance(stats_raw, dict):
            continue
        clean_stats = {
            key: _clean_stat_value(value)
            for key, value in stats_raw.items()
            if key in _PLAYER_STAT_KEYS and _clean_stat_value(value) is not None
        }
        if not clean_stats:
            continue
        rows = target.setdefault(team, [])
        existing = next(
            (item for item in rows if str(item.get("name") or "").strip().casefold() == name.casefold()),
            None,
        )
        if existing is None:
            rows.append({"name": name, "statistics": clean_stats, "ai_enriched": True})
            changed += 1
        else:
            estats = existing.setdefault("statistics", {})
            local_change = False
            for key, value in clean_stats.items():
                if estats.get(key) in (None, "", "—"):
                    estats[key] = value
                    local_change = True
            if local_change:
                existing["ai_enriched"] = True
                changed += 1
    return changed


def enrich_match_data_with_groq(
    match_data: dict[str, Any],
    home_team: str,
    away_team: str,
    target_date: str,
    sport: str,
    debug_logs: list[str],
    *,
    bet_choice: str | None = None,
    bet_subchoice: str | None = None,
    stats_view: str | None = None,
    missing_hint: str | None = None,
) -> dict[str, Any] | None:
    """Bulunmuş maçta eksik settlement/istatistik alanlarını web'den tamamlar.

    Yalnız yeterli güven + bağımsız kaynak eşiği sağlandığında veri ana maç
    nesnesine işlenir. Mevcut doğrulanmış alanlar AI tarafından ezilmez.
    """
    if not isinstance(match_data, dict) or match_data.get("status") != "OK":
        return None

    config = _load_config()
    if not config.get("enabled", True):
        return None
    api_key, key_source = _read_api_key(return_source=True)
    if not api_key:
        debug_logs.append(
            "Groq eksik-veri tamamlama: API anahtarı bulunamadı; atlandı."
            + _api_key_missing_hint()
        )
        return None
    debug_logs.append(f"Groq eksik-veri tamamlama: API anahtarı bulundu ({key_source}).")

    compact_existing = {
        "source": match_data.get("source"),
        "event_id": match_data.get("event_id"),
        "score": match_data.get("score"),
        "ht_score": match_data.get("ht_score"),
        "corners": match_data.get("corners"),
        "ht_corners": match_data.get("ht_corners"),
        "team_stats_periods": list((match_data.get("team_stats") or {}).keys()),
        "period_scores": match_data.get("period_scores") or {},
        "map_scores": match_data.get("map_scores") or [],
    }
    try:
        existing_json = json.dumps(compact_existing, ensure_ascii=False)[:5000]
    except Exception:
        existing_json = "{}"

    system_prompt = (
        "Sen bulunan bir spor karşılaşmasındaki EKSİK verileri gerçek web kaynaklarından tamamlayan "
        "kanıt odaklı bir doğrulama ajanısın. Browser Search aracını MUTLAKA kullan. Tahmin, çıkarım, "
        "uydurma veya final skordan devre skoru türetme. Yalnız aynı spor, aynı tarih ve aynı katılımcılar "
        "için web sayfalarında açıkça gördüğün verileri döndür. Mevcut doğrulanmış veriyi değiştirme. "
        "Çelişkili kaynak varsa ilgili alanı null/boş bırak. Kaynak URL uydurma."
    )
    user_prompt = f"""Şu karşılaşmanın eksik verilerini web'de araştır:
Spor: {sport}
Tarih: {target_date}
Ev / katılımcı 1: {home_team}
Deplasman / katılımcı 2: {away_team}
Bahis: {bet_choice or 'Belirtilmedi'}
Alt seçenek: {bet_subchoice or 'Belirtilmedi'}
İstenen istatistik görünümü: {stats_view or 'Kapalı'}
Analyzer eksik-veri mesajı: {missing_hint or 'Yok'}

Programda zaten doğrulanmış mevcut veri (BUNLARI EZME):
{existing_json}

Öncelik:
1) Bahsi sonuçlandırmak için analyzer'ın eksik dediği alanı bul.
2) Seçilen istatistik görünümü boşsa o periyodun istatistiklerini bul.
3) Basketbol oyuncu bahsiyse yalnız ilgili oyuncunun gerçek boxscore değerlerini bul.
4) Tenis/masa tenisi/voleybol vb. için set/periyot skorlarını; e-sporda map/round skorlarını bul.
5) En az iki bağımsız kaynakla doğrulamaya çalış.

Futbol team_stats anahtarları yalnız şunlardan biri olabilir:
{', '.join(sorted(_TEAM_STAT_KEYS))}

Yanıtın EN SONUNDA tam olarak şu JSON biçiminde olsun:
FINAL_JSON_BEGIN
{{
  "found": true,
  "confidence": 0.0,
  "ht_score": "0-0 veya null",
  "ht_corners": {{"home": null, "away": null}},
  "corners": {{"home": null, "away": null}},
  "team_stats": {{
    "ALL": {{"total_shots": {{"home": null, "away": null}}}},
    "1ST": {{}},
    "2ND": {{}}
  }},
  "period_scores": {{}},
  "player_stats": [
    {{"team": "home veya away", "name": "oyuncu", "statistics": {{"points": null, "rebounds": null, "assists": null, "threes": null, "steals": null, "blocks": null}}}}
  ],
  "map_scores": [{{"map": "Map 1", "home": null, "away": null}}],
  "round_score": null,
  "summary": "Türkçe kısa özet",
  "source_urls": ["https://...", "https://..."],
  "source_names": ["kaynak", "kaynak"],
  "notes": []
}}
FINAL_JSON_END

Kurallar:
- Web'de açıkça doğrulanmayan alan null veya boş kalsın.
- Bir alan için kaynaklar çelişiyorsa o alanı doldurma.
- final skordan 1. yarı/2. yarı sonucu TAHMİN ETME.
- Oyuncu istatistiğini takım toplamından TÜRETME.
- URL uydurma; yalnız browser search'te gerçekten gördüğün URL'leri yaz.
"""

    model = str(config.get("model") or DEFAULT_MODEL)
    try:
        response = _groq_chat(
            str(config.get("endpoint") or DEFAULT_ENDPOINT),
            api_key,
            model,
            [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            int(config.get("timeout_seconds", 70)),
            int(config.get("max_completion_tokens", 2400)),
            str(config.get("reasoning_effort", "low")),
        )
    except Exception as exc:
        debug_logs.append(f"Groq eksik-veri tamamlama: {_error_hint(exc)}")
        return None

    choices = response.get("choices") or []
    message = choices[0].get("message") if choices and isinstance(choices[0], dict) else {}
    content = str((message or {}).get("content") or "").strip()
    parsed = _extract_json_object(content)
    if not parsed:
        debug_logs.append("Groq eksik-veri tamamlama: yapılandırılmış yanıt okunamadı.")
        return None

    try:
        confidence = max(0.0, min(1.0, float(parsed.get("confidence", 0.0))))
    except (TypeError, ValueError):
        confidence = 0.0
    urls = _unique_urls(parsed.get("source_urls"))
    for url in _urls_from_text(content):
        if url not in urls:
            urls.append(url)
    urls = urls[:5]

    min_conf = float(config.get("min_confidence_for_enrichment", 0.86))
    min_sources = int(config.get("min_sources_for_enrichment", 2))
    accepted = bool(parsed.get("found")) and confidence >= min_conf and len(urls) >= min_sources
    debug_logs.append(
        "Groq eksik-veri tamamlama: "
        f"found={bool(parsed.get('found'))}, confidence={confidence:.2f}, sources={len(urls)}, "
        f"accepted={accepted}."
    )
    if not accepted:
        match_data["ai_enrichment_attempted"] = True
        match_data["ai_enrichment_verified"] = False
        match_data["ai_enrichment_summary"] = str(parsed.get("summary") or "").strip()
        match_data["ai_enrichment_urls"] = urls
        return match_data

    changed_fields: list[str] = []

    if not match_data.get("ht_score"):
        ht_score = _normalize_optional_score(parsed.get("ht_score"))
        if ht_score:
            match_data["ht_score"] = ht_score
            changed_fields.append("1. yarı skoru")

    current_ht_corners = match_data.get("ht_corners")
    if not isinstance(current_ht_corners, dict) or any(
        current_ht_corners.get(side) in (None, "", "—") for side in ("home", "away")
    ):
        pair = _normalize_pair(parsed.get("ht_corners"))
        if pair is not None:
            try:
                pair = {"home": int(float(pair["home"])), "away": int(float(pair["away"]))}
                match_data["ht_corners"] = pair
                changed_fields.append("1. yarı kornerleri")
            except (TypeError, ValueError):
                pass

    current_corners = match_data.get("corners")
    if not isinstance(current_corners, dict) or any(
        current_corners.get(side) in (None, "", "—") for side in ("home", "away")
    ):
        pair = _normalize_pair(parsed.get("corners"))
        if pair is not None:
            try:
                pair = {"home": int(float(pair["home"])), "away": int(float(pair["away"]))}
                match_data["corners"] = pair
                changed_fields.append("toplam korner")
            except (TypeError, ValueError):
                pass

    team_stats = match_data.setdefault("team_stats", {})
    stat_changes = _merge_team_stats(team_stats, parsed.get("team_stats"))
    if stat_changes:
        changed_fields.append(f"{stat_changes} takım istatistiği")
        current_stats_source = str(match_data.get("stats_source") or match_data.get("source") or "").strip()
        match_data["stats_source"] = (current_stats_source + " + Groq Web AI").strip(" +")

    period_scores = match_data.setdefault("period_scores", {})
    period_changes = _merge_period_scores(period_scores, parsed.get("period_scores"))
    if period_changes:
        changed_fields.append(f"{period_changes} periyot/set skoru")

    player_stats = match_data.setdefault("player_stats", {"home": [], "away": []})
    player_changes = _merge_player_stats(player_stats, parsed.get("player_stats"))
    if player_changes:
        changed_fields.append(f"{player_changes} oyuncu boxscore kaydı")

    if not match_data.get("map_scores") and isinstance(parsed.get("map_scores"), list):
        clean_maps = []
        for row in parsed.get("map_scores")[:12]:
            if not isinstance(row, dict):
                continue
            try:
                hv = int(float(row.get("home")))
                av = int(float(row.get("away")))
            except (TypeError, ValueError):
                continue
            clean_maps.append({"map": str(row.get("map") or f"Map {len(clean_maps)+1}")[:50], "home": hv, "away": av})
        if clean_maps:
            match_data["map_scores"] = clean_maps
            changed_fields.append("e-spor map skorları")

    if not match_data.get("round_score"):
        round_score = _normalize_optional_score(parsed.get("round_score"))
        if round_score:
            match_data["round_score"] = round_score
            changed_fields.append("round skoru")

    existing_web = match_data.get("web_source_urls") or []
    if not isinstance(existing_web, list):
        existing_web = []
    for url in urls:
        if url not in existing_web:
            existing_web.append(url)
    match_data["web_source_urls"] = existing_web[:8]
    match_data["ai_enrichment_urls"] = urls
    match_data["ai_enrichment_attempted"] = True
    match_data["ai_enrichment_verified"] = bool(changed_fields)
    match_data["ai_enrichment_confidence"] = confidence
    match_data["ai_enrichment_summary"] = str(parsed.get("summary") or "").strip()
    match_data["ai_enriched_fields"] = changed_fields

    if changed_fields:
        debug_logs.append("Groq doğrulanmış eksik verileri tamamladı: " + ", ".join(changed_fields) + ".")
    else:
        debug_logs.append("Groq web taraması doğrulandı ancak mevcut veriye eklenebilecek yeni alan bulunmadı.")
    return match_data


# ---------------------------------------------------------------------------
# Flashscore public/canonical maç linki çözümleyici
# ---------------------------------------------------------------------------

_FLASH_LINK_CACHE: dict[str, str] = {}
_FLASH_LINK_CACHE_LOADED = False


def _flash_link_cache_path() -> Path:
    root = os.environ.get("LOCALAPPDATA") or tempfile.gettempdir()
    return Path(root) / "HizirBeySports" / "flashscore_link_cache.json"


def _load_flash_link_cache() -> None:
    global _FLASH_LINK_CACHE_LOADED
    if _FLASH_LINK_CACHE_LOADED:
        return
    _FLASH_LINK_CACHE_LOADED = True
    try:
        path = _flash_link_cache_path()
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(key, str) and isinstance(value, str):
                        _FLASH_LINK_CACHE[key] = value
    except Exception:
        pass


def _save_flash_link_cache() -> None:
    try:
        path = _flash_link_cache_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(_FLASH_LINK_CACHE, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass


def _valid_flashscore_match_url(url: str, event_id: str) -> bool:
    url = str(url or "").strip()
    event_id = str(event_id or "").strip()
    if not url or not event_id:
        return False
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False
    host = (parsed.hostname or "").casefold()
    if host not in {"flashscore.com", "www.flashscore.com"}:
        return False
    if not parsed.path.casefold().startswith("/match/"):
        return False
    query = urllib.parse.parse_qs(parsed.query)
    mids = [str(v).strip() for v in query.get("mid", [])]
    return event_id in mids


def resolve_flashscore_public_url(
    event_id: str,
    home_team: str,
    away_team: str,
    sport: str,
    debug_logs: list[str] | None = None,
) -> str:
    """Groq Browser Search ile gerçek Flashscore public maç URL'sini çözer.

    Flashscore feed'deki katılımcı kimlikleri her zaman public URL kimlikleriyle
    aynı olmadığı için URL'yi tahmin etmek yerine arama motoru kanıtıyla bulur.
    Sonuç event_id bazında kalıcı cache'e alınır.
    """
    logs = debug_logs if isinstance(debug_logs, list) else []
    event_id = str(event_id or "").strip()
    if not event_id:
        return ""

    _load_flash_link_cache()
    cached = _FLASH_LINK_CACHE.get(event_id, "")
    if _valid_flashscore_match_url(cached, event_id):
        logs.append(f"Flashscore public link: cache kullanıldı ({event_id}).")
        return cached

    config = _load_config()
    if not config.get("enabled", True):
        logs.append("Flashscore public link: Groq Web AI devre dışı.")
        return ""

    api_key, key_source = _read_api_key(return_source=True)
    if not api_key:
        logs.append(
            "Flashscore public link: Groq API anahtarı yok; canonical URL çözülemedi."
            + _api_key_missing_hint()
        )
        return ""
    logs.append(f"Flashscore public link: Groq API anahtarı bulundu ({key_source}).")

    model = str(config.get("model") or DEFAULT_MODEL)
    system_prompt = (
        "Sen yalnızca Flashscore'daki belirli bir maçın gerçek public URL'sini bulan bir web arama ajanısın. "
        "Browser Search aracını MUTLAKA kullan. URL uydurma. Yalnız flashscore.com alan adındaki /match/ sayfasını kabul et. "
        "Bulduğun URL'nin query parametresindeki mid değeri verilen event_id ile birebir aynı olmalı. "
        "Takım adları, spor ve mümkünse tarih eşleşmesini kontrol et. Sonunda yalnız istenen JSON'u yaz."
    )
    user_prompt = f"""Flashscore'da şu maçın gerçek public sayfasını bul:
Spor: {sport}
Ev sahibi / katılımcı 1: {home_team}
Deplasman / katılımcı 2: {away_team}
Flashscore event_id (mid): {event_id}

Özellikle şu tip aramalar yapabilirsin:
site:flashscore.com/match "{event_id}" "{home_team}" "{away_team}"

Yanıtın EN SONUNDA tam olarak:
FINAL_JSON_BEGIN
{{"found": true, "url": "https://www.flashscore.com/match/.../?mid={event_id}"}}
FINAL_JSON_END

Kurallar:
- URL'yi browser search sonucunda gerçekten görmediysen found=false yap.
- mid={event_id} birebir aynı değilse kabul etme.
- Başka site veya tahmini URL verme.
"""

    try:
        response = _groq_chat(
            str(config.get("endpoint") or DEFAULT_ENDPOINT),
            api_key,
            model,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            min(55, int(config.get("timeout_seconds", 70))),
            900,
            "low",
        )
    except Exception as exc:
        logs.append(f"Flashscore public link: Groq çözümleme başarısız ({_error_hint(exc)}).")
        return ""

    choices = response.get("choices") or []
    message = choices[0].get("message") if choices and isinstance(choices[0], dict) else {}
    content = str((message or {}).get("content") or "").strip()
    parsed = _extract_json_object(content) or {}

    candidates: list[str] = []
    if isinstance(parsed, dict):
        candidates.append(str(parsed.get("url") or ""))
    candidates.extend(_urls_from_text(content))

    for candidate in candidates:
        candidate = _normalize_url(candidate)
        if _valid_flashscore_match_url(candidate, event_id):
            _FLASH_LINK_CACHE[event_id] = candidate
            _save_flash_link_cache()
            logs.append(f"Flashscore public link: canonical URL Groq Browser Search ile doğrulandı ({event_id}).")
            return candidate

    logs.append(f"Flashscore public link: event_id={event_id} için doğrulanmış public URL bulunamadı.")
    return ""
