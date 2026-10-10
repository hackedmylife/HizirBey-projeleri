"""Token gerektirmeyen, AI kullanmayan son web arama/parser fallback'i.

DuckDuckGo'nun HTML arama sayfasini best-effort kullanir. Resmi bir spor API'si
degildir; yalniz Groq ve Puter de sonuc vermezse son emniyet agi olarak calisir.
Otomatik settlement icin iki farkli domain ayni final skoru dogrulamalidir.
"""
from __future__ import annotations

import html as htmlmod
import re
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from html.parser import HTMLParser
from typing import Any

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"


def _norm(s: str) -> str:
    import unicodedata
    s=unicodedata.normalize("NFKD",str(s or ""))
    s="".join(c for c in s if not unicodedata.combining(c)).casefold()
    return re.sub(r"[^a-z0-9]+"," ",s).strip()


def _tokens(s:str)->set[str]: return {x for x in _norm(s).split() if len(x)>=2}

def _name_present(text:str,name:str)->bool:
    nt=_tokens(name); tt=_tokens(text)
    if not nt: return False
    return len(nt & tt) >= max(1, min(len(nt), 2))


def _decode_ddg(url:str)->str:
    url=htmlmod.unescape(url)
    if url.startswith("//"): url="https:"+url
    try:
        q=urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        if q.get("uddg"): return urllib.parse.unquote(q["uddg"][0])
    except Exception: pass
    return url


class _DDGParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.items=[]; self._href=None; self._title=[]; self._snippet=[]; self._mode=None
    def handle_starttag(self,tag,attrs):
        d=dict(attrs); cls=d.get("class","")
        if tag=="a" and "result__a" in cls:
            self._href=d.get("href"); self._title=[]; self._snippet=[]; self._mode="title"
        elif self._href and ("result__snippet" in cls): self._mode="snippet"
    def handle_endtag(self,tag):
        if self._href and tag=="a" and self._mode=="title":
            self.items.append({"url":_decode_ddg(self._href),"title":" ".join(self._title).strip(),"snippet":""}); self._mode=None
        elif self._mode=="snippet" and tag in {"a","div","span"}:
            if self.items: self.items[-1]["snippet"]=" ".join(self._snippet).strip()
            self._mode=None
    def handle_data(self,data):
        if self._mode=="title": self._title.append(data)
        elif self._mode=="snippet": self._snippet.append(data)


def _get(url:str,timeout:int=8,max_bytes:int=500_000)->str:
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept-Language":"en-US,en;q=0.8,tr;q=0.7"})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        raw=r.read(max_bytes)
    text=raw.decode("utf-8",errors="replace")
    text=re.sub(r"<script\b.*?</script>|<style\b.*?</style>"," ",text,flags=re.S|re.I)
    text=re.sub(r"<[^>]+>"," ",text)
    return re.sub(r"\s+"," ",htmlmod.unescape(text)).strip()


def _search(query:str,logs:list[str])->list[dict[str,str]]:
    url="https://html.duckduckgo.com/html/?q="+urllib.parse.quote_plus(query)
    try:
        raw=_get(url,timeout=8,max_bytes=700_000)
        # _get strips tags, so use raw request for parser
        req=urllib.request.Request(url,headers={"User-Agent":UA})
        with urllib.request.urlopen(req,timeout=8) as r: markup=r.read(700_000).decode("utf-8",errors="replace")
        p=_DDGParser(); p.feed(markup)
        return [x for x in p.items if x.get("url","").startswith(("http://","https://"))][:8]
    except Exception as exc:
        logs.append(f"Direkt web arama: DuckDuckGo erisilemedi ({type(exc).__name__}).")
        return []


def _date_variants(date:str)->list[str]:
    vals={str(date or "")}
    m=re.match(r"(\d{4})-(\d{2})-(\d{2})",str(date or ""))
    if m: vals|={f"{m.group(3)}.{m.group(2)}.{m.group(1)}",f"{m.group(3)}/{m.group(2)}/{m.group(1)}"}
    m=re.match(r"(\d{2})\.(\d{2})\.(\d{4})",str(date or ""))
    if m: vals|={f"{m.group(3)}-{m.group(2)}-{m.group(1)}",f"{m.group(1)}/{m.group(2)}/{m.group(3)}"}
    return [x for x in vals if x]


def _score_near(text:str,home:str,away:str)->str|None:
    if not (_name_present(text,home) and _name_present(text,away)): return None
    n=_norm(text); hn=_norm(home); an=_norm(away)
    patterns=list(re.finditer(r"(?<!\d)(\d{1,3})\s*[-:–—]\s*(\d{1,3})(?!\d)",text))
    for m in patterns[:20]:
        a,b=int(m.group(1)),int(m.group(2))
        if a>99 or b>99: continue
        left=_norm(text[max(0,m.start()-260):m.start()])
        ph=left.rfind(hn); pa=left.rfind(an)
        if ph>=0 and pa>=0:
            return f"{a}-{b}" if ph<pa else f"{b}-{a}"
        around=_norm(text[max(0,m.start()-220):m.end()+220])
        if hn in around and an in around: return f"{a}-{b}"
    return None


def _ht_score(text:str,home:str,away:str)->str|None:
    if not (_name_present(text,home) and _name_present(text,away)): return None
    for pat in [r"(?:HT|half\s*time|half-time|1st\s*half|first\s*half|ilk\s*yari)\D{0,30}(\d{1,2})\s*[-:]\s*(\d{1,2})",r"\(\s*HT\s*(\d{1,2})\s*[-:]\s*(\d{1,2})\s*\)"]:
        m=re.search(pat,text,re.I)
        if m: return f"{int(m.group(1))}-{int(m.group(2))}"
    return None


def _domain(url:str)->str:
    try: return urllib.parse.urlparse(url).netloc.casefold().removeprefix("www.")
    except Exception: return ""


def _collect(home:str,away:str,date:str,sport:str,logs:list[str],extra:str="")->list[dict[str,Any]]:
    queries=[f'"{home}" "{away}" "{date}" {sport} {extra} result score',f'"{home}" "{away}" {sport} {extra} {date}']
    seen=set(); rows=[]
    for q in queries:
        for item in _search(q,logs):
            u=item["url"]
            if u in seen: continue
            seen.add(u)
            text=(item.get("title","")+" "+item.get("snippet","")).strip()
            try:
                page=_get(u,timeout=6,max_bytes=450_000)
                text += " "+page
            except Exception: pass
            date_ok=any(v in text for v in _date_variants(date))
            rows.append({**item,"text":text,"date_ok":date_ok,"domain":_domain(u)})
            if len(rows)>=8: return rows
    return rows


def run_direct_web_fallback(home_team:str,away_team:str,target_date:str,sport:str,debug_logs:list[str],*,bet_choice:str|None=None,bet_subchoice:str|None=None)->dict[str,Any]|None:
    debug_logs.append("Son yedek 3/3: AI'siz dogrudan web arama/parser deneniyor...")
    rows=_collect(home_team,away_team,target_date,sport,debug_logs,"final")
    votes=[]; evidence=[]
    for r in rows:
        sc=_score_near(r["text"],home_team,away_team)
        if sc:
            votes.append((sc,r["domain"],r["url"],r["date_ok"]))
    by_score={}
    for sc,dom,url,date_ok in votes:
        by_score.setdefault(sc,{"domains":set(),"urls":[],"date_domains":set()})
        by_score[sc]["domains"].add(dom); by_score[sc]["urls"].append(url)
        if date_ok: by_score[sc]["date_domains"].add(dom)
    if by_score:
        best=max(by_score.items(),key=lambda kv:(len(kv[1]["date_domains"]),len(kv[1]["domains"])))
        sc,info=best
        urls=list(dict.fromkeys(info["urls"]))[:5]
        strong=len(info["domains"])>=2 and len(info["date_domains"])>=1
        conf=0.9 if strong else 0.58
        debug_logs.append(f"Direkt web parser: skor adayi={sc}, farkli_domain={len(info['domains'])}, tarih_kaniti={len(info['date_domains'])}.")
        common={"sport":sport,"source":"Direct Web Search (AI'siz)","source_url":urls[0] if urls else "","web_source_urls":urls,"matched_home":home_team,"matched_away":away_team,"ai_answer":f"AI kullanmadan web arama sonucunda {sc} skor adayi bulundu.","ai_confidence":conf,"ai_model":"Token-free web parser","debug_logs":debug_logs}
        if strong:
            return {**common,"status":"OK","score":sc,"corners":{"home":0,"away":0},"ht_score":None,"ht_corners":None,"goals":[],"events":[],"team_stats":{},"player_stats":{"home":[],"away":[]},"period_scores":{},"ai_web_verified":True}
        return {**common,"status":"AI_FALLBACK","score":None,"ai_detected_score":sc,"ai_notes":["Iki farkli domain/tarih kaniti settlement esigini saglamadi."],"ai_web_verified":False}
    debug_logs.append("Direkt web parser: ayni maca ait guvenilir skor kaniti bulunamadi.")
    return None


def enrich_match_data_with_direct_web(match_data:dict[str,Any],home_team:str,away_team:str,target_date:str,sport:str,debug_logs:list[str],*,bet_choice:str|None=None,bet_subchoice:str|None=None,stats_view:str|None=None,missing_hint:str|None=None)->dict[str,Any]|None:
    if not isinstance(match_data,dict) or match_data.get("status")!="OK": return None
    need_ht = not match_data.get("ht_score") and ("1. yar" in _norm((bet_choice or "")+" "+(missing_hint or "")) or "half" in _norm(missing_hint or ""))
    if not need_ht: return None
    debug_logs.append("AI'siz web parser: eksik 1. yari skoru icin son kontrol yapiliyor...")
    rows=_collect(home_team,away_team,target_date,sport,debug_logs,"half time HT first half")
    votes=[]
    for r in rows:
        sc=_ht_score(r["text"],home_team,away_team)
        if sc: votes.append((sc,r["domain"],r["url"],r["date_ok"]))
    if not votes: return None
    counts={}
    for sc,dom,url,date_ok in votes:
        d=counts.setdefault(sc,{"domains":set(),"urls":[],"date":set()}); d["domains"].add(dom); d["urls"].append(url); d["date"].add(dom) if date_ok else None
    sc,info=max(counts.items(),key=lambda kv:(len(kv[1]["date"]),len(kv[1]["domains"])))
    if len(info["domains"])>=2 and len(info["date"])>=1:
        match_data["ht_score"]=sc
        match_data.setdefault("web_source_urls",[])
        for u in info["urls"]:
            if u not in match_data["web_source_urls"]: match_data["web_source_urls"].append(u)
        match_data.setdefault("ai_enrichment_sources",[]).append("Direct Web Search")
        debug_logs.append(f"AI'siz web parser iki farkli domain ile 1. yari skorunu dogruladi: {sc}.")
        return match_data
    return None
