"""Puter.js tabanli, API key gerektirmeyen tarayici fallback'i.

Bu modul yalniz normal spor veri kaynaklari ve Groq basarisiz olduktan sonra
kullanilmak uzere tasarlanmistir. Puter User-Pays modeli nedeniyle kullanici
varsayilan tarayicisinda Puter hesabi ile oturum acabilir; yerel kurulum gerekmez.
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
import threading
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import requests


def _extract_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    match = re.search(r"FINAL_JSON_BEGIN\s*(\{.*?\})\s*FINAL_JSON_END", text, re.S)
    candidates = [match.group(1)] if match else []
    if not candidates:
        starts = [m.start() for m in re.finditer(r"\{", text)]
        for start in starts[-8:]:
            chunk = text[start:].strip()
            if chunk.endswith("}"):
                candidates.append(chunk)
    for candidate in candidates:
        try:
            obj = json.loads(candidate)
            if isinstance(obj, dict):
                return obj
        except Exception:
            continue
    return None


def _score(value: Any) -> str | None:
    if value is None:
        return None
    m = re.fullmatch(r"\s*(\d{1,3})\s*[-:–—]\s*(\d{1,3})\s*", str(value))
    return f"{int(m.group(1))}-{int(m.group(2))}" if m else None


def _int_or_none(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except Exception:
        return None


def _urls(value: Any) -> list[str]:
    items = value if isinstance(value, list) else []
    out: list[str] = []
    seen: set[str] = set()
    for item in items:
        u = str(item or "").strip()
        if u.startswith(("http://", "https://")) and u not in seen:
            seen.add(u)
            out.append(u)
    return out[:6]


def _text_from_puter_response_js() -> str:
    return r'''
function responseText(result) {
  try {
    if (typeof result === "string") return result;
    if (result && typeof result.text === "string") return result.text;
    if (result && result.message) {
      const c = result.message.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) {
        return c.map(x => {
          if (typeof x === "string") return x;
          if (x && typeof x.text === "string") return x.text;
          if (x && typeof x.content === "string") return x.content;
          try { return JSON.stringify(x); } catch (_) { return ""; }
        }).join("\n");
      }
    }
    try { return JSON.stringify(result); } catch (_) { return String(result || ""); }
  } catch (_) { return ""; }
}
'''


_AUTH_LOCK = threading.Lock()
_AUTH_THREAD: threading.Thread | None = None


def _candidate_token_paths() -> list[Path]:
    """Return every supported user-owned Puter token location.

    V47 intentionally never writes token/key files into an update package.
    """
    filenames = (
        "puter_auth_token.txt",
        "puter_token.txt",
        "puter_api_token.txt",
        "puter_api_key.txt",
    )
    roots: list[Path] = []
    local = os.environ.get("LOCALAPPDATA")
    roaming = os.environ.get("APPDATA")
    if local:
        roots.append(Path(local) / "HizirBeySports")
    if roaming:
        roots.append(Path(roaming) / "HizirBeySports")
    try:
        exe_dir = Path(sys.executable).resolve().parent
        roots += [exe_dir, exe_dir / "project"]
    except Exception:
        pass
    try:
        cwd = Path.cwd().resolve()
        roots += [cwd, cwd / "project"]
    except Exception:
        pass
    try:
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            roots.append(Path(meipass))
    except Exception:
        pass

    out: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        for filename in filenames:
            path = root / filename
            key = str(path).lower()
            if key not in seen:
                seen.add(key)
                out.append(path)
    return out


def _clean_token(value: str | None) -> str | None:
    text = str(value or "").strip().lstrip("\ufeff")
    if not text:
        return None

    # Users sometimes paste VAR=value or a tiny JSON object into the txt file.
    if text.startswith("{") and text.endswith("}"):
        try:
            obj = json.loads(text)
            for key in ("PUTER_AUTH_TOKEN", "puter_auth_token", "PUTER_API_TOKEN", "PUTER_API_KEY", "token", "api_key"):
                if obj.get(key):
                    text = str(obj[key]).strip()
                    break
        except Exception:
            pass

    lowered = text.lower()
    for prefix in (
        "puter_auth_token=",
        "puter_api_token=",
        "puter_api_key=",
        "api_key=",
        "token=",
    ):
        if lowered.startswith(prefix):
            text = text.split("=", 1)[1].strip().strip('"').strip("'")
            break

    if text.lower().startswith("bearer "):
        text = text[7:].strip()
    text = text.strip().strip('"').strip("'")
    if len(text) < 20 or any(ch in text for ch in "\r\n\t"):
        return None
    return text


def _load_puter_token(logs: list[str] | None = None) -> str | None:
    for env_name in ("PUTER_AUTH_TOKEN", "PUTER_API_TOKEN", "PUTER_API_KEY"):
        env = _clean_token(os.environ.get(env_name))
        if env:
            if logs is not None:
                logs.append(f"Puter Web AI: token ortam degiskeninden bulundu ({env_name}); tarayici kullanilmayacak.")
            return env
    for path in _candidate_token_paths():
        try:
            if not path.is_file():
                continue
            token = _clean_token(path.read_text(encoding="utf-8", errors="ignore"))
            if token:
                if logs is not None:
                    logs.append(f"Puter Web AI: token bulundu ({path}). Headless API modu kullaniliyor; tarayici acilmayacak.")
                return token
        except Exception:
            continue
    return None


def _persistent_token_path() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
    if base:
        return Path(base) / "HizirBeySports" / "puter_auth_token.txt"
    return Path.home() / ".hizirbeysports" / "puter_auth_token.txt"


def _forget_saved_puter_token(token: str | None = None, logs: list[str] | None = None) -> None:
    # V47: Never delete a user-supplied credential automatically. 401/403 can
    # also be caused by permission/model/account state. Keep the file intact.
    if logs is not None:
        logs.append("Puter Web AI: token dosyasi guvenlik geregi otomatik silinmedi.")


def _save_puter_token(token: str, logs: list[str] | None = None) -> bool:
    # Kept for compatibility with older imports; V47 does not invoke browser auth.
    token = _clean_token(token) or ""
    if not token:
        return False
    try:
        path = _persistent_token_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(token + "\n", encoding="utf-8")
        try:
            os.chmod(path, 0o600)
        except Exception:
            pass
        if logs is not None:
            logs.append(f"Puter Web AI: auth token kaydedildi ({path}).")
        return True
    except Exception as exc:
        if logs is not None:
            logs.append(f"Puter Web AI: auth token kaydedilemedi: {type(exc).__name__}: {exc}")
        return False


def _extract_response_text(payload: Any) -> str:
    if payload is None:
        return ""
    if isinstance(payload, str):
        return payload.strip()
    if isinstance(payload, list):
        parts = [_extract_response_text(x) for x in payload]
        return "\n".join(x for x in parts if x).strip()
    if not isinstance(payload, dict):
        return str(payload).strip()
    if payload.get("success") is False:
        return ""
    for key in ("result", "message", "content", "text", "output_text"):
        if key in payload:
            txt = _extract_response_text(payload.get(key))
            if txt:
                return txt
    choices = payload.get("choices")
    if isinstance(choices, list):
        for choice in choices:
            txt = _extract_response_text(choice)
            if txt:
                return txt
    output = payload.get("output")
    if isinstance(output, list):
        txt = _extract_response_text(output)
        if txt:
            return txt
    return ""


def _puter_api_error(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""
    err = payload.get("error")
    if isinstance(err, dict):
        return str(err.get("message") or err.get("msg") or err.get("code") or err)[:300]
    if err:
        return str(err)[:300]
    return ""


def _run_puter_token_prompt(prompt: str, token: str, logs: list[str], timeout: int = 45) -> str | None:
    """Run Puter headlessly using the free-account compatible /drivers/call API.

    Important: Do not use the OpenAI-compatible endpoint as a fallback here;
    Puter documents that endpoint as paid-plan-only for free accounts. Also do
    not launch browser auth on HTTP errors; a dashboard auth token should be
    sufficient for desktop/backend use.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "HizirBeySports/1.0",
    }
    driver_url = "https://api.puter.com/drivers/call"
    last_error = ""

    # gpt-6-luna is the current Puter web-search example model. Keep two
    # documented/commonly supported OpenAI fallbacks in case catalogue changes.
    model_candidates = ("gpt-6-luna", "gpt-5.4-nano", "gpt-5.2-chat")
    for model in model_candidates:
        body = {
            "interface": "puter-chat-completion",
            "driver": "openai-completion",
            "method": "complete",
            "test_mode": False,
            "args": {
                "messages": [{"role": "user", "content": prompt}],
                "model": model,
                "tools": [{"type": "web_search"}],
                "stream": False,
            },
        }
        try:
            response = requests.post(driver_url, headers=headers, json=body, timeout=max(10, int(timeout)))
            try:
                data = response.json() if response.content else {}
            except Exception:
                data = {"text": response.text}

            api_error = _puter_api_error(data)
            if response.status_code == 401:
                last_error = api_error or "HTTP 401"
                logs.append(f"Puter Web AI: auth token API tarafindan reddedildi ({last_error}). Tarayici ACILMAYACAK; token dosyasi silinmedi, Direct Web'e geciliyor.")
                return None
            if response.status_code == 403:
                last_error = api_error or "HTTP 403"
                logs.append(f"Puter Web AI: erisim/model izni reddedildi ({last_error}). Token gecersiz varsayilmadi ve tarayici ACILMAYACAK; Direct Web'e geciliyor.")
                return None
            if response.status_code == 402:
                last_error = api_error or "HTTP 402"
                logs.append(f"Puter Web AI: hesap/kredi/abonelik siniri ({last_error}); Direct Web'e geciliyor.")
                return None
            if response.status_code == 429:
                logs.append("Puter Web AI: Puter hesabi rate-limit/kullanim sinirina ulasti (429); Direct Web'e geciliyor.")
                return None

            text = _extract_response_text(data)
            if response.ok and text:
                logs.append(f"Puter Web AI: tarayicisiz arka plan web sorgusu basarili ({model}).")
                return text

            last_error = api_error or f"HTTP {response.status_code}"
            logs.append(f"Puter Web AI: {model} sonuc vermedi ({last_error}); siradaki Puter modeli deneniyor.")
        except requests.Timeout:
            last_error = f"{timeout}s timeout"
            logs.append(f"Puter Web AI: {model} zaman asimi; siradaki modele geciliyor.")
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            logs.append(f"Puter Web AI: {model} istek hatasi ({last_error}); siradaki modele geciliyor.")

    logs.append(f"Puter Web AI: headless API sorgusu sonuc vermedi ({last_error or 'bilinmeyen hata'}); Direct Web'e geciliyor.")
    return None


def _ensure_background_auth(logs: list[str]) -> None:
    # V47 intentionally disables automatic browser auth.
    return


def _run_puter_prompt(prompt: str, logs: list[str], timeout: int = 45) -> str | None:
    token = _load_puter_token(logs)
    if token:
        return _run_puter_token_prompt(prompt, token, logs, timeout=timeout)

    expected = _persistent_token_path()
    logs.append(
        "Puter Web AI: auth token bulunamadi. Tarayici ACILMAYACAK. "
        f"Dashboard auth tokenini '{expected}' dosyasina koyabilirsin; bu sorgu Direct Web'e geciyor."
    )
    return None


def _base_prompt(home: str, away: str, date: str, sport: str, bet: str | None, sub: str | None) -> str:
    return f'''Gercek web aramasi yaparak su spor karsilasmasini dogrula. Tahmin etme, skor uydurma.
Spor: {sport}\nTarih: {date}\nKatılımcı 1: {home}\nKatılımcı 2: {away}\nBahis: {bet or 'Belirtilmedi'}\nAlt secenek: {sub or 'Belirtilmedi'}
Ayni spor, ayni tarih ve ayni katilimcilar olmadan eslesme kabul etme. Mümkünse en az iki bagimsiz web kaynagi kullan.
Yaniti EN SONDA su JSON ile bitir:
FINAL_JSON_BEGIN
{{"found":false,"confidence":0.0,"canonical_home":"{home}","canonical_away":"{away}","match_status":"UNKNOWN","score":null,"ht_score":null,"corners_home":null,"corners_away":null,"summary":"","source_urls":[],"source_names":[],"notes":[]}}
FINAL_JSON_END
Kurallar: URL uydurma; final skor yoksa score=null; FINAL olmayan maci final gibi sonuclandirma.'''


def run_puter_web_fallback(home_team: str, away_team: str, target_date: str, sport: str, debug_logs: list[str], *, bet_choice: str | None = None, bet_subchoice: str | None = None) -> dict[str, Any] | None:
    prompt = _base_prompt(home_team, away_team, target_date, sport, bet_choice, bet_subchoice)
    text = _run_puter_prompt(prompt, debug_logs)
    if not text:
        return None
    parsed = _extract_json_object(text)
    if not parsed:
        debug_logs.append("Puter Web AI: yapilandirilmis JSON okunamadi; otomatik settlement yapilmadi.")
        return {"status":"AI_FALLBACK","score":None,"sport":sport,"source":"Puter Web AI","source_url":"","web_source_urls":[],"matched_home":home_team,"matched_away":away_team,"ai_answer":text[-1800:],"ai_confidence":0.0,"ai_model":"Puter / OpenAI web_search","ai_notes":["Yapilandirilmis sonuc okunamadi."],"debug_logs":debug_logs}

    try: conf=max(0.0,min(1.0,float(parsed.get("confidence",0.0))))
    except Exception: conf=0.0
    urls=_urls(parsed.get("source_urls"))
    found=bool(parsed.get("found"))
    status=str(parsed.get("match_status") or "UNKNOWN").upper()
    score=_score(parsed.get("score"))
    ht=_score(parsed.get("ht_score"))
    summary=str(parsed.get("summary") or "Puter web taramasi tamamlandi.")
    names=[str(x) for x in (parsed.get("source_names") or []) if str(x).strip()][:5]
    notes=[str(x) for x in (parsed.get("notes") or []) if str(x).strip()][:4]
    final=status in {"FINAL","FT","COMPLETED","FINISHED"}
    can_settle=found and final and score is not None and conf>=0.84 and len(urls)>=2
    debug_logs.append(f"Puter Web AI: found={found}, status={status}, confidence={conf:.2f}, sources={len(urls)}.")
    common={"sport":sport,"source":"Puter Web AI","source_url":urls[0] if urls else "","web_source_urls":urls,"web_source_names":names,"matched_home":str(parsed.get("canonical_home") or home_team),"matched_away":str(parsed.get("canonical_away") or away_team),"ai_answer":summary,"ai_confidence":conf,"ai_model":"Puter / OpenAI web_search","ai_web_search":True,"debug_logs":debug_logs}
    if can_settle:
        return {**common,"status":"OK","score":score,"ht_score":ht,"corners":{"home":_int_or_none(parsed.get("corners_home")) or 0,"away":_int_or_none(parsed.get("corners_away")) or 0},"ht_corners":None,"goals":[],"events":[],"team_stats":{},"player_stats":{"home":[],"away":[]},"period_scores":{},"ai_web_verified":True}
    return {**common,"status":"AI_FALLBACK","score":None,"ai_notes":notes+["Otomatik settlement icin yeterli bagimsiz kanit bulunamadi."],"ai_web_verified":False,"ai_detected_score":score,"ai_detected_status":status}


def enrich_match_data_with_puter(match_data: dict[str, Any], home_team: str, away_team: str, target_date: str, sport: str, debug_logs: list[str], *, bet_choice: str | None = None, bet_subchoice: str | None = None, stats_view: str | None = None, missing_hint: str | None = None) -> dict[str, Any] | None:
    if not isinstance(match_data, dict) or match_data.get("status") != "OK":
        return None
    existing = {"score":match_data.get("score"),"ht_score":match_data.get("ht_score"),"ht_corners":match_data.get("ht_corners"),"corners":match_data.get("corners"),"period_scores":match_data.get("period_scores") or {},"map_scores":match_data.get("map_scores") or []}
    prompt=f'''Web aramasi ile BULUNMUS bu karsilasmada sadece eksik verileri tamamla. Mevcut veriyi ASLA degistirme.\nSpor: {sport}\nTarih: {target_date}\nKatılımcı 1: {home_team}\nKatılımcı 2: {away_team}\nBahis: {bet_choice or ''}\nAlt secenek: {bet_subchoice or ''}\nIstatistik gorunumu: {stats_view or ''}\nEksik veri mesaji: {missing_hint or ''}\nMevcut: {json.dumps(existing,ensure_ascii=False)}\nEn az iki bagimsiz kaynakla dogrulamaya calis. Tahmin etme.\nFINAL_JSON_BEGIN\n{{"found":false,"confidence":0.0,"ht_score":null,"ht_corners":{{"home":null,"away":null}},"corners":{{"home":null,"away":null}},"period_scores":{{}},"map_scores":[],"round_score":null,"summary":"","source_urls":[],"notes":[]}}\nFINAL_JSON_END'''
    text=_run_puter_prompt(prompt,debug_logs)
    if not text: return None
    parsed=_extract_json_object(text)
    if not parsed: return None
    try: conf=max(0.0,min(1.0,float(parsed.get("confidence",0.0))))
    except Exception: conf=0.0
    urls=_urls(parsed.get("source_urls"))
    if not bool(parsed.get("found")) or conf<0.86 or len(urls)<2:
        debug_logs.append(f"Puter eksik-veri tamamlama: kanit esigi saglanmadi (confidence={conf:.2f}, sources={len(urls)}).")
        return None
    changed=[]
    if not match_data.get("ht_score"):
        val=_score(parsed.get("ht_score"))
        if val: match_data["ht_score"]=val; changed.append("1. yari skoru")
    if not match_data.get("ht_corners") and isinstance(parsed.get("ht_corners"),dict):
        h=_int_or_none(parsed["ht_corners"].get("home")); a=_int_or_none(parsed["ht_corners"].get("away"))
        if h is not None and a is not None: match_data["ht_corners"]={"home":h,"away":a}; changed.append("1. yari kornerleri")
    if not match_data.get("period_scores") and isinstance(parsed.get("period_scores"),dict) and parsed.get("period_scores"):
        match_data["period_scores"]=parsed["period_scores"]; changed.append("periyot/set skorlari")
    if not match_data.get("map_scores") and isinstance(parsed.get("map_scores"),list) and parsed.get("map_scores"):
        match_data["map_scores"]=parsed["map_scores"]; changed.append("map skorlari")
    if match_data.get("round_score") in (None,"") and parsed.get("round_score") not in (None,""):
        match_data["round_score"]=parsed.get("round_score"); changed.append("round skoru")
    if changed:
        match_data.setdefault("web_source_urls",[])
        for u in urls:
            if u not in match_data["web_source_urls"]: match_data["web_source_urls"].append(u)
        match_data.setdefault("ai_enrichment_sources",[]).append("Puter Web AI")
        debug_logs.append("Puter Web AI ile dogrulanarak tamamlandi: "+", ".join(changed)+f" (guven %{conf*100:.0f}).")
        return match_data
    return None
