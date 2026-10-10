import tkinter as tk
from tkinter import ttk
import os
import sys
import io
import re
import json
import hashlib
import tempfile
import threading
import queue
import traceback
import unicodedata
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path
from datetime import datetime

try:
    from PIL import Image, ImageTk
except ImportError:
    Image = None
    ImageTk = None

try:
    from curl_cffi import requests as browser_requests
except ImportError:
    browser_requests = None


try:
    from fetchers.scraper import (
        fetch_flashscore_data_multi_source,
        enrich_match_data_with_all_real_sources,
    )
except ImportError:
    fetch_flashscore_data_multi_source = None
    enrich_match_data_with_all_real_sources = None

try:
    from sports_config import (
        SPORT_OPTIONS,
        get_bet_options_for_sport,
        get_participant_labels,
    )
except ImportError:
    SPORT_OPTIONS = ["Futbol"]
    def get_bet_options_for_sport(sport, football_options):
        return list(football_options)
    def get_participant_labels(sport):
        return ("Ev Sahibi Takım:", "Deplasman Takımı:")

try:
    from market_options import get_market_suboptions
except ImportError:
    def get_market_suboptions(market, home, away, sport='Futbol'):
        return ["Diğer / El ile Gir..."]

try:
    from analyzer import explain_bet
except ImportError:
    def explain_bet(match_info, bet_choice, bet_subchoice=None):
        return (f"Maç başarıyla çekildi!\\nSkor: {match_info['score']}\\n"
                f"Kornerler: Ev {match_info['corners']['home']} - Dep {match_info['corners']['away']}")



try:
    from groq_web_fallback import enrich_match_data_with_groq
except ImportError:
    enrich_match_data_with_groq = None

try:
    from puter_web_fallback import enrich_match_data_with_puter
except ImportError:
    enrich_match_data_with_puter = None

try:
    from direct_web_fallback import enrich_match_data_with_direct_web
except ImportError:
    enrich_match_data_with_direct_web = None

BET_OPTIONS = ['Maç Sonucu, Normal Süre (1X2)', 'Üst/Alt, Normal Süre', 'Karşılıklı Gol, Normal Süre', 'Beraberlikte İade, Normal Süre', 'Çifte Şans, Normal Süre', 'Maçın Kazananı Ve Toplam Skor, Normal Süre', 'İlk Yarı / Maç Sonucu, Normal Süre', 'Maç Sonucu, 1. Yarı', 'Maç Sonucu, 2. Yarı', 'Golü Atacak Takım, Normal Süre', 'Maçın Kazananı & Karşılıklı Gol (3 İhtimalli), Normal Süre', 'Asya Handikapı, Normal Süre', 'Handikap, Normal Süre', 'Doğru Skor, Normal Süre', 'Herhangi Bir Zamanda Gol Atan, Normal Süre', 'Asya Handikapı, 2. Yarı', 'Asya Handikapı, 1. Yarı', 'Karşılıklı Gol İlk Yarı/İkinci Yarı, Normal Süre', 'Karşılıklı Gol Ve Toplamlar (4-İhtimalli), Normal Süre', 'Her İki Takımda Gol Atar ve En Çok Skor Olan Yarı, Normal Süre', 'Karşılıklı Gol, 1. Yarı', 'Karşılıklı Gol, 2. Yarı', 'Her İki Takım da En Az 2 Gol Atar, Normal Süre', 'İki Yarıda Da Karşılıklı Gol Olur, Normal Süre', 'Karşılıklı Gol Olur veya 2.5 Üst Maçtaki Goller, Normal Süre', 'Korner Üst/Alt, 1. Yarı', 'Korner Üst/Alt, 2. Yarı', 'Korner Üst/Alt, Normal Süre', 'Goller Üst/Alt Zaman Aralığında, Normal Süre', 'Hangi Yarı Daha Çok Skor Olur, Normal Süre', 'Korner Sayısı, Normal Süre', 'Skor Üst/Alt, 1. Yarı', 'Skor Üst/Alt, 2. Yarı', 'Skor Üst/Alt, Normal Süre', 'Gol Atar, Normal Süre', 'Sıfıra Karşı Kazanma, 1. Yarı', 'Sıfıra Karşı Kazanma, 2. Yarı', 'Sıfıra Karşı Kazanma, Normal Süre', 'Toplam Skoru, 1. Yarı', 'Toplam Skoru, 2. Yarı', 'Toplam Skoru, Normal Süre', 'Takım Toplam Skoru 1. Yarı/2. Yarı, Normal Süre', 'Deplasman İade, 1. Yarı', 'Deplasman İade, Normal Süre', 'Gol Yemeyen Takım, 1. Yarı', 'Gol Yemeyen Takım, Normal Süre', 'Geriden Gelip Kazanma, Normal Süre', 'Korner 1, Normal Süre', 'Korner Asya Handikapı, Normal Süre', 'Korner Asya Handikapı, 1. Yarı', 'Korner Handikapı, Normal Süre', 'Korner Handikapı, 1. Yarı', 'Korner Tek/Çift, 1. Yarı', 'Korner Tek/Çift, 2. Yarı', 'Korner Tek/Çift, Normal Süre', 'Doğru Skor, 1. Yarı', 'Doğru Skor, 2. Yarı', 'Çifte Şans & Karşılıklı Gol (6-İhtimalli), 1. Yarı', 'Çifte Şans & Karşılıklı Gol (6-İhtimalli), Normal Süre', 'Çifte Şans & Üst/Alt 1.5, Normal Süre', 'Çifte Şans & Üst/Alt 2.5, Normal Süre', 'Çifte Şans & Üst/Alt 3.5, Normal Süre', 'Çifte Şans & Üst/Alt 4.5, Normal Süre', 'Çifte Şans ve Toplam Skor, Normal Süre', 'Çifte Şans ve En Çok Skor Olan Yarı, Normal Süre', 'Çifte Şans, 1. Yarı', 'Çifte Şans, 2. Yarı', 'Beraberlikte İade, 1. Yarı', 'Beraberlikte İade, 2. Yarı', 'Her İki Yarıda Da Gol, Normal Süre', 'İlk Yarı / Maç Sonucu Hariç, Normal Süre', 'İlk Yarı / Maç Sonucu Çifte Şans, Normal Süre', 'İlk Yarı Veya Maç Sonucu, Normal Süre', 'İlk Yarı / Maç Sonucu & Karşılıklı Gol, Normal Süre', 'İlk Yarı / Maç Sonucu & Üst/Alt 1.5, Normal Süre', 'İlk Yarı / Maç Sonucu & Üst/Alt 2.5, Normal Süre', 'İlk Yarı / Maç Sonucu & Üst/Alt 3.5, Normal Süre', 'Zaman Aralığında Kim Kazanır?, Normal Süre', 'Handikap, 1. Yarı', 'Handikap, 2. Yarı', 'Son Golü Atan, Normal Süre', 'Son Golü Atan Takım, Normal Süre', 'Maç Bahsi & Skor Yapan Takım 1, Normal Süre', 'Maç Bahsi Ve Karşılıklı Gol (6-İhtimalli), 1. Yarı', 'Maç Bahsi Ve Karşılıklı Gol (6-İhtimalli), 2. Yarı', 'Maç Bahsi Ve Karşılıklı Gol (6-İhtimalli), Normal Süre', 'Kim Kazanır ve Takım Skoru Üst/Alt, Normal Süre', 'Kim Kazanır ve En Çok Skor Olan Yarı, Normal Süre', 'Kim Kazanır ve Toplam Skor, Normal Süre', 'Maçın Kazananı Ve Toplam Skor, 1. Yarı', 'Kim Kazanır veya Her İki Takım Da Gol Atar, Normal Süre', 'Kim Kazanır veya Üst/Alt, Normal Süre', 'En Çok Korner, 1. Yarı', 'En Çok Korner, Normal Süre', 'Çoklu Bahis Doğru Skor, Normal Süre', 'Skor Yapan Takım Sayısı, 1. Yarı', 'Skor Yapan Takım Sayısı, Normal Süre', 'Korner Sayısı, 1. Yarı', 'Korner Sayısı, 2. Yarı', 'Tek/Çift, 1. Yarı', 'Tek/Çift, 2. Yarı', 'Tek/Çift, Normal Süre', 'Ev Sahibi İade, 1. Yarı', 'Ev Sahibi İade, Normal Süre', 'Üst/Alt, 1. Yarı', 'Üst/Alt, 2. Yarı', 'Golü Atacak Oyuncu, Normal Süre', 'Her İki Yarıda Da Gol Atacak Oyuncu, Normal Süre', 'X Gole/Kornere Ulaşma, Normal Süre', 'Her İki Yarıda Da Skor Yapma, Normal Süre', 'Her İki Yarıyı Kazanma, Normal Süre', 'Herhangi Yarıyı Kazanma, Normal Süre', 'Skor Yapan Takımlar, Normal Süre', 'Her İki Yarıda Da Kazanma ve Üst/Alt, Normal Süre', 'Her İki Yarıda Da Kazanma ve Sıfıra Karşı Kazanma, Normal Süre', 'Her İki Yarıyı Da Kazanma, Normal Süre', 'Herhangi Bir Yarıyı Kazanma, Normal Süre', 'Toplam Goller, 1. Yarı', 'Toplam Goller, Normal Süre', 'Toplam Goller, 2. Yarı', 'Toplam Skor 1. Yarı/2. Yarı, Normal Süre', 'Toplam Skor Hariç, Normal Süre', 'Belirli Dakikadan Sonra Gol Olur mu?, Normal Süre', 'Kazanç Marjini, Normal Süre', 'Diğer / El ile Gir...']

STAT_VIEW_OPTIONS = [
    "Kapalı",
    "Takım İstatistikleri - Toplam",
    "Takım İstatistikleri - 1. Yarı",
    "Takım İstatistikleri - 2. Yarı",
    "Oyuncu İstatistikleri",
]

ESPORT_STAT_VIEW_OPTIONS = [
    "Kapalı",
    "E-Spor Özeti",
]

GENERIC_SPORT_STAT_VIEW_OPTIONS = [
    "Kapalı",
    "Karşılaşma Özeti",
]

STAT_DISPLAY_ORDER = [
    ("total_shots", "Toplam şut"),
    ("shots_on_target", "İsabetli şut"),
    ("corners", "Kornerler"),
    ("yellow_cards", "Sarı kart"),
    ("shots_off_target", "İsabetsiz şut"),
    ("blocked_shots", "Engellenen şut"),
    ("shots_inside_box", "Ceza sahası içinden şut"),
    ("shots_outside_box", "Ceza sahası dışından şut"),
    ("hit_woodwork", "Direkten dönen şutlar"),
    ("headed_goals", "Kafa golleri"),
    ("touches_opposition_box", "Rakip ceza sahasında topla buluşma"),
    ("accurate_passes", "İsabetli pas"),
    ("offsides", "Ofsayt"),
    ("free_kicks", "Serbest vuruşlar"),
    ("throw_ins", "Taçlar"),
    ("fouls", "Fauller"),
    ("tackles", "Müdahale"),
    ("duels_won", "Kazanılan ikili mücadele"),
    ("goalkeeper_saves", "Kaleci kurtarışları"),
    ("goals_prevented", "Engellenen gol"),
    ("goal_kicks", "Aut atışları"),
]



def _mix_hex(color_a, color_b, ratio):
    """İki HEX rengi basitçe karıştırır."""
    ratio = max(0.0, min(1.0, float(ratio)))

    def rgb(value):
        value = value.lstrip("#")
        return tuple(
            int(value[i:i+2], 16)
            for i in (0, 2, 4)
        )

    a = rgb(color_a)
    b = rgb(color_b)
    mixed = tuple(
        round(x + (y - x) * ratio)
        for x, y in zip(a, b)
    )
    return "#{:02x}{:02x}{:02x}".format(*mixed)


class GlowHeading(tk.Canvas):
    """Gölge + parlak alt çizgili hafif efektli başlık."""

    def __init__(
        self,
        master,
        text,
        *,
        bg,
        fg,
        accent,
        font=("Segoe UI", 18, "bold"),
        height=40,
        width=620,
        neon=False,
    ):
        super().__init__(
            master,
            bg=bg,
            height=height,
            width=width,
            bd=0,
            highlightthickness=0,
        )
        self._text = text
        self._bg = bg
        self._fg = fg
        self._accent = accent
        self._font = font
        self._neon = neon
        self.bind("<Configure>", self._redraw)
        self.after_idle(self._redraw)

    def _redraw(self, event=None):
        self.delete("all")
        width = max(220, self.winfo_width())
        height = max(28, self.winfo_height())

        # Başlığa çok hafif bir gölge / glow.
        if self._neon:
            self.create_text(
                3,
                height // 2 - 4,
                text=self._text,
                anchor="w",
                font=self._font,
                fill=_mix_hex(self._accent, self._bg, 0.65),
            )

        self.create_text(
            1,
            height // 2 - 6,
            text=self._text,
            anchor="w",
            font=self._font,
            fill=self._fg,
        )

        # Başlığın altında soldan sağa incelen modern vurgu çizgisi.
        line_y = height - 4
        max_line = min(width - 8, 360)

        for i in range(24):
            x1 = int((max_line / 24) * i)
            x2 = int((max_line / 24) * (i + 1)) + 1
            fade = i / 23
            color = _mix_hex(
                self._accent,
                self._bg,
                fade * 0.90,
            )
            self.create_rectangle(
                x1,
                line_y,
                x2,
                line_y + (2 if i < 8 else 1),
                fill=color,
                outline="",
            )


class ModernActionButton(tk.Canvas):
    """
    Rounded, hover/parlama ve press efekti olan Canvas button.
    Tk Button gibi .config(state=..., text=...) destekler.
    """

    def __init__(
        self,
        master,
        *,
        text,
        command,
        bg,
        accent,
        accent_hover,
        text_color="#ffffff",
        disabled_color="#334155",
        height=56,
        font=("Segoe UI", 11, "bold"),
    ):
        super().__init__(
            master,
            height=height,
            bg=bg,
            bd=0,
            highlightthickness=0,
            cursor="hand2",
        )
        self._text = text
        self._command = command
        self._parent_bg = bg
        self._accent = accent
        self._accent_hover = accent_hover
        self._text_color = text_color
        self._disabled_color = disabled_color
        self._font = font
        self._state = "normal"
        self._hover = False
        self._pressed = False

        self.bind("<Configure>", self._draw)
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)
        self.bind("<ButtonPress-1>", self._on_press)
        self.bind("<ButtonRelease-1>", self._on_release)
        self.after_idle(self._draw)

    @staticmethod
    def _rounded_points(x1, y1, x2, y2, radius):
        r = max(2, min(radius, (x2 - x1) // 2, (y2 - y1) // 2))
        return [
            x1 + r, y1,
            x2 - r, y1,
            x2, y1,
            x2, y1 + r,
            x2, y2 - r,
            x2, y2,
            x2 - r, y2,
            x1 + r, y2,
            x1, y2,
            x1, y2 - r,
            x1, y1 + r,
            x1, y1,
        ]

    def _rounded_rect(self, x1, y1, x2, y2, radius, **kwargs):
        return self.create_polygon(
            self._rounded_points(x1, y1, x2, y2, radius),
            smooth=True,
            splinesteps=18,
            **kwargs,
        )

    def _draw(self, event=None):
        self.delete("all")

        width = max(80, self.winfo_width())
        height = max(42, self.winfo_height())
        press_shift = 2 if self._pressed else 0

        if self._state == "disabled":
            fill = self._disabled_color
            glow = _mix_hex(self._disabled_color, self._parent_bg, 0.35)
            fg = _mix_hex(self._text_color, self._parent_bg, 0.35)
        else:
            fill = self._accent_hover if self._hover else self._accent
            glow = (
                _mix_hex(self._accent_hover, "#ffffff", 0.22)
                if self._hover
                else _mix_hex(self._accent, self._parent_bg, 0.25)
            )
            fg = self._text_color

        # Soft shadow.
        self._rounded_rect(
            6,
            8 + press_shift,
            width - 6,
            height - 3 + press_shift,
            13,
            fill="#050b14",
            outline="",
        )

        # Hover glow / dış kontur.
        if self._hover and self._state != "disabled":
            self._rounded_rect(
                2,
                2 + press_shift,
                width - 2,
                height - 7 + press_shift,
                14,
                fill="",
                outline=_mix_hex(glow, "#ffffff", 0.10),
                width=2,
            )

        # Main rounded surface.
        self._rounded_rect(
            4,
            4 + press_shift,
            width - 4,
            height - 8 + press_shift,
            13,
            fill=fill,
            outline=glow,
            width=1,
        )

        # Üstte hafif cam/parlaklık çizgisi.
        gloss = _mix_hex(fill, "#ffffff", 0.24)
        self.create_line(
            20,
            8 + press_shift,
            width - 20,
            8 + press_shift,
            fill=gloss,
            width=1,
        )

        # Sol küçük enerji noktası.
        dot_x = 24
        dot_y = (height - 4) // 2 + press_shift
        dot_color = "#d9f7ff" if self._state != "disabled" else "#64748b"
        self.create_oval(
            dot_x - 4,
            dot_y - 4,
            dot_x + 4,
            dot_y + 4,
            fill=dot_color,
            outline="",
        )

        self.create_text(
            width // 2,
            (height - 5) // 2 + press_shift,
            text=self._text,
            fill=fg,
            font=self._font,
            anchor="center",
        )

    def _on_enter(self, event=None):
        if self._state == "disabled":
            return
        self._hover = True
        self._draw()

    def _on_leave(self, event=None):
        self._hover = False
        self._pressed = False
        self._draw()

    def _on_press(self, event=None):
        if self._state == "disabled":
            return
        self._pressed = True
        self._draw()

    def _on_release(self, event=None):
        if self._state == "disabled":
            return

        was_pressed = self._pressed
        self._pressed = False
        self._draw()

        if (
            was_pressed
            and event is not None
            and 0 <= event.x <= self.winfo_width()
            and 0 <= event.y <= self.winfo_height()
            and callable(self._command)
        ):
            self._command()

    def config(self, cnf=None, **kwargs):
        # Tk widget uyumluluğu.
        if cnf:
            kwargs.update(cnf)

        if "text" in kwargs:
            self._text = kwargs.pop("text")

        if "state" in kwargs:
            self._state = kwargs.pop("state")
            self.configure(
                cursor=(
                    "arrow"
                    if self._state == "disabled"
                    else "hand2"
                )
            )

        if "command" in kwargs:
            self._command = kwargs.pop("command")

        if kwargs:
            super().config(**kwargs)

        self._draw()

    configure = config


class RoundedSurface(tk.Canvas):
    """İçine widget alınabilen yumuşak köşeli premium yüzey."""

    def __init__(
        self,
        master,
        *,
        bg,
        fill,
        border,
        radius=18,
        padding=1,
        shadow=True,
        shadow_color="#030814",
    ):
        super().__init__(
            master,
            bg=bg,
            bd=0,
            highlightthickness=0,
            relief="flat",
        )
        self._fill = fill
        self._border = border
        self._radius = radius
        self._padding = padding
        self._shadow = shadow
        self._shadow_color = shadow_color
        self.body = tk.Frame(self, bg=fill, bd=0, highlightthickness=0)
        self._body_window = self.create_window(0, 0, anchor="nw", window=self.body)
        self.bind("<Configure>", self._redraw)
        self.after_idle(self._redraw)

    @staticmethod
    def _rounded_points(x1, y1, x2, y2, radius):
        radius = max(2, min(radius, (x2 - x1) // 2, (y2 - y1) // 2))
        return [
            x1 + radius, y1,
            x2 - radius, y1,
            x2, y1,
            x2, y1 + radius,
            x2, y2 - radius,
            x2, y2,
            x2 - radius, y2,
            x1 + radius, y2,
            x1, y2,
            x1, y2 - radius,
            x1, y1 + radius,
            x1, y1,
        ]

    def _rounded_rect(self, x1, y1, x2, y2, radius, **kwargs):
        return self.create_polygon(
            self._rounded_points(x1, y1, x2, y2, radius),
            smooth=True,
            splinesteps=18,
            **kwargs,
        )

    def _redraw(self, event=None):
        self.delete("surface")
        width = max(40, self.winfo_width())
        height = max(30, self.winfo_height())

        if self._shadow:
            self._rounded_rect(
                5,
                6,
                width - 5,
                height - 2,
                self._radius,
                fill=self._shadow_color,
                outline="",
                tags="surface",
            )

        self._rounded_rect(
            2,
            2,
            width - 2,
            height - 5,
            self._radius,
            fill=self._fill,
            outline=self._border,
            width=1,
            tags="surface",
        )

        top_gloss = _mix_hex(self._fill, "#ffffff", 0.12)
        self.create_line(
            18,
            9,
            max(18, width - 18),
            9,
            fill=top_gloss,
            width=1,
            tags="surface",
        )

        self.coords(self._body_window, self._padding, self._padding)
        self.itemconfigure(
            self._body_window,
            width=max(10, width - (self._padding * 2)),
            height=max(10, height - (self._padding * 2) - 3),
        )
        self.tag_lower("surface")


class TeamBadge(tk.Canvas):
    """Premium skor kartı için internetten logo gösterebilen takım rozeti."""

    def __init__(self, master, *, bg, accent, size=48):
        super().__init__(
            master,
            width=size,
            height=size,
            bg=bg,
            bd=0,
            highlightthickness=0,
        )
        self._bg = bg
        self._accent = accent
        self._size = size
        self._name = "?"
        self._photo = None
        self._draw_fallback()

    def set_name(self, name):
        self._name = str(name or "?").strip() or "?"
        self._photo = None
        self._draw_fallback()

    def set_logo_bytes(self, image_bytes):
        """Ana Tk thread'inde çağrılır; gerçek takım logosunu şeffaf olarak çizer."""
        if not image_bytes or Image is None or ImageTk is None:
            self._draw_fallback()
            return False

        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
            bbox = image.getchannel("A").getbbox()
            if bbox:
                image = image.crop(bbox)
            max_side = max(24, self._size - 6)
            image.thumbnail((max_side, max_side), Image.LANCZOS)
            self._photo = ImageTk.PhotoImage(image)
            self.delete("all")
            # Gerçek logo geldiğinde ekstra daire/rozet basma; logo kendi şeffaflığıyla görünür.
            self.create_image(
                self._size // 2,
                self._size // 2,
                image=self._photo,
                anchor="center",
            )
            return True
        except Exception:
            self._photo = None
            self._draw_fallback()
            return False

    def _initials(self):
        cleaned = self._name.replace("&", " ").replace("-", " ")
        words = [w for w in cleaned.split() if w and not w.startswith("(")]
        if not words:
            return "?"
        if len(words) == 1:
            return words[0][:2].upper()
        return (words[0][0] + words[-1][0]).upper()

    def _draw_fallback(self):
        self.delete("all")
        s = self._size
        self.create_oval(3, 3, s - 3, s - 3, fill="#102847", outline=self._accent, width=2)
        self.create_oval(9, 9, s - 9, s - 9, fill="#15355c", outline="#315780", width=1)
        self.create_text(
            s // 2,
            s // 2,
            text=self._initials(),
            font=("Segoe UI", max(10, int(s * 0.26)), "bold"),
            fill="#f7d486",
        )


class FootballAnalyzerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Spor Karşılaşması Veri Çekme ve Analiz Paneli")

        self.colors = {
            "bg": "#061121",
            "sidebar": "#08111f",
            "panel": "#0a1830",
            "card": "#0d203c",
            "field": "#081727",
            "border": "#1b3557",
            "text": "#edf4ff",
            "muted": "#8ea5c3",
            "accent": "#1ec8ff",
            "accent_hover": "#3ed7ff",
            "gold": "#f2c46d",
            "gold_hover": "#ffd58a",
            "green": "#39ff88",
            "success": "#22c55e",
            "console": "#03080d",
            "console_glass": "#0a1b2f",
            "console_glass_border": "#2a5276",
            "warning": "#f6c453",
            "danger": "#ff5f6d",
        }

        self.root.configure(bg=self.colors["bg"])
        self.root.minsize(1180, 700)

        # Açılışta ekranı doldur.
        self.root.after(30, self._maximize_window)

        # F11: gerçek tam ekran | ESC: tam ekrandan çık.
        self._fullscreen = False
        self.root.bind("<F11>", self._toggle_fullscreen)
        self.root.bind("<Escape>", self._exit_fullscreen)
        self.root.bind("<Control-Return>", lambda event: self.run_analysis())

        # ---------------------------------------------------------------
        # MODERN TTK STİLİ
        # ---------------------------------------------------------------
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        style.configure(
            "Modern.TCombobox",
            fieldbackground=self.colors["field"],
            background=self.colors["field"],
            foreground=self.colors["text"],
            arrowcolor=self.colors["accent"],
            bordercolor=self.colors["border"],
            lightcolor=self.colors["border"],
            darkcolor=self.colors["border"],
            padding=5,
            relief="flat",
        )
        style.map(
            "Modern.TCombobox",
            fieldbackground=[
                ("readonly", self.colors["field"]),
                ("disabled", self.colors["panel"]),
            ],
            foreground=[
                ("readonly", self.colors["text"]),
                ("disabled", self.colors["muted"]),
            ],
            bordercolor=[
                ("focus", self.colors["accent"]),
                ("!focus", self.colors["border"]),
            ],
        )

        style.configure(
            "Modern.Vertical.TScrollbar",
            background=self.colors["panel"],
            troughcolor=self.colors["console"],
            bordercolor=self.colors["console"],
            arrowcolor=self.colors["muted"],
            relief="flat",
        )

        self.root.option_add(
            "*TCombobox*Listbox.background",
            self.colors["field"]
        )
        self.root.option_add(
            "*TCombobox*Listbox.foreground",
            self.colors["text"]
        )
        self.root.option_add(
            "*TCombobox*Listbox.selectBackground",
            self.colors["accent_hover"]
        )
        self.root.option_add(
            "*TCombobox*Listbox.selectForeground",
            "#ffffff"
        )

        self.result_queue = queue.Queue()
        self.logo_queue = queue.Queue()
        self.worker_thread = None
        self._team_logo_memory_cache = {}
        self._team_logo_request_ids = {"home": 0, "away": 0}
        cache_root = os.environ.get("LOCALAPPDATA") or tempfile.gettempdir()
        self._team_logo_cache_dir = os.path.join(cache_root, "HizirBeySports", "team_logos")
        try:
            os.makedirs(self._team_logo_cache_dir, exist_ok=True)
        except OSError:
            self._team_logo_cache_dir = tempfile.gettempdir()

        # ---------------------------------------------------------------
        # ANA KABUK / MODERN DASHBOARD
        # ---------------------------------------------------------------
        self.result_title_var = tk.StringVar(value="Analiz Sonucu")
        self.result_market_var = tk.StringVar(value="Spor • Market")
        self.result_time_var = tk.StringVar(value="Analiz Zamanı: —")
        self.result_home_var = tk.StringVar(value="Ev Sahibi")
        self.result_away_var = tk.StringVar(value="Deplasman")
        self.result_home_role_var = tk.StringVar(value="Ev Sahibi")
        self.result_away_role_var = tk.StringVar(value="Deplasman")
        self.result_score_var = tk.StringVar(value="—  :  —")
        self.result_bet_var = tk.StringVar(value="Henüz seçim yapılmadı")
        self.result_bet_sub_var = tk.StringVar(value="Bahis seçimi bekleniyor")
        self.result_status_var = tk.StringVar(value="HAZIR")
        self.result_status_sub_var = tk.StringVar(value="Analiz bekleniyor")
        self.result_corners_var = tk.StringVar(value="Ev — | Dep —")
        self.result_source_var = tk.StringVar(value="Kaynak bekleniyor")
        self.result_source_url_var = tk.StringVar(value="")
        self.result_analysis_var = tk.StringVar(
            value="Karşılaşma analizi henüz üretilmedi. Sol panelden bilgileri girip analizi başlatabilirsin."
        )

        # Kalıcı geçmiş ve sayfa durumu
        data_root = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA")
        if data_root:
            self._app_data_dir = os.path.join(data_root, "HizirBeySports")
        else:
            self._app_data_dir = os.path.join(str(Path.home()), ".hizirbey_sports")
        try:
            os.makedirs(self._app_data_dir, exist_ok=True)
        except OSError:
            self._app_data_dir = tempfile.gettempdir()
        self._history_path = os.path.join(self._app_data_dir, "analysis_history.json")
        self._history_records = self._load_history_records()
        self._active_page = "home"
        self._logs_expanded = False
        self.sidebar_buttons = {}

        app_shell = tk.Frame(root, bg=self.colors["bg"])
        app_shell.pack(fill="both", expand=True, padx=12, pady=10)

        # ---------------------------------------------------------------
        # SOL MENÜ — yalnız gerekli ekranlar
        # ---------------------------------------------------------------
        sidebar = tk.Frame(
            app_shell,
            bg=self.colors["sidebar"],
            width=92,
            highlightthickness=1,
            highlightbackground=self.colors["border"]
        )
        sidebar.pack(side="left", fill="y", padx=(0, 12))
        sidebar.pack_propagate(False)

        self.sidebar_badge_image = self._load_asset_image("premium_app_badge.png", (52, 52))
        if self.sidebar_badge_image is not None:
            tk.Label(
                sidebar,
                image=self.sidebar_badge_image,
                bg=self.colors["sidebar"],
                bd=0,
                highlightthickness=0,
            ).pack(pady=(14, 8))
        else:
            tk.Label(
                sidebar,
                text="📊",
                font=("Segoe UI Emoji", 26),
                bg=self.colors["sidebar"],
                fg=self.colors["gold"]
            ).pack(pady=(18, 8))

        def create_sidebar_button(key, text):
            button = tk.Button(
                sidebar,
                text=text,
                font=("Segoe UI", 10, "bold"),
                bg=self.colors["sidebar"],
                fg=self.colors["muted"],
                activebackground=self.colors["card"],
                activeforeground=self.colors["gold"],
                relief="flat",
                bd=0,
                padx=6,
                pady=12,
                cursor="hand2",
                justify="center",
                wraplength=62,
                command=lambda page=key: self._show_page(page),
                highlightthickness=0,
            )
            button.pack(fill="x", padx=10, pady=5)
            self.sidebar_buttons[key] = button
            return button

        create_sidebar_button("home", "🏠\nAna Sayfa")
        create_sidebar_button("analysis", "📈\nAnaliz")
        create_sidebar_button("history", "🕘\nGeçmiş")

        self.sidebar_brand_image = self._load_asset_image(
            "hizir_bey_transparent.png",
            (68, 62),
        )
        if self.sidebar_brand_image is not None:
            tk.Label(
                sidebar,
                image=self.sidebar_brand_image,
                bg=self.colors["sidebar"],
                bd=0,
                highlightthickness=0,
            ).pack(side="bottom", pady=14)
        else:
            tk.Label(
                sidebar,
                text="HızırBey\nCASINO",
                font=("Segoe UI", 9, "bold"),
                bg=self.colors["sidebar"],
                fg=self.colors["gold"],
                justify="center"
            ).pack(side="bottom", pady=18)

        content = tk.Frame(app_shell, bg=self.colors["bg"])
        content.pack(side="left", fill="both", expand=True)

        # ---------------------------------------------------------------
        # ÜST BAŞLIK — geniş hero + merkezde şeffaf logo
        # ---------------------------------------------------------------
        self.header = tk.Canvas(
            content,
            bg=self.colors["panel"],
            height=116,
            bd=0,
            highlightthickness=1,
            highlightbackground=self.colors["border"]
        )
        self.header.pack(fill="x", pady=(0, 6))
        self.header.pack_propagate(False)

        self._header_art_source = None
        self._header_art_photo = None
        self._header_art_item = None
        art_path = self._resource_path("premium_header_art.png")
        if Image is not None and ImageTk is not None and os.path.exists(art_path):
            try:
                self._header_art_source = Image.open(art_path).convert("RGB")
            except Exception:
                self._header_art_source = None

        title_area = tk.Frame(self.header, bg=self.colors["panel"])
        title_area.place(x=18, y=11, width=590, height=94)
        GlowHeading(
            title_area,
            "🏆  Spor Karşılaşması Analiz Merkezi",
            bg=self.colors["panel"],
            fg=self.colors["text"],
            accent=self.colors["accent"],
            font=("Segoe UI", 20, "bold"),
            height=46,
            width=570,
            neon=True,
        ).pack(anchor="w", fill="x")
        tk.Label(
            title_area,
            text="Çoklu kaynak veri tarama  •  Bahis sonucu analizi  •  Canlı debug konsolu",
            font=("Segoe UI", 9),
            bg=self.colors["panel"],
            fg=self.colors["muted"],
            anchor="w"
        ).pack(anchor="w", pady=(6, 0))

        self.header_logo_image = self._load_header_logo()
        self._header_logo_item = None
        if self.header_logo_image is not None:
            self._header_logo_item = self.header.create_image(
                0,
                58,
                image=self.header_logo_image,
                anchor="center"
            )
        else:
            self._header_logo_item = self.header.create_text(
                0,
                58,
                text="HIZIR BEY\nCASINO",
                font=("Segoe UI", 16, "bold"),
                fill=self.colors["gold"],
                justify="center"
            )

        # Arka plansız durum yazısı: yalnızca metin.
        self._header_status_item = self.header.create_text(
            0,
            28,
            text="● HAZIR",
            font=("Segoe UI", 10, "bold"),
            fill=self.colors["green"],
            anchor="ne"
        )
        self.header.bind("<Configure>", self._redraw_header)

        # ---------------------------------------------------------------
        # SAYFA KONTEYNERİ
        # ---------------------------------------------------------------
        self.page_container = tk.Frame(content, bg=self.colors["bg"])
        self.page_container.pack(fill="both", expand=True)
        self.home_page = tk.Frame(self.page_container, bg=self.colors["bg"])
        self.history_page = tk.Frame(self.page_container, bg=self.colors["bg"])

        # ---------------------------------------------------------------
        # ANA GÖVDE
        # ---------------------------------------------------------------
        self.main_paned = tk.PanedWindow(
            self.home_page,
            orient=tk.HORIZONTAL,
            bg=self.colors["bg"],
            bd=0,
            sashwidth=10,
            sashrelief="flat",
            showhandle=False,
            opaqueresize=True,
        )
        self.main_paned.pack(fill="both", expand=True)

        left_panel = tk.Frame(
            self.main_paned,
            bg=self.colors["panel"],
            highlightthickness=1,
            highlightbackground=self.colors["border"]
        )
        right_panel = tk.Frame(
            self.main_paned,
            bg=self.colors["panel"],
            highlightthickness=1,
            highlightbackground=self.colors["border"]
        )
        self.main_paned.add(left_panel, minsize=390, stretch="always")
        self.main_paned.add(right_panel, minsize=620, stretch="always")
        self.root.after(180, self._center_panes)

        # ---------------------------------------------------------------
        # SOL PANEL — VERİ GİRİŞLERİ
        # ---------------------------------------------------------------
        left_head = tk.Frame(left_panel, bg=self.colors["panel"])
        left_head.pack(fill="x", padx=20, pady=(10, 5))

        GlowHeading(
            left_head,
            "⚙  Karşılaşma & Bahis Ayarları",
            bg=self.colors["panel"],
            fg=self.colors["text"],
            accent=self.colors["gold"],
            font=("Segoe UI", 14, "bold"),
            height=34,
            width=430,
            neon=False,
        ).pack(anchor="w", fill="x")

        tk.Label(
            left_head,
            text="Verileri gir, marketleri seç ve otomatik analizi başlat.",
            font=("Segoe UI", 9),
            bg=self.colors["panel"],
            fg=self.colors["muted"],
            anchor="w"
        ).pack(anchor="w", pady=(4, 0))

        form_card = RoundedSurface(
            left_panel,
            bg=self.colors["panel"],
            fill=self.colors["card"],
            border=self.colors["border"],
            radius=22,
            padding=1,
            shadow=True,
        )
        form_card.pack(fill="both", expand=True, padx=18, pady=(2, 5))

        form_frame = tk.Frame(form_card.body, bg=self.colors["card"])
        form_frame.pack(fill="both", expand=True, padx=20, pady=9)

        def section_label(text, color=None, top=3):
            label = tk.Label(
                form_frame,
                text=text,
                font=("Segoe UI", 9, "bold"),
                bg=self.colors["card"],
                fg=color or self.colors["muted"],
                anchor="w"
            )
            label.pack(fill="x", pady=(top, 1))
            return label

        def modern_entry(parent):
            return tk.Entry(
                parent,
                font=("Segoe UI", 10),
                bg=self.colors["field"],
                fg=self.colors["text"],
                insertbackground=self.colors["text"],
                relief="flat",
                bd=0,
                highlightthickness=1,
                highlightbackground=self.colors["border"],
                highlightcolor=self.colors["accent"],
                selectbackground="#134e71",
                selectforeground="#ffffff",
            )

        section_label("▣  Maç Tarihi (GG.AA.YYYY)", top=0)
        self.entry_date = modern_entry(form_frame)
        self.entry_date.pack(fill="x", ipady=5)
        self.entry_date.insert(0, datetime.now().strftime("%d.%m.%Y"))

        section_label("◉  Spor Dalı")
        self.combo_sport = ttk.Combobox(
            form_frame,
            font=("Segoe UI", 10),
            state="readonly",
            values=SPORT_OPTIONS,
            height=22,
            style="Modern.TCombobox"
        )
        self.combo_sport.set("Futbol")
        self.combo_sport.pack(fill="x")
        self.combo_sport.bind("<<ComboboxSelected>>", self._on_sport_selected)

        self.label_home = section_label("⌂  Ev Sahibi Takım:")
        self.entry_home = modern_entry(form_frame)
        self.entry_home.pack(fill="x", ipady=5)
        self.entry_home.bind("<KeyRelease>", self._on_team_name_changed)
        self.entry_home.bind("<FocusOut>", self._on_team_name_changed)

        self.label_away = section_label("✈  Deplasman Takımı:")
        self.entry_away = modern_entry(form_frame)
        self.entry_away.pack(fill="x", ipady=5)
        self.entry_away.bind("<KeyRelease>", self._on_team_name_changed)
        self.entry_away.bind("<FocusOut>", self._on_team_name_changed)

        section_label("◎  Bahis Seçeneği")
        self.combo_bet = ttk.Combobox(
            form_frame,
            font=("Segoe UI", 10),
            state="readonly",
            height=22,
            style="Modern.TCombobox"
        )
        self.combo_bet["values"] = get_bet_options_for_sport("Futbol", BET_OPTIONS)
        self.combo_bet.current(0)
        self.combo_bet.pack(fill="x")
        self.combo_bet.bind("<<ComboboxSelected>>", self._on_bet_selected)

        self.bet_dynamic_frame = tk.Frame(form_frame, bg=self.colors["card"])
        self.bet_dynamic_frame.pack(fill="x", pady=(0, 1))

        self.manual_bet_label = tk.Label(
            self.bet_dynamic_frame,
            text="El ile bahis seçeneği gir:",
            font=("Segoe UI", 10, "bold"),
            bg=self.colors["card"],
            fg=self.colors["warning"],
            anchor="w"
        )
        self.entry_manual_bet = modern_entry(self.bet_dynamic_frame)
        self.entry_manual_bet.bind("<KeyRelease>", self._on_manual_bet_changed)

        self.suboption_label = tk.Label(
            self.bet_dynamic_frame,
            text="▥  Bahis Alt Seçeneği:",
            font=("Segoe UI", 10, "bold"),
            bg=self.colors["card"],
            fg=self.colors["accent"],
            anchor="w"
        )
        self.combo_suboption = ttk.Combobox(
            self.bet_dynamic_frame,
            font=("Segoe UI", 10),
            state="readonly",
            height=22,
            style="Modern.TCombobox"
        )
        self.combo_suboption.bind("<<ComboboxSelected>>", self._on_suboption_selected)

        self.manual_suboption_label = tk.Label(
            self.bet_dynamic_frame,
            text="Alt seçeneği el ile gir:",
            font=("Segoe UI", 10, "bold"),
            bg=self.colors["card"],
            fg=self.colors["warning"],
            anchor="w"
        )
        self.entry_manual_suboption = modern_entry(self.bet_dynamic_frame)

        self.player_prop_frame = tk.Frame(self.bet_dynamic_frame, bg=self.colors["card"])
        self.player_name_label = tk.Label(
            self.player_prop_frame,
            text="Oyuncu adı:",
            font=("Segoe UI", 10, "bold"),
            bg=self.colors["card"],
            fg=self.colors["warning"],
            anchor="w"
        )
        self.entry_player_name = modern_entry(self.player_prop_frame)
        self.player_line_row = tk.Frame(self.player_prop_frame, bg=self.colors["card"])
        self.player_line_label = tk.Label(
            self.player_line_row,
            text="Çizgi:",
            font=("Segoe UI", 10, "bold"),
            bg=self.colors["card"],
            fg=self.colors["warning"],
            anchor="w"
        )
        self.entry_player_line = modern_entry(self.player_line_row)
        self.combo_player_side = ttk.Combobox(
            self.player_line_row,
            font=("Segoe UI", 10),
            state="readonly",
            values=("ÜST", "ALT"),
            width=8,
            height=4,
            style="Modern.TCombobox"
        )
        self.combo_player_side.current(0)

        section_label("▥  İstatistik Görünümü")
        self.combo_stats_view = ttk.Combobox(
            form_frame,
            font=("Segoe UI", 10),
            state="readonly",
            values=STAT_VIEW_OPTIONS,
            height=8,
            style="Modern.TCombobox"
        )
        self.combo_stats_view.current(0)
        self.combo_stats_view.pack(fill="x")

        self._on_bet_selected()

        self.btn_run = ModernActionButton(
            left_panel,
            text="✦  Otomatik Veri Çek ve Analiz Et",
            command=self.run_analysis,
            bg=self.colors["panel"],
            accent=self.colors["gold"],
            accent_hover=self.colors["gold_hover"],
            text_color="#ffffff",
            disabled_color="#334155",
            height=50,
            font=("Segoe UI", 11, "bold"),
        )
        self.btn_run.pack(padx=18, pady=(1, 3), fill="x")

        tk.Label(
            left_panel,
            text="Ctrl + Enter: Analizi başlat   •   F11: Tam ekran",
            font=("Segoe UI", 8),
            bg=self.colors["panel"],
            fg=self.colors["muted"]
        ).pack(pady=(0, 7))

        # ---------------------------------------------------------------
        # SAĞ PANEL — SONUÇ + AÇILIP KAPANABİLEN KONSOL
        # ---------------------------------------------------------------
        self.right_split = tk.PanedWindow(
            right_panel,
            orient=tk.VERTICAL,
            bg=self.colors["panel"],
            bd=0,
            sashwidth=7,
            sashrelief="flat",
            showhandle=False,
            opaqueresize=True,
        )
        self.right_split.pack(fill="both", expand=True)

        result_area = tk.Frame(self.right_split, bg=self.colors["panel"])
        console_outer = RoundedSurface(
            self.right_split,
            bg=self.colors["panel"],
            fill=self.colors["console_glass"],
            border=self.colors["console_glass_border"],
            radius=24,
            padding=1,
            shadow=True,
            shadow_color="#020711",
        )
        self.right_split.add(result_area, minsize=325, stretch="always")
        self.right_split.add(console_outer, minsize=125, stretch="always")

        right_head = tk.Frame(result_area, bg=self.colors["panel"])
        right_head.pack(fill="x", padx=18, pady=(10, 5))

        head_left = tk.Frame(right_head, bg=self.colors["panel"])
        head_left.pack(side="left", fill="x", expand=True)
        GlowHeading(
            head_left,
            "📄  Analiz Sonucu",
            bg=self.colors["panel"],
            fg=self.colors["text"],
            accent=self.colors["gold"],
            font=("Segoe UI", 14, "bold"),
            height=30,
            width=360,
            neon=False,
        ).pack(anchor="w", fill="x")
        tk.Label(
            head_left,
            text="Seçilen karşılaşmanın analiz sonucu ve detaylı özet bilgileri.",
            font=("Segoe UI", 9),
            bg=self.colors["panel"],
            fg=self.colors["muted"],
            anchor="w"
        ).pack(anchor="w", pady=(4, 0))

        tk.Label(
            right_head,
            textvariable=self.result_time_var,
            font=("Segoe UI", 9),
            bg=self.colors["panel"],
            fg=self.colors["muted"]
        ).pack(side="right", pady=(4, 0))

        # Temiz skor alanı: bozuk arka plan görseli kaldırıldı.
        score_card = RoundedSurface(
            result_area,
            bg=self.colors["panel"],
            fill="#07192c",
            border="#244465",
            radius=28,
            padding=1,
            shadow=True,
        )
        score_card.configure(height=174)
        score_card.pack(fill="x", padx=18, pady=(0, 10))
        score_card.body.pack_propagate(False)
        score_card.body.grid_propagate(False)
        score_card.body.grid_columnconfigure(0, weight=1, uniform="teams")
        score_card.body.grid_columnconfigure(1, weight=0)
        score_card.body.grid_columnconfigure(2, weight=1, uniform="teams")
        score_card.body.grid_rowconfigure(1, weight=1)

        tk.Frame(score_card.body, bg=self.colors["gold"], height=1).place(
            relx=0.03, rely=0.01, relwidth=0.94
        )
        tk.Label(
            score_card.body,
            textvariable=self.result_market_var,
            font=("Segoe UI", 9),
            bg="#07192c",
            fg=self.colors["muted"]
        ).grid(row=0, column=0, columnspan=3, pady=(10, 2))

        home_wrap = tk.Frame(score_card.body, bg="#07192c")
        home_wrap.grid(row=1, column=0, sticky="nsew", padx=(18, 12), pady=(2, 10))
        self.home_badge = TeamBadge(
            home_wrap,
            bg="#07192c",
            accent=self.colors["gold"],
            size=68
        )
        self.home_badge.pack(anchor="center", pady=(0, 5))
        tk.Label(
            home_wrap,
            textvariable=self.result_home_var,
            font=("Segoe UI", 15, "bold"),
            bg="#07192c",
            fg=self.colors["text"],
            justify="center",
            wraplength=260,
        ).pack(anchor="center", fill="x")
        tk.Label(
            home_wrap,
            textvariable=self.result_home_role_var,
            font=("Segoe UI", 9),
            bg="#07192c",
            fg=self.colors["muted"]
        ).pack(anchor="center", pady=(4, 0))

        score_center = RoundedSurface(
            score_card.body,
            bg="#07192c",
            fill="#0c2038",
            border="#315172",
            radius=22,
            padding=1,
            shadow=False,
        )
        score_center.configure(width=170, height=112)
        score_center.grid(row=1, column=1, sticky="n", padx=8, pady=(7, 9))
        score_center.body.pack_propagate(False)
        tk.Label(
            score_center.body,
            textvariable=self.result_score_var,
            font=("Segoe UI", 27, "bold"),
            bg="#0c2038",
            fg=self.colors["gold"]
        ).pack(expand=True, fill="both", pady=(10, 0))
        tk.Label(
            score_center.body,
            textvariable=self.result_title_var,
            font=("Segoe UI", 9),
            bg="#0c2038",
            fg=self.colors["muted"]
        ).pack(pady=(0, 9))

        away_wrap = tk.Frame(score_card.body, bg="#07192c")
        away_wrap.grid(row=1, column=2, sticky="nsew", padx=(12, 18), pady=(2, 10))
        self.away_badge = TeamBadge(
            away_wrap,
            bg="#07192c",
            accent=self.colors["gold"],
            size=68
        )
        self.away_badge.pack(anchor="center", pady=(0, 5))
        tk.Label(
            away_wrap,
            textvariable=self.result_away_var,
            font=("Segoe UI", 15, "bold"),
            bg="#07192c",
            fg=self.colors["text"],
            justify="center",
            wraplength=260,
        ).pack(anchor="center", fill="x")
        tk.Label(
            away_wrap,
            textvariable=self.result_away_role_var,
            font=("Segoe UI", 9),
            bg="#07192c",
            fg=self.colors["muted"]
        ).pack(anchor="center", pady=(4, 0))

        info_grid = tk.Frame(result_area, bg=self.colors["panel"])
        info_grid.pack(fill="x", padx=18, pady=(0, 10))
        for col in range(3):
            info_grid.grid_columnconfigure(col, weight=1)

        def info_card(parent, title, value_var, sub_var=None):
            card = RoundedSurface(
                parent,
                bg=self.colors["panel"],
                fill=self.colors["card"],
                border=self.colors["border"],
                radius=24,
                padding=1,
                shadow=True,
            )
            head = tk.Label(
                card.body,
                text=title,
                font=("Segoe UI", 9, "bold"),
                bg=self.colors["card"],
                fg=self.colors["muted"],
                anchor="w"
            )
            head.pack(fill="x", padx=12, pady=(7, 2))
            value = tk.Label(
                card.body,
                textvariable=value_var,
                font=("Segoe UI", 14, "bold"),
                bg=self.colors["card"],
                fg=self.colors["text"],
                anchor="w",
                justify="left",
                wraplength=220
            )
            value.pack(fill="x", padx=12)
            if sub_var is not None:
                sub = tk.Label(
                    card.body,
                    textvariable=sub_var,
                    font=("Segoe UI", 9),
                    bg=self.colors["card"],
                    fg=self.colors["muted"],
                    anchor="w",
                    justify="left",
                    wraplength=220
                )
                sub.pack(fill="x", padx=12, pady=(2, 6))
            else:
                sub = None
                tk.Frame(card.body, height=6, bg=self.colors["card"]).pack()
            return card, value, sub

        self.card_selected, _, _ = info_card(
            info_grid,
            "SEÇİLEN BAHİS",
            self.result_bet_var,
            self.result_bet_sub_var
        )
        self.card_selected.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        self.card_status, self.card_status_value, self.card_status_sub = info_card(
            info_grid,
            "BAHİS SONUCU",
            self.result_status_var,
            self.result_status_sub_var
        )
        self.card_status.grid(row=0, column=1, sticky="nsew", padx=4)
        self.status_icon_label = tk.Label(
            self.card_status.body,
            text="●",
            font=("Segoe UI Symbol", 20, "bold"),
            bg=self.colors["card"],
            fg=self.colors["muted"],
        )
        self.status_icon_label.place(relx=0.88, rely=0.54, anchor="center")
        self.card_corners, _, _ = info_card(
            info_grid,
            "KORNER / EK BİLGİ",
            self.result_corners_var,
            None
        )
        self.card_corners.grid(row=0, column=2, sticky="nsew", padx=(8, 0))

        lower_info = tk.Frame(result_area, bg=self.colors["panel"])
        lower_info.pack(fill="x", padx=18, pady=(0, 10))
        lower_info.grid_columnconfigure(0, weight=3)
        lower_info.grid_columnconfigure(1, weight=1)

        analysis_card = RoundedSurface(
            lower_info,
            bg=self.colors["panel"],
            fill=self.colors["card"],
            border=self.colors["border"],
            radius=23,
            padding=1,
            shadow=True,
        )
        analysis_card.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        tk.Label(
            analysis_card.body,
            text="ℹ  Analiz Açıklaması",
            font=("Segoe UI", 9, "bold"),
            bg=self.colors["card"],
            fg=self.colors["accent"],
            anchor="w"
        ).pack(fill="x", padx=12, pady=(7, 3))
        self.analysis_text_label = tk.Label(
            analysis_card.body,
            textvariable=self.result_analysis_var,
            font=("Segoe UI", 9),
            bg=self.colors["card"],
            fg=self.colors["text"],
            anchor="w",
            justify="left",
            wraplength=500
        )
        self.analysis_text_label.pack(fill="x", padx=12, pady=(0, 8))

        source_card = RoundedSurface(
            lower_info,
            bg=self.colors["panel"],
            fill=self.colors["card"],
            border=self.colors["border"],
            radius=23,
            padding=1,
            shadow=True,
        )
        source_card.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        tk.Label(
            source_card.body,
            text="🔗 Veri Kaynağı",
            font=("Segoe UI", 9, "bold"),
            bg=self.colors["card"],
            fg=self.colors["accent"],
            anchor="w"
        ).pack(fill="x", padx=12, pady=(7, 4))
        self.source_brand_label = tk.Label(
            source_card.body,
            textvariable=self.result_source_var,
            font=("Segoe UI", 14, "bold"),
            bg=self.colors["card"],
            fg=self.colors["text"],
            anchor="center",
            justify="center",
            wraplength=190
        )
        self.source_brand_label.pack(fill="x", padx=8, pady=(1, 3))
        tk.Label(
            source_card.body,
            textvariable=self.result_source_url_var,
            font=("Segoe UI", 8),
            bg=self.colors["card"],
            fg=self.colors["muted"],
            anchor="center",
            justify="center",
            wraplength=190
        ).pack(fill="x", padx=8, pady=(0, 7))

        # ---------------------------------------------------------------
        # CONSOLE — tıklayınca yukarı doğru büyür / tekrar küçülür
        # ---------------------------------------------------------------
        console_head = tk.Frame(console_outer.body, bg=self.colors["console_glass"])
        console_head.pack(fill="x", padx=12, pady=(6, 4))
        GlowHeading(
            console_head,
            "●  Console / Debug",
            bg=self.colors["console_glass"],
            fg=self.colors["green"],
            accent=self.colors["green"],
            font=("Consolas", 10, "bold"),
            height=25,
            width=250,
            neon=True,
        ).pack(side="left")
        console_actions = tk.Frame(console_head, bg=self.colors["console_glass"])
        console_actions.pack(side="right")
        self.logs_toggle_button = tk.Button(
            console_actions,
            text="⌃ Logları Göster",
            font=("Segoe UI", 8, "bold"),
            bg=self.colors["console_glass"],
            fg=self.colors["muted"],
            activebackground="#12324f",
            activeforeground=self.colors["gold"],
            relief="flat",
            bd=0,
            padx=6,
            pady=5,
            command=self._toggle_logs,
            cursor="hand2"
        )
        self.logs_toggle_button.pack(side="left", padx=(0, 10))
        tk.Button(
            console_actions,
            text="⧉ Kopyala",
            font=("Segoe UI", 9, "bold"),
            bg="#102847",
            fg=self.colors["text"],
            activebackground="#17406b",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            padx=12,
            pady=6,
            command=self._copy_console,
            cursor="hand2"
        ).pack(side="left", padx=(0, 6))
        tk.Button(
            console_actions,
            text="⌫ Temizle",
            font=("Segoe UI", 9, "bold"),
            bg="#102847",
            fg=self.colors["muted"],
            activebackground="#17406b",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            padx=12,
            pady=6,
            command=self._clear_console,
            cursor="hand2"
        ).pack(side="left")

        text_frame = tk.Frame(
            console_outer.body,
            bg=self.colors["console"],
            highlightthickness=1,
            highlightbackground="#214663"
        )
        text_frame.pack(fill="both", expand=True, padx=12, pady=(0, 10))
        self.text_result = tk.Text(
            text_frame,
            font=("Consolas", 9),
            bg=self.colors["console"],
            fg=self.colors["green"],
            insertbackground="#ffffff",
            selectbackground="#14532d",
            selectforeground="#ffffff",
            wrap="word",
            relief="flat",
            bd=0,
            padx=10,
            pady=7,
            spacing1=1,
            spacing3=2,
        )
        scrollbar = ttk.Scrollbar(
            text_frame,
            command=self.text_result.yview,
            orient="vertical",
            style="Modern.Vertical.TScrollbar"
        )
        self.text_result.configure(yscrollcommand=scrollbar.set)
        self.text_result.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        self.root.after(220, lambda: self._set_console_split(expanded=False))

        # Geçmiş ekranı ana ekran kurulduktan sonra hazırlanır.
        self._build_history_page()

        self._reset_dashboard()
        self.root.after(180, self._poll_logo_queue)
        self.show_result(
            "● Sistem hazır.\n"
            "Sol panelden karşılaşma bilgilerini girip analizi başlatabilirsin.\n"
            "------------------------------------------------------------"
        )
        self._show_page("home")

    def _redraw_header(self, event=None):
        """Hero görselini başlığa kadar uzatır; logo ve durum metni üst katmanda kalır."""
        try:
            width = max(800, int(event.width if event is not None else self.header.winfo_width()))
            height = max(80, int(event.height if event is not None else self.header.winfo_height()))
        except (tk.TclError, AttributeError, TypeError, ValueError):
            return

        if self._header_art_source is not None and ImageTk is not None:
            art_left = min(610, max(500, int(width * 0.38)))
            art_width = max(430, width - art_left)
            try:
                resized = self._header_art_source.resize((art_width, height), Image.LANCZOS)
                self._header_art_photo = ImageTk.PhotoImage(resized)
                if self._header_art_item is None:
                    self._header_art_item = self.header.create_image(
                        width, 0, image=self._header_art_photo, anchor="ne"
                    )
                else:
                    self.header.itemconfigure(self._header_art_item, image=self._header_art_photo)
                    self.header.coords(self._header_art_item, width, 0)
                self.header.tag_lower(self._header_art_item)
            except Exception:
                pass

        center_x = width // 2
        if self._header_logo_item is not None:
            self.header.coords(self._header_logo_item, center_x, height // 2)
            self.header.tag_raise(self._header_logo_item)
        if self._header_status_item is not None:
            self.header.coords(self._header_status_item, width - 22, 28)
            self.header.tag_raise(self._header_status_item)

    def _show_page(self, page):
        """Sol menüdeki Ana Sayfa / Analiz / Geçmiş sayfalarını aktif eder."""
        requested = page if page in {"home", "analysis", "history"} else "home"
        self._active_page = requested
        self.home_page.pack_forget()
        self.history_page.pack_forget()
        if requested == "history":
            self.history_page.pack(fill="both", expand=True)
            self._refresh_history_view()
        else:
            self.home_page.pack(fill="both", expand=True)
            if requested == "analysis":
                self.root.after(80, lambda: self.combo_bet.focus_set())

        for key, button in self.sidebar_buttons.items():
            active = key == requested
            button.configure(
                bg=self.colors["card"] if active else self.colors["sidebar"],
                fg=self.colors["gold"] if active else self.colors["muted"],
                highlightthickness=1 if active else 0,
                highlightbackground=self.colors["gold"] if active else self.colors["sidebar"],
            )

    def _set_console_split(self, expanded=None):
        """Console panelini yukarı doğru büyütür veya tekrar küçültür."""
        if expanded is not None:
            self._logs_expanded = bool(expanded)
        try:
            self.right_split.update_idletasks()
            height = self.right_split.winfo_height()
            if height < 250:
                self.root.after(120, lambda: self._set_console_split(self._logs_expanded))
                return
            console_height = max(280, int(height * 0.58)) if self._logs_expanded else 165
            sash_y = max(230, height - console_height)
            self.right_split.sash_place(0, 0, sash_y)
            self.logs_toggle_button.configure(
                text="⌄ Logları Küçült" if self._logs_expanded else "⌃ Logları Göster",
                fg=self.colors["gold"] if self._logs_expanded else self.colors["muted"],
            )
        except (tk.TclError, AttributeError):
            pass

    def _toggle_logs(self):
        self._logs_expanded = not self._logs_expanded
        self._set_console_split(self._logs_expanded)

    def _load_history_records(self):
        try:
            path = Path(self._history_path)
            if not path.exists():
                return []
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                return []
            return [item for item in data if isinstance(item, dict)][:250]
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            return []

    def _persist_history_records(self):
        try:
            target = Path(self._history_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            temp_path = target.with_suffix(".tmp")
            temp_path.write_text(
                json.dumps(self._history_records[:250], ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            os.replace(temp_path, target)
        except OSError:
            pass

    def _record_history(
        self,
        scraped_data,
        sport,
        home,
        away,
        match_date,
        bet_choice,
        bet_subchoice,
        stats_view,
    ):
        scraped_data = scraped_data or {}
        now = datetime.now()
        record = {
            "id": now.strftime("%Y%m%d%H%M%S%f"),
            "queried_at": now.strftime("%d.%m.%Y %H:%M:%S"),
            "sport": sport,
            "home": home,
            "away": away,
            "matched_home": scraped_data.get("matched_home") or home,
            "matched_away": scraped_data.get("matched_away") or away,
            "match_date": match_date,
            "bet_choice": bet_choice,
            "bet_subchoice": bet_subchoice or "",
            "stats_view": stats_view,
            "result": self.result_status_var.get(),
            "score": str(scraped_data.get("score") or "—"),
            "source": scraped_data.get("source") or "—",
            "source_url": scraped_data.get("source_url") or "",
            "report": self.text_result.get("1.0", tk.END).strip(),
        }
        self._history_records.insert(0, record)
        self._history_records = self._history_records[:250]
        self._persist_history_records()
        if self._active_page == "history":
            self._refresh_history_view()

    def _build_history_page(self):
        """Kalıcı sorgu geçmişi ekranı."""
        style = ttk.Style()
        style.configure(
            "Premium.Treeview",
            background=self.colors["field"],
            fieldbackground=self.colors["field"],
            foreground=self.colors["text"],
            rowheight=31,
            borderwidth=0,
            font=("Segoe UI", 9),
        )
        style.map(
            "Premium.Treeview",
            background=[("selected", "#17395e")],
            foreground=[("selected", "#ffffff")],
        )
        style.configure(
            "Premium.Treeview.Heading",
            background=self.colors["card"],
            foreground=self.colors["gold"],
            relief="flat",
            font=("Segoe UI", 9, "bold"),
            padding=8,
        )
        style.map("Premium.Treeview.Heading", background=[("active", "#153252")])

        head = RoundedSurface(
            self.history_page,
            bg=self.colors["panel"],
            fill=self.colors["panel"],
            border=self.colors["border"],
            radius=22,
            padding=1,
            shadow=True,
        )
        head.pack(fill="x", pady=(0, 10))
        GlowHeading(
            head.body,
            "🕘  Sorgu Geçmişi",
            bg=self.colors["panel"],
            fg=self.colors["text"],
            accent=self.colors["gold"],
            font=("Segoe UI", 15, "bold"),
            height=38,
            width=420,
            neon=False,
        ).pack(anchor="w", padx=18, pady=(10, 0))
        tk.Label(
            head.body,
            text="Daha önce sorgulanan karşılaşmaları görüntüle, detayını incele veya aynı ayarlarla yeniden analiz et.",
            font=("Segoe UI", 9),
            bg=self.colors["panel"],
            fg=self.colors["muted"],
            anchor="w",
        ).pack(fill="x", padx=20, pady=(0, 12))

        table_card = RoundedSurface(
            self.history_page,
            bg=self.colors["panel"],
            fill=self.colors["card"],
            border=self.colors["border"],
            radius=24,
            padding=1,
            shadow=True,
        )
        table_card.pack(fill="both", expand=True, pady=(0, 10))

        columns = ("queried", "date", "sport", "match", "bet", "result", "score", "source")
        self.history_tree = ttk.Treeview(
            table_card.body,
            columns=columns,
            show="headings",
            style="Premium.Treeview",
            selectmode="browse",
        )
        headings = {
            "queried": "Sorgu Zamanı",
            "date": "Maç Tarihi",
            "sport": "Spor",
            "match": "Karşılaşma",
            "bet": "Bahis",
            "result": "Sonuç",
            "score": "Skor",
            "source": "Kaynak",
        }
        widths = {
            "queried": 135,
            "date": 95,
            "sport": 80,
            "match": 270,
            "bet": 250,
            "result": 90,
            "score": 70,
            "source": 110,
        }
        for key in columns:
            self.history_tree.heading(key, text=headings[key])
            self.history_tree.column(
                key,
                width=widths[key],
                minwidth=60,
                anchor="w",
                stretch=(key in {"match", "bet"}),
            )

        ybar = ttk.Scrollbar(
            table_card.body,
            orient="vertical",
            command=self.history_tree.yview,
            style="Modern.Vertical.TScrollbar",
        )
        xbar = ttk.Scrollbar(table_card.body, orient="horizontal", command=self.history_tree.xview)
        self.history_tree.configure(yscrollcommand=ybar.set, xscrollcommand=xbar.set)
        self.history_tree.grid(row=0, column=0, sticky="nsew", padx=(12, 0), pady=(12, 0))
        ybar.grid(row=0, column=1, sticky="ns", padx=(0, 12), pady=(12, 0))
        xbar.grid(row=1, column=0, sticky="ew", padx=(12, 0), pady=(0, 8))
        table_card.body.grid_rowconfigure(0, weight=1)
        table_card.body.grid_columnconfigure(0, weight=1)
        self.history_tree.bind("<<TreeviewSelect>>", self._on_history_selected)
        self.history_tree.bind("<Double-1>", lambda event: self._reinspect_selected_history())

        detail_card = RoundedSurface(
            self.history_page,
            bg=self.colors["panel"],
            fill=self.colors["card"],
            border=self.colors["border"],
            radius=24,
            padding=1,
            shadow=True,
        )
        detail_card.pack(fill="x")
        detail_card.body.pack_propagate(False)
        detail_head = tk.Frame(detail_card.body, bg=self.colors["card"])
        detail_head.pack(fill="x", padx=12, pady=(8, 5))
        tk.Label(
            detail_head,
            text="Seçili Sorgu Detayı",
            font=("Segoe UI", 10, "bold"),
            bg=self.colors["card"],
            fg=self.colors["accent"],
        ).pack(side="left")
        tk.Button(
            detail_head,
            text="↻ Yeniden İncele",
            font=("Segoe UI", 9, "bold"),
            bg=self.colors["gold"],
            fg="#111827",
            activebackground=self.colors["gold_hover"],
            activeforeground="#111827",
            relief="flat",
            bd=0,
            padx=14,
            pady=6,
            cursor="hand2",
            command=self._reinspect_selected_history,
        ).pack(side="right")
        tk.Button(
            detail_head,
            text="Analize Yükle",
            font=("Segoe UI", 9, "bold"),
            bg="#123352",
            fg=self.colors["text"],
            activebackground="#19466f",
            activeforeground="#ffffff",
            relief="flat",
            bd=0,
            padx=14,
            pady=6,
            cursor="hand2",
            command=lambda: self._load_selected_history(run_after=False),
        ).pack(side="right", padx=(0, 8))

        self.history_detail_text = tk.Text(
            detail_card.body,
            height=5,
            font=("Consolas", 9),
            bg=self.colors["console"],
            fg=self.colors["green"],
            insertbackground="#ffffff",
            wrap="word",
            relief="flat",
            bd=0,
            padx=10,
            pady=8,
        )
        self.history_detail_text.pack(fill="both", expand=True, padx=12, pady=(0, 10))
        self.history_detail_text.configure(state="disabled")
        self._refresh_history_view()

    def _refresh_history_view(self):
        if not hasattr(self, "history_tree"):
            return
        selected_id = self.history_tree.selection()[0] if self.history_tree.selection() else None
        for item in self.history_tree.get_children():
            self.history_tree.delete(item)
        for record in self._history_records:
            rid = str(record.get("id") or "")
            if not rid:
                continue
            match_text = (
                f"{record.get('matched_home') or record.get('home') or '—'} vs "
                f"{record.get('matched_away') or record.get('away') or '—'}"
            )
            bet_text = record.get("bet_subchoice") or record.get("bet_choice") or "—"
            self.history_tree.insert(
                "",
                "end",
                iid=rid,
                values=(
                    record.get("queried_at") or "—",
                    record.get("match_date") or "—",
                    record.get("sport") or "—",
                    match_text,
                    self._trim_text(bet_text, 60),
                    record.get("result") or "—",
                    record.get("score") or "—",
                    record.get("source") or "—",
                ),
            )
        if selected_id and self.history_tree.exists(selected_id):
            self.history_tree.selection_set(selected_id)
            self.history_tree.focus(selected_id)
        elif self._history_records:
            first = str(self._history_records[0].get("id") or "")
            if first and self.history_tree.exists(first):
                self.history_tree.selection_set(first)
                self.history_tree.focus(first)
                self._on_history_selected()

    def _selected_history_record(self):
        if not hasattr(self, "history_tree"):
            return None
        selected = self.history_tree.selection()
        if not selected:
            return None
        rid = selected[0]
        return next(
            (item for item in self._history_records if str(item.get("id")) == rid),
            None,
        )

    def _on_history_selected(self, event=None):
        record = self._selected_history_record()
        if record is None or not hasattr(self, "history_detail_text"):
            return
        details = record.get("report") or (
            f"{record.get('sport', '—')} | {record.get('home', '—')} vs {record.get('away', '—')}\n"
            f"Bahis: {record.get('bet_choice', '—')} | Alt seçenek: {record.get('bet_subchoice', '—')}"
        )
        self.history_detail_text.configure(state="normal")
        self.history_detail_text.delete("1.0", tk.END)
        self.history_detail_text.insert("1.0", details)
        self.history_detail_text.configure(state="disabled")

    def _populate_form_from_history(self, record):
        sport = record.get("sport") or "Futbol"
        self.combo_sport.set(sport)
        self._on_sport_selected()

        for entry, value in (
            (self.entry_date, record.get("match_date") or ""),
            (self.entry_home, record.get("home") or record.get("matched_home") or ""),
            (self.entry_away, record.get("away") or record.get("matched_away") or ""),
        ):
            entry.delete(0, tk.END)
            entry.insert(0, value)

        bet = record.get("bet_choice") or ""
        bet_values = tuple(self.combo_bet.cget("values"))
        if bet in bet_values:
            self.combo_bet.set(bet)
        elif "Diğer / El ile Gir..." in bet_values:
            self.combo_bet.set("Diğer / El ile Gir...")
            self.entry_manual_bet.delete(0, tk.END)
            self.entry_manual_bet.insert(0, bet)
        self._on_bet_selected()

        sub = record.get("bet_subchoice") or ""
        options = tuple(self.combo_suboption.cget("values"))
        player_manual = next(
            (
                opt
                for opt in options
                if "oyuncu adı" in str(opt).casefold() and "el ile gir" in str(opt).casefold()
            ),
            None,
        )
        if sub in options:
            self.combo_suboption.set(sub)
            self._on_suboption_selected()
        elif player_manual and re.search(r":\s*(üst|alt)\s*[-+]?\d", sub, flags=re.IGNORECASE):
            self.combo_suboption.set(player_manual)
            self._on_suboption_selected()
            match = re.match(
                r"^(.*?):\s*(Üst|Alt)\s*([-+]?\d+(?:[.,]\d+)?)\s*$",
                sub,
                flags=re.IGNORECASE,
            )
            if match:
                self.entry_player_name.delete(0, tk.END)
                self.entry_player_name.insert(0, match.group(1).strip())
                side = "ÜST" if match.group(2).casefold().startswith("ü") else "ALT"
                self.combo_player_side.set(side)
                self.entry_player_line.delete(0, tk.END)
                self.entry_player_line.insert(0, match.group(3).replace(",", "."))
        elif "Diğer / El ile Gir..." in options:
            self.combo_suboption.set("Diğer / El ile Gir...")
            self._on_suboption_selected()
            self.entry_manual_suboption.delete(0, tk.END)
            self.entry_manual_suboption.insert(0, sub)

        stats_view = record.get("stats_view") or "Kapalı"
        stat_values = tuple(self.combo_stats_view.cget("values"))
        if stats_view in stat_values:
            self.combo_stats_view.set(stats_view)

    def _load_selected_history(self, run_after=False):
        record = self._selected_history_record()
        if record is None:
            return
        self._show_page("analysis")
        self._populate_form_from_history(record)
        if run_after:
            self.root.after(120, self.run_analysis)

    def _reinspect_selected_history(self):
        self._load_selected_history(run_after=True)

    def _normalize_side_label(self, sport, side):
        sport = (sport or "").strip()
        side = (side or "").strip().lower()
        if side == "home":
            return "Oyuncu 1" if sport in ("Tenis", "Masa Tenisi") else "Ev Sahibi"
        if side == "away":
            return "Oyuncu 2" if sport in ("Tenis", "Masa Tenisi") else "Deplasman"
        return side

    def _trim_text(self, text, limit=180):
        text = " ".join(str(text or "").split())
        if len(text) <= limit:
            return text
        return text[: limit - 1].rstrip() + "…"

    def _extract_summary(self, explanation):
        text = str(explanation or "").replace("\\n", "\n").strip()
        if not text:
            return "Analiz üretilemedi."
        lines = [ln.strip(" -•	") for ln in text.splitlines() if ln.strip()]
        filtered = []
        skip_prefixes = ("sonuç:", "alt seçenek:", "seçilen market:", "📅", "🏅", "⚔️")
        for ln in lines:
            low = ln.casefold()
            if low.startswith(skip_prefixes):
                continue
            filtered.append(ln)
        if not filtered:
            filtered = lines
        return self._trim_text(" ".join(filtered[:3]), 320)

    def _set_result_theme(self, mode="neutral"):
        if not hasattr(self, "card_status"):
            return
        if mode == "win":
            border = "#1b7f4a"
            fg = self.colors["success"]
        elif mode == "lose":
            border = "#8d2634"
            fg = self.colors["danger"]
        elif mode == "warn":
            border = "#8b6a1d"
            fg = self.colors["warning"]
        else:
            border = self.colors["border"]
            fg = self.colors["text"]
        self.card_status.configure(highlightbackground=border)
        self.card_status_value.configure(fg=fg)
        if hasattr(self, "status_icon_label"):
            icon = "✓" if mode == "win" else ("✕" if mode == "lose" else ("!" if mode == "warn" else "●"))
            self.status_icon_label.configure(text=icon, fg=fg)

    def _reset_dashboard(self):
        self.result_title_var.set("Analiz Sonucu")
        self.result_market_var.set("Spor • Market")
        self.result_time_var.set("Analiz Zamanı: —")
        self.result_home_var.set("Ev Sahibi")
        self.result_away_var.set("Deplasman")
        if hasattr(self, "home_badge"):
            self.home_badge.set_name("Ev Sahibi")
            self.away_badge.set_name("Deplasman")
        self.result_home_role_var.set("Ev Sahibi")
        self.result_away_role_var.set("Deplasman")
        self.result_score_var.set("—  :  —")
        self.result_bet_var.set("Henüz seçim yapılmadı")
        self.result_bet_sub_var.set("Bahis seçimi bekleniyor")
        self.result_status_var.set("HAZIR")
        self.result_status_sub_var.set("Analiz bekleniyor")
        self.result_corners_var.set("Ev — | Dep —")
        self.result_source_var.set("Kaynak bekleniyor")
        self.result_source_url_var.set("")
        self.result_analysis_var.set(
            "Karşılaşma analizi henüz üretilmedi. Sol panelden bilgileri girip analizi başlatabilirsin."
        )
        self._set_result_theme("neutral")

    def _update_dashboard_loading(self, sport, home, away, match_date, bet_choice, bet_subchoice):
        self.result_title_var.set(match_date or "Analiz Sonucu")
        self.result_market_var.set(f"{sport}  •  {bet_choice}")
        self.result_time_var.set(f"Analiz Zamanı: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        self.result_home_var.set(home or "Ev Sahibi")
        self.result_away_var.set(away or "Deplasman")
        if hasattr(self, "home_badge"):
            self._request_team_logos(sport, home, away)
        self.result_home_role_var.set(self._normalize_side_label(sport, "home"))
        self.result_away_role_var.set(self._normalize_side_label(sport, "away"))
        self.result_score_var.set("…")
        self.result_bet_var.set(self._trim_text(bet_subchoice or bet_choice, 60))
        self.result_bet_sub_var.set(self._trim_text(bet_choice, 84))
        self.result_status_var.set("TARANIYOR")
        self.result_status_sub_var.set("Kaynaklar kontrol ediliyor")
        self.result_corners_var.set("Henüz veri yok")
        self.result_source_var.set("Kaynak aranıyor")
        self.result_source_url_var.set("")
        self.result_analysis_var.set(
            f"{sport} branşında '{home}' - '{away}' karşılaşması için kaynak taraması başlatıldı. Sonuçlar geldiğinde burada özet gösterilecek."
        )
        self._set_result_theme("warn")

    def _update_dashboard_special(self, sport, match_date, matched_home, matched_away, bet_choice, bet_subchoice, scraped_data, status_label, status_text):
        self.result_title_var.set(match_date or "Karşılaşma")
        self.result_market_var.set(f"{sport}  •  {bet_choice}")
        self.result_time_var.set(f"Analiz Zamanı: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        self.result_home_var.set(matched_home or "Ev Sahibi")
        self.result_away_var.set(matched_away or "Deplasman")
        if hasattr(self, "home_badge"):
            self._request_team_logos(
                sport,
                matched_home,
                matched_away,
                scraped_data,
            )
        self.result_home_role_var.set(self._normalize_side_label(sport, "home"))
        self.result_away_role_var.set(self._normalize_side_label(sport, "away"))
        self.result_score_var.set(scraped_data.get("score") or "—")
        self.result_bet_var.set(self._trim_text(bet_subchoice or bet_choice, 60))
        self.result_bet_sub_var.set(self._trim_text(bet_choice, 84))
        self.result_status_var.set(status_label)
        self.result_status_sub_var.set("Bahis otomatik sonuçlandırılmadı")
        self.result_corners_var.set(
            f"Durum: {status_label}"
        )
        self.result_source_var.set(scraped_data.get("source") or "Kaynak")
        self.result_source_url_var.set(self._trim_text(scraped_data.get("source_url") or "", 70))
        self.result_analysis_var.set(self._trim_text(status_text or "Karşılaşma tamamlanmadığı için final analiz üretilemedi.", 320))
        self._set_result_theme("warn")

    def _update_dashboard_error(self, sport, home, away, match_date, reason_text="Güvenilir karşılaşma bulunamadı."):
        self.result_title_var.set(match_date or "Analiz Sonucu")
        self.result_market_var.set(f"{sport}  •  Sonuç alınamadı")
        self.result_time_var.set(f"Analiz Zamanı: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        self.result_home_var.set(home or "Ev Sahibi")
        self.result_away_var.set(away or "Deplasman")
        if hasattr(self, "home_badge"):
            self._request_team_logos(sport, home, away)
        self.result_home_role_var.set(self._normalize_side_label(sport, "home"))
        self.result_away_role_var.set(self._normalize_side_label(sport, "away"))
        self.result_score_var.set("Bulunamadı")
        self.result_status_var.set("HATA")
        self.result_status_sub_var.set("Maç bulunamadı")
        self.result_corners_var.set("Detay için logları incele")
        self.result_source_var.set("Kaynak bulunamadı")
        self.result_source_url_var.set("")
        self.result_analysis_var.set(self._trim_text(reason_text, 320))
        self._set_result_theme("lose")

    def _update_dashboard_ai(
        self,
        sport,
        match_date,
        matched_home,
        matched_away,
        bet_choice,
        bet_subchoice,
        scraped_data,
    ):
        model = scraped_data.get("ai_model") or "openai/gpt-oss-20b"
        answer = scraped_data.get("ai_answer") or "Online yapay zeka web taraması yaptı."
        confidence = scraped_data.get("ai_confidence")
        try:
            confidence_text = f"%{float(confidence) * 100:.0f}"
        except (TypeError, ValueError):
            confidence_text = "—"

        self.result_title_var.set(match_date or "Web AI Son Yedek")
        self.result_market_var.set(f"{sport}  •  Web AI Fallback")
        self.result_time_var.set(
            f"Analiz Zamanı: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        )
        self.result_home_var.set(matched_home or "Katılımcı 1")
        self.result_away_var.set(matched_away or "Katılımcı 2")
        if hasattr(self, "home_badge"):
            self._request_team_logos(sport, matched_home, matched_away, scraped_data)
        self.result_home_role_var.set(self._normalize_side_label(sport, "home"))
        self.result_away_role_var.set(self._normalize_side_label(sport, "away"))
        self.result_score_var.set("AI")
        self.result_bet_var.set(self._trim_text(bet_subchoice or bet_choice, 60))
        self.result_bet_sub_var.set(self._trim_text(bet_choice, 84))
        self.result_status_var.set("WEB AI")
        self.result_status_sub_var.set("Web taraması yapıldı • otomatik settlement yok")
        self.result_corners_var.set(f"AI güveni: {confidence_text}")
        self.result_source_var.set(self._trim_text(scraped_data.get("source") or f"Web fallback • {model}", 44))
        source_urls = scraped_data.get("web_source_urls") or []
        source_url = (source_urls[0] if source_urls else scraped_data.get("source_url")) or ""
        self.result_source_url_var.set(self._trim_text(source_url, 74))
        self.result_analysis_var.set(self._trim_text(answer, 360))
        self._set_result_theme("warn")

    def _update_dashboard_final(self, sport, match_date, matched_home, matched_away, bet_choice, bet_subchoice, explanation, scraped_data):
        final_score = str(scraped_data.get("score") or "—")
        self.result_title_var.set(match_date or "Analiz Sonucu")
        self.result_market_var.set(f"{sport}  •  {bet_choice}")
        self.result_time_var.set(f"Analiz Zamanı: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        self.result_home_var.set(matched_home or "Ev Sahibi")
        self.result_away_var.set(matched_away or "Deplasman")
        if hasattr(self, "home_badge"):
            self._request_team_logos(
                sport,
                matched_home,
                matched_away,
                scraped_data,
            )
        self.result_home_role_var.set(self._normalize_side_label(sport, "home"))
        self.result_away_role_var.set(self._normalize_side_label(sport, "away"))
        self.result_score_var.set(final_score.replace('-', '  -  '))
        self.result_bet_var.set(self._trim_text(bet_subchoice or bet_choice, 60))
        self.result_bet_sub_var.set(self._trim_text(bet_choice, 84))

        expl_low = str(explanation or "").casefold()
        if "kazandı" in expl_low or "kazandi" in expl_low:
            self.result_status_var.set("KAZANDI")
            self.result_status_sub_var.set("Tahmin tuttu")
            self._set_result_theme("win")
        elif "kaybetti" in expl_low or "kaybetti" in expl_low or "kayıp" in expl_low:
            self.result_status_var.set("KAYBETTİ")
            self.result_status_sub_var.set("Tahmin tutmadı")
            self._set_result_theme("lose")
        elif "iade" in expl_low or "push" in expl_low or "void" in expl_low:
            self.result_status_var.set("İADE")
            self.result_status_sub_var.set("Kazanç/zarar oluşmadı")
            self._set_result_theme("warn")
        else:
            self.result_status_var.set("TAMAMLANDI")
            self.result_status_sub_var.set("Analiz üretildi")
            self._set_result_theme("neutral")

        corners = scraped_data.get("corners") or {}
        if sport == "Futbol" and corners:
            self.result_corners_var.set(f"Ev {corners.get('home', '—')}  |  Dep {corners.get('away', '—')}")
        else:
            self.result_corners_var.set(f"Skor: {final_score}")

        self.result_source_var.set(scraped_data.get("source") or "Kaynak")
        self.result_source_url_var.set(self._trim_text(scraped_data.get("source_url") or "", 70))
        self.result_analysis_var.set(self._extract_summary(explanation))

    def _maximize_window(self):
        """Açılışta pencereyi ekranı dolduracak şekilde maksimize eder."""
        try:
            self.root.state("zoomed")
            return
        except tk.TclError:
            pass

        try:
            self.root.attributes("-zoomed", True)
            return
        except tk.TclError:
            pass

        width = self.root.winfo_screenwidth()
        height = self.root.winfo_screenheight()
        self.root.geometry(f"{width}x{height}+0+0")

    def _center_panes(self):
        """Sol ve sağ paneli ilk açılışta yaklaşık %50 / %50 böler."""
        try:
            width = self.main_paned.winfo_width()
            if width > 100:
                self.main_paned.sash_place(
                    0,
                    int(width * 0.395),
                    0
                )
        except tk.TclError:
            pass

    def _toggle_fullscreen(self, event=None):
        self._fullscreen = not self._fullscreen
        self.root.attributes(
            "-fullscreen",
            self._fullscreen
        )
        return "break"

    def _exit_fullscreen(self, event=None):
        if self._fullscreen:
            self._fullscreen = False
            self.root.attributes(
                "-fullscreen",
                False
            )
        return "break"

    def _set_status(self, text, color=None):
        if hasattr(self, "_header_status_item") and self._header_status_item is not None:
            try:
                self.header.itemconfigure(
                    self._header_status_item,
                    text=text,
                    fill=color or self.colors["green"],
                )
                return
            except tk.TclError:
                pass
        if hasattr(self, "status_label") and self.status_label is not None:
            self.status_label.config(
                text=text,
                fg=color or self.colors["green"]
            )

    def _copy_console(self):
        content = self.text_result.get(
            "1.0",
            tk.END
        ).strip()

        if not content:
            return

        self.root.clipboard_clear()
        self.root.clipboard_append(content)
        self.root.update()

        self._set_status(
            "● KOPYALANDI",
            self.colors["accent"]
        )
        self.root.after(
            1200,
            lambda: self._set_status("● HAZIR")
        )

    def _clear_console(self):
        self.text_result.delete(
            "1.0",
            tk.END
        )
        self._set_status("● HAZIR")

    def _team_logo_name(self, name):
        """Logo eşleştirmesi için takım adını normalize eder."""
        value = unicodedata.normalize("NFKD", str(name or ""))
        value = "".join(ch for ch in value if not unicodedata.combining(ch))
        value = value.casefold()
        value = re.sub(r"[\(\[]\s*(?:w|k)\s*[\)\]]", " ", value)
        value = re.sub(r"\b(?:women|womens|woman|kadin|kadın)\b", " ", value)
        value = re.sub(r"[^a-z0-9]+", " ", value)
        value = " ".join(value.split())
        return value

    def _team_logo_similarity(self, candidate, target):
        left = self._team_logo_name(candidate)
        right = self._team_logo_name(target)
        if not left or not right:
            return 0.0
        if left == right:
            return 1.0
        if left in right or right in left:
            return 0.93
        ratio = SequenceMatcher(None, left, right).ratio()
        left_tokens = set(left.split())
        right_tokens = set(right.split())
        if left_tokens and right_tokens:
            overlap = len(left_tokens & right_tokens) / max(len(left_tokens), len(right_tokens))
            ratio = max(ratio, 0.55 + (0.40 * overlap))
        return min(1.0, ratio)

    def _logo_sport_slug(self, sport):
        mapping = {
            "Futbol": "soccer",
            "Basketbol": "basketball",
            "Beyzbol": "baseball",
            "Buz Hokeyi": "hockey",
            "Amerikan Futbolu": "football",
            "Tenis": "tennis",
            "MMA / UFC": "mma",
            "Ragbi Birliği": "rugby",
            "Ragbi Ligi": "rugby",
            "Kriket": "cricket",
        }
        return mapping.get(str(sport or "").strip(), "")

    def _logo_league_endpoints(self, sport):
        return {
            "Basketbol": (
                ("basketball", "wnba"),
                ("basketball", "nba"),
            ),
            "Beyzbol": (("baseball", "mlb"),),
            "Buz Hokeyi": (("hockey", "nhl"),),
            "Amerikan Futbolu": (("football", "nfl"),),
        }.get(str(sport or "").strip(), ())

    def _logo_cache_file(self, sport, team_name):
        raw_key = f"{sport}|{team_name}".encode("utf-8", "ignore")
        digest = hashlib.sha1(raw_key).hexdigest()
        return os.path.join(self._team_logo_cache_dir, f"{digest}.img")

    def _read_logo_cache(self, sport, team_name):
        key = (str(sport or ""), str(team_name or "").casefold())
        if key in self._team_logo_memory_cache:
            return self._team_logo_memory_cache[key]
        path = self._logo_cache_file(sport, team_name)
        try:
            if os.path.isfile(path):
                data = Path(path).read_bytes()
                if self._valid_logo_bytes(data):
                    self._team_logo_memory_cache[key] = data
                    return data
        except (OSError, ValueError):
            pass
        return None

    def _write_logo_cache(self, sport, team_name, data):
        if not data:
            return
        key = (str(sport or ""), str(team_name or "").casefold())
        self._team_logo_memory_cache[key] = data
        try:
            Path(self._logo_cache_file(sport, team_name)).write_bytes(data)
        except OSError:
            pass

    def _valid_logo_bytes(self, data):
        if not data or len(data) > 4 * 1024 * 1024:
            return False
        if Image is None:
            return True
        try:
            with Image.open(io.BytesIO(data)) as image:
                image.verify()
            return True
        except Exception:
            return False

    def _logo_download(self, url, timeout=7):
        if not url or not str(url).startswith(("https://", "http://")):
            return None

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/154.0 Safari/537.36"
            ),
            "Accept": "image/avif,image/webp,image/apng,image/png,image/*,*/*;q=0.8",
            "Referer": "https://www.espn.com/",
        }

        if browser_requests is not None:
            try:
                response = browser_requests.get(
                    str(url),
                    headers=headers,
                    timeout=timeout,
                    impersonate="chrome",
                )
                if response.status_code == 200:
                    data = bytes(response.content)
                    if self._valid_logo_bytes(data):
                        return data
            except Exception:
                pass

        request = urllib.request.Request(str(url), headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                data = response.read((4 * 1024 * 1024) + 1)
            return data if self._valid_logo_bytes(data) else None
        except Exception:
            return None

    def _logo_json(self, url, params=None, timeout=7):
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/154.0 Safari/537.36"
            ),
            "Accept": "application/json,text/plain,*/*",
            "Referer": "https://www.espn.com/",
        }

        if browser_requests is not None:
            try:
                response = browser_requests.get(
                    url,
                    params=params or {},
                    headers=headers,
                    timeout=timeout,
                    impersonate="chrome",
                )
                if response.status_code == 200:
                    return response.json()
            except Exception:
                pass

        if params:
            query = urllib.parse.urlencode(params)
            url = f"{url}?{query}"
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read(2 * 1024 * 1024)
            return json.loads(raw.decode("utf-8", "replace"))
        except Exception:
            return None

    def _candidate_logo_urls(self, obj):
        urls = []

        def walk(value, key_hint=""):
            if isinstance(value, dict):
                for key, child in value.items():
                    walk(child, str(key).casefold())
            elif isinstance(value, list):
                for child in value:
                    walk(child, key_hint)
            elif isinstance(value, str) and value.startswith(("https://", "http://")):
                lowered = value.casefold()
                imageish = any(
                    marker in lowered
                    for marker in (
                        ".png",
                        ".jpg",
                        ".jpeg",
                        ".webp",
                        "espncdn.com/i/teamlogos",
                        "sofascore.com/api/v1/team",
                        "img.sofascore.com/api/v1/team",
                    )
                )
                hinted = any(token in key_hint for token in ("logo", "image", "badge", "crest"))
                trusted_host = (
                    "espncdn.com" in lowered
                    or "img.sofascore.com/api/v1/team" in lowered
                    or "thesportsdb.com/images/" in lowered
                )
                if imageish and (hinted or trusted_host):
                    urls.append(value)

        walk(obj)
        # Sıralamayı koruyarak tekilleştir.
        return list(dict.fromkeys(urls))

    def _find_logo_url_in_json(self, payload, team_name):
        candidates = []

        def walk(node):
            if isinstance(node, dict):
                names = []
                for key in (
                    "displayName",
                    "shortDisplayName",
                    "name",
                    "title",
                    "label",
                    "slug",
                ):
                    value = node.get(key)
                    if isinstance(value, str) and value.strip():
                        names.append(value)
                urls = self._candidate_logo_urls(node)
                if names and urls:
                    score = max(self._team_logo_similarity(name, team_name) for name in names)
                    team_hint = 0.0
                    kind = str(node.get("type") or node.get("kind") or "").casefold()
                    uid = str(node.get("uid") or "").casefold()
                    if "team" in kind or "~t:" in uid or "abbreviation" in node:
                        team_hint = 0.05
                    candidates.append((min(1.0, score + team_hint), urls[0]))
                for child in node.values():
                    walk(child)
            elif isinstance(node, list):
                for child in node:
                    walk(child)

        walk(payload)
        if not candidates:
            return None
        candidates.sort(key=lambda item: item[0], reverse=True)
        best_score, best_url = candidates[0]
        return best_url if best_score >= 0.70 else None

    def _resolve_team_logo_url(self, team_name, sport):
        """ESPN public web/search kaynaklarından logoyu best-effort çözer."""
        if not team_name:
            return None

        params = {"query": team_name, "limit": 20}
        sport_slug = self._logo_sport_slug(sport)
        if sport_slug:
            params["sport"] = sport_slug
        payload = self._logo_json(
            "https://site.web.api.espn.com/apis/search/v2",
            params=params,
        )
        if payload:
            url = self._find_logo_url_in_json(payload, team_name)
            if url:
                return url

        # Büyük ABD liglerinde search başarısız olursa doğrudan takım listesini tara.
        for sport_slug, league in self._logo_league_endpoints(sport):
            payload = self._logo_json(
                f"https://site.api.espn.com/apis/site/v2/sports/"
                f"{sport_slug}/{league}/teams",
                params={"limit": 100},
            )
            if not payload:
                continue
            url = self._find_logo_url_in_json(payload, team_name)
            if url:
                return url
        return None

    def _resolve_team_logo_bytes(self, team_name, sport, explicit_url=None):
        if explicit_url:
            data = self._logo_download(explicit_url)
            if data:
                self._write_logo_cache(sport, team_name, data)
                return data

        cached = self._read_logo_cache(sport, team_name)
        if cached:
            return cached

        resolved_url = self._resolve_team_logo_url(team_name, sport)
        if not resolved_url:
            return None
        data = self._logo_download(resolved_url)
        if data:
            self._write_logo_cache(sport, team_name, data)
        return data

    def _schedule_team_logo(self, side, team_name, sport, explicit_url=None):
        badge = self.home_badge if side == "home" else self.away_badge
        badge.set_name(team_name)
        self._team_logo_request_ids[side] += 1
        request_id = self._team_logo_request_ids[side]

        if not explicit_url:
            cached = self._read_logo_cache(sport, team_name)
            if cached:
                badge.set_logo_bytes(cached)
                return

        def worker():
            data = self._resolve_team_logo_bytes(
                team_name,
                sport,
                explicit_url=explicit_url,
            )
            self.logo_queue.put((side, request_id, team_name, data))

        threading.Thread(target=worker, daemon=True).start()

    def _poll_logo_queue(self):
        """Worker thread sonuçlarını güvenli biçimde Tk ana thread'ine uygular."""
        try:
            while True:
                side, request_id, team_name, data = self.logo_queue.get_nowait()
                if self._team_logo_request_ids.get(side) != request_id:
                    continue
                badge = self.home_badge if side == "home" else self.away_badge
                if self._team_logo_name(badge._name) != self._team_logo_name(team_name):
                    continue
                if data:
                    badge.set_logo_bytes(data)
        except queue.Empty:
            pass

        try:
            if self.root.winfo_exists():
                self.root.after(180, self._poll_logo_queue)
        except tk.TclError:
            pass

    def _request_team_logos(self, sport, home, away, scraped_data=None):
        scraped_data = scraped_data or {}
        self._schedule_team_logo(
            "home",
            home or "Ev Sahibi",
            sport,
            scraped_data.get("home_logo_url"),
        )
        self._schedule_team_logo(
            "away",
            away or "Deplasman",
            sport,
            scraped_data.get("away_logo_url"),
        )

    def _resource_path(self, *parts):
        base_dir = getattr(
            sys,
            "_MEIPASS",
            os.path.dirname(os.path.abspath(__file__)),
        )
        return os.path.join(base_dir, *parts)

    def _load_asset_image(self, filename, max_size=None):
        asset_path = self._resource_path(filename)
        if not os.path.exists(asset_path):
            return None
        try:
            if Image is not None and ImageTk is not None:
                image = Image.open(asset_path).convert("RGBA")
                if max_size:
                    image.thumbnail(max_size, Image.LANCZOS)
                return ImageTk.PhotoImage(image)
            image = tk.PhotoImage(file=asset_path)
            if max_size:
                width = max(1, image.width())
                height = max(1, image.height())
                scale = max(width / max_size[0], height / max_size[1], 1.0)
                subsample = max(1, int(scale))
                image = image.subsample(subsample, subsample)
            return image
        except Exception:
            return None

    def _load_header_logo(self):
        return (
            self._load_asset_image("hizir_bey_transparent.png", (150, 100))
            or self._load_asset_image("hizir_bey_header.png", (150, 96))
        )

    def _on_sport_selected(self, event=None):
        sport = self.combo_sport.get().strip() or "Futbol"

        home_label, away_label = get_participant_labels(sport)
        self.label_home.config(text=f"⌂  {home_label}")
        self.label_away.config(text=f"✈  {away_label}")

        options = get_bet_options_for_sport(
            sport,
            BET_OPTIONS
        )
        self.combo_bet["values"] = options

        if options:
            self.combo_bet.current(0)

        # İstatistik görünümünü spor dalına göre değiştir.
        # Böylece E-Spor'da "korner / sarı kart / şut" gibi futbol alanları
        # yanlışlıkla gösterilmez.
        if sport == "Futbol":
            self.combo_stats_view["values"] = STAT_VIEW_OPTIONS
        elif sport == "E-Spor":
            self.combo_stats_view["values"] = ESPORT_STAT_VIEW_OPTIONS
        else:
            self.combo_stats_view["values"] = GENERIC_SPORT_STAT_VIEW_OPTIONS

        self.combo_stats_view.current(0)

        self._on_bet_selected()
        self._refresh_suboptions(preserve=False)

    def _on_team_name_changed(self, event=None):
        self._refresh_suboptions(preserve=True)

    def _on_manual_bet_changed(self, event=None):
        if self.combo_bet.get() == "Diğer / El ile Gir...":
            self._refresh_suboptions(preserve=True)

    def _on_bet_selected(self, event=None):
        selected = self.combo_bet.get()

        if selected == "Diğer / El ile Gir...":
            if not self.manual_bet_label.winfo_ismapped():
                self.manual_bet_label.pack(fill="x", pady=(7, 2))
                self.entry_manual_bet.pack(fill="x", pady=(0, 4))
            if event is not None:
                self.entry_manual_bet.focus_set()
        else:
            self.manual_bet_label.pack_forget()
            self.entry_manual_bet.pack_forget()

        self._refresh_suboptions(preserve=False)

    def _current_market_for_options(self):
        selected = self.combo_bet.get().strip()

        if selected == "Diğer / El ile Gir...":
            manual = self.entry_manual_bet.get().strip()
            return manual

        return selected

    def _refresh_suboptions(self, preserve=True):
        market = self._current_market_for_options()
        home = self.entry_home.get().strip() or "Ev Sahibi"
        away = self.entry_away.get().strip() or "Deplasman"

        old_value = self.combo_suboption.get().strip()

        if not market:
            options = ["Diğer / El ile Gir..."]
        else:
            try:
                options = get_market_suboptions(
                    market,
                    home,
                    away,
                    self.combo_sport.get().strip() or "Futbol"
                )
            except Exception:
                options = ["Diğer / El ile Gir..."]

        self.combo_suboption["values"] = options

        if not self.suboption_label.winfo_ismapped():
            self.suboption_label.pack(fill="x", pady=(7, 2))
            self.combo_suboption.pack(fill="x", pady=(0, 2))

        if preserve and old_value in options:
            self.combo_suboption.set(old_value)
        elif options:
            self.combo_suboption.current(0)
        else:
            self.combo_suboption.set("")

        self._on_suboption_selected()

    def _is_player_prop_manual_option(self, selected=None):
        selected = (selected if selected is not None else self.combo_suboption.get()).strip()
        normalized = selected.casefold()
        return "oyuncu adı" in normalized and "el ile gir" in normalized

    def _show_player_prop_fields(self):
        if not self.player_prop_frame.winfo_ismapped():
            # Premium kompakt oyuncu market satırı: tek satırda oyuncu + çizgi + yön.
            # 720p ekranlarda ana aksiyon butonunun görünür kalmasını sağlar.
            self.player_prop_frame.pack(fill="x", pady=(4, 1))
            self.player_name_label.pack(side="left", padx=(0, 6))
            self.entry_player_name.pack(side="left", fill="x", expand=True, ipady=3, padx=(0, 8))
            self.player_line_row.pack(side="right")
            self.player_line_label.pack(side="left", padx=(0, 4))
            self.entry_player_line.config(width=7)
            self.entry_player_line.pack(side="left", ipady=3, padx=(0, 5))
            self.combo_player_side.pack(side="right")

    def _hide_player_prop_fields(self):
        self.player_prop_frame.pack_forget()

    def _on_suboption_selected(self, event=None):
        selected = self.combo_suboption.get().strip()
        player_prop_manual = self._is_player_prop_manual_option(selected)

        if player_prop_manual:
            self.manual_suboption_label.pack_forget()
            self.entry_manual_suboption.pack_forget()
            self._show_player_prop_fields()
            if event is not None:
                self.entry_player_name.focus_set()
            return

        self._hide_player_prop_fields()
        manual_needed = selected in (
            "Diğer / El ile Gir...",
            "Oyuncu adı / El ile Gir...",
        )

        if manual_needed:
            if not self.manual_suboption_label.winfo_ismapped():
                self.manual_suboption_label.pack(fill="x", pady=(5, 2))
                self.entry_manual_suboption.pack(fill="x", pady=(0, 2))
            if event is not None:
                self.entry_manual_suboption.focus_set()
        else:
            self.manual_suboption_label.pack_forget()
            self.entry_manual_suboption.pack_forget()

    def _get_selected_suboption(self):
        selected = self.combo_suboption.get().strip()

        if self._is_player_prop_manual_option(selected):
            player = self.entry_player_name.get().strip()
            line = self.entry_player_line.get().strip().replace(",", ".")
            side = self.combo_player_side.get().strip() or "ÜST"
            if not player or not line:
                return None
            try:
                float(line)
            except ValueError:
                return None
            return f"{player}: {side.title()} {line}"

        if selected in (
            "Diğer / El ile Gir...",
            "Oyuncu adı / El ile Gir...",
        ):
            manual = self.entry_manual_suboption.get().strip()
            return manual or None

        return selected or None

    def _get_selected_bet(self):
        selected = self.combo_bet.get().strip()

        if selected == "Diğer / El ile Gir...":
            manual = self.entry_manual_bet.get().strip()
            if not manual:
                return None
            return manual

        return selected

    def show_result(self, message):
        # Eski/güncellenmiş modüllerden literal "\\n" gelirse ekranda
        # "\n" yazısı olarak görünmesin; gerçek satır sonuna dönüştür.
        message = str(message or "").replace("\\n", "\n")
        self.text_result.delete("1.0", tk.END)
        self.text_result.insert(tk.END, message)

    # ---- UI DONDURMAMAK İÇİN: scraper arka plan thread'inde çalışır ----
    def run_analysis(self):
        if self.worker_thread and self.worker_thread.is_alive():
            return

        match_date = self.entry_date.get().strip()
        sport = self.combo_sport.get().strip() or "Futbol"
        home = self.entry_home.get().strip()
        away = self.entry_away.get().strip()
        bet_choice = self._get_selected_bet()
        bet_subchoice = self._get_selected_suboption()
        stats_view = self.combo_stats_view.get().strip() or "Kapalı"

        if not home or not away:
            self.show_result(
                "⚠️ HATA: Lütfen ev sahibi ve deplasman takımlarını eksiksiz girin."
            )
            return

        if not bet_choice:
            self.show_result(
                "⚠️ HATA: 'Diğer / El ile Gir...' seçildi. "
                "Lütfen bahis seçeneğini el ile yazın."
            )
            self.entry_manual_bet.focus_set()
            return

        if not bet_subchoice:
            if self._is_player_prop_manual_option():
                self.show_result(
                    "⚠️ HATA: Oyuncu bahsi için oyuncu adını ve sayısal çizgiyi girin; "
                    "ardından ÜST/ALT yönünü seçin."
                )
                if not self.entry_player_name.get().strip():
                    self.entry_player_name.focus_set()
                else:
                    self.entry_player_line.focus_set()
            else:
                self.show_result(
                    "⚠️ HATA: Lütfen 'Bahis Alt Seçeneği' alanından "
                    "bir seçim yapın veya el ile girin."
                )
            return

        self.show_result(
            f"⏳ [{sport}] '{home}' vs '{away}' ({match_date}) için veriler taranıyor...\\n"
            f"📌 Bahis: {bet_choice}\\n"
            f"⏳ İşlem arka planda sürüyor..."
        )

        self.btn_run.config(
            state="disabled",
            text="⏳  Veriler taranıyor..."
        )
        self._set_status(
            "● İŞLENİYOR",
            self.colors["warning"]
        )
        self.root.update()

        if not fetch_flashscore_data_multi_source:
            self.show_result(
                "❌ HATA: 'fetchers.scraper' modülü bulunamadı "
                "ya da içe aktarılamadı!"
            )
            self.btn_run.config(
                state="normal",
                text="✦  Otomatik Veri Çek ve Analiz Et"
            )
            self._set_status(
                "● HATA",
                self.colors["danger"]
            )
            return

        self.worker_thread = threading.Thread(
            target=self._scrape_worker,
            args=(sport, home, away, match_date, bet_choice, bet_subchoice, stats_view),
            daemon=True
        )
        self.worker_thread.start()
        self.root.after(200, self._check_queue)

    def _scrape_worker(
        self, sport, home, away, match_date, bet_choice, bet_subchoice, stats_view
    ):
        # Ana veri taramasına sert bir watchdog eklenmiştir. Ağ katmanındaki
        # herhangi bir üçüncü taraf istek beklenmedik şekilde takılsa bile GUI
        # sonsuza kadar "Veriler taranıyor" durumunda kalmaz.
        fetch_result_queue = queue.Queue(maxsize=1)

        def _fetch_job():
            try:
                value = fetch_flashscore_data_multi_source(
                    home,
                    away,
                    match_date,
                    sport,
                    bet_choice=bet_choice,
                    bet_subchoice=bet_subchoice,
                )
                fetch_result_queue.put(("ok", value))
            except Exception as exc:
                fetch_result_queue.put(("error", exc, traceback.format_exc()))

        fetch_thread = threading.Thread(target=_fetch_job, daemon=True)
        fetch_thread.start()

        try:
            fetch_payload = fetch_result_queue.get(timeout=240)
            if fetch_payload[0] == "ok":
                scraped_data = fetch_payload[1]
            else:
                exc = fetch_payload[1]
                tb_text = fetch_payload[2]
                scraped_data = {
                    "status": "ERROR",
                    "debug_logs": [
                        f"Beklenmeyen hata: {type(exc).__name__}: {exc}",
                        tb_text,
                    ],
                }
        except queue.Empty:
            scraped_data = {
                "status": "ERROR",
                "debug_logs": [
                    "ZAMAN AŞIMI: Veri kaynakları / son-yedek zinciri 240 saniye içinde yanıt vermedi.",
                    "İşlem güvenli biçimde sonlandırıldı; uygulama kilitlenmedi.",
                    "Ağ bağlantısını/API erişimini kontrol edip tekrar deneyebilirsin.",
                ],
            }

        # Maç normal kaynaklardan bulunduysa, eksik bahis/istatistik verisi icin
        # AI'ya gecmeden ONCE tum uygun gercek kaynaklar bir kez daha tamamlayici
        # olarak taranir. Sira: gercek kaynaklar -> Groq -> Puter -> direct web.
        if (
            isinstance(scraped_data, dict)
            and scraped_data.get("status") == "OK"
            and scraped_data.get("score") is not None
        ):
            try:
                matched_home = scraped_data.get("matched_home") or home
                matched_away = scraped_data.get("matched_away") or away

                def _need_state(data):
                    corners = data.get("corners") or {}
                    match_info = {
                        "date": match_date,
                        "sport": sport,
                        "home": data.get("matched_home") or matched_home,
                        "away": data.get("matched_away") or matched_away,
                        "score": data.get("score"),
                        "corners": {
                            "home": corners.get("home"),
                            "away": corners.get("away"),
                        },
                        "status": "FT",
                        "ht_score": data.get("ht_score"),
                        "ht_corners": data.get("ht_corners"),
                        "goals": data.get("goals") or [],
                        "events": data.get("events") or [],
                        "team_stats": data.get("team_stats") or {},
                        "player_stats": data.get("player_stats") or {},
                        "period_scores": data.get("period_scores") or {},
                        "map_scores": data.get("map_scores") or [],
                        "round_score": data.get("round_score"),
                        "source": data.get("source"),
                        "event_id": data.get("event_id"),
                    }
                    try:
                        explanation = explain_bet(match_info, bet_choice, bet_subchoice)
                    except Exception:
                        explanation = ""

                    market_missing = "ek maç verisi gerekiyor" in str(explanation).casefold()
                    stats_missing = False
                    if stats_view and stats_view != "Kapalı":
                        if sport == "Futbol":
                            period_map = {
                                "Takım İstatistikleri - Toplam": "ALL",
                                "Takım İstatistikleri - 1. Yarı": "1ST",
                                "Takım İstatistikleri - 2. Yarı": "2ND",
                            }
                            if stats_view in period_map:
                                stats_missing = not bool(
                                    (data.get("team_stats") or {}).get(period_map[stats_view])
                                )
                            elif stats_view == "Oyuncu İstatistikleri":
                                players = data.get("player_stats") or {}
                                stats_missing = not bool(
                                    (players.get("home") or []) + (players.get("away") or [])
                                )
                        elif sport == "E-Spor":
                            stats_missing = not bool(
                                data.get("map_scores") or data.get("round_score")
                            )
                        else:
                            stats_missing = not bool(data.get("period_scores"))
                    return market_missing, stats_missing, explanation

                needs_market_data, needs_stats_data, pre_explanation = _need_state(scraped_data)

                if needs_market_data or needs_stats_data:
                    logs = scraped_data.setdefault("debug_logs", [])
                    reason_bits = []
                    if needs_market_data:
                        reason_bits.append("bahis settlement verisi eksik")
                    if needs_stats_data:
                        reason_bits.append("secilen istatistik gorunumu eksik")
                    logs.append(
                        "Eksik-veri modu: " + ", ".join(reason_bits)
                        + ". AI'dan once tum gercek kaynaklar kontrol edilecek."
                    )

                    # 1) TUM GERCEK KAYNAKLAR
                    if enrich_match_data_with_all_real_sources is not None:
                        try:
                            scraped_data = enrich_match_data_with_all_real_sources(
                                scraped_data,
                                matched_home,
                                matched_away,
                                match_date,
                                sport,
                                logs,
                            ) or scraped_data
                        except Exception as exc:
                            logs.append(
                                f"Gercek kaynak eksik-veri tamamlama HATASI: {type(exc).__name__}: {exc}"
                            )

                    needs_market_data, needs_stats_data, pre_explanation = _need_state(scraped_data)

                    # 2) GROQ — yalniz gercek kaynaklar bittikten sonra
                    if (needs_market_data or needs_stats_data) and enrich_match_data_with_groq is not None:
                        logs.append("Gercek kaynaklar eksigi kapatmadi; Groq Web AI eksik-veri fallback deneniyor...")
                        try:
                            enriched = enrich_match_data_with_groq(
                                scraped_data,
                                matched_home,
                                matched_away,
                                match_date,
                                sport,
                                logs,
                                bet_choice=bet_choice,
                                bet_subchoice=bet_subchoice,
                                stats_view=stats_view,
                                missing_hint=pre_explanation if needs_market_data else None,
                            )
                            if isinstance(enriched, dict):
                                scraped_data = enriched
                        except Exception as exc:
                            logs.append(f"Groq eksik-veri tamamlama HATASI: {type(exc).__name__}: {exc}")
                        needs_market_data, needs_stats_data, pre_explanation = _need_state(scraped_data)

                    # 3) PUTER — Groq 429/sonucsuzsa
                    if (needs_market_data or needs_stats_data) and enrich_match_data_with_puter is not None:
                        logs.append("Groq eksigi kapatmadi; Puter Web AI eksik-veri fallback deneniyor...")
                        try:
                            enriched = enrich_match_data_with_puter(
                                scraped_data,
                                matched_home,
                                matched_away,
                                match_date,
                                sport,
                                logs,
                                bet_choice=bet_choice,
                                bet_subchoice=bet_subchoice,
                                stats_view=stats_view,
                                missing_hint=pre_explanation if needs_market_data else None,
                            )
                            if isinstance(enriched, dict):
                                scraped_data = enriched
                        except Exception as exc:
                            logs.append(f"Puter eksik-veri tamamlama HATASI: {type(exc).__name__}: {exc}")
                        needs_market_data, needs_stats_data, pre_explanation = _need_state(scraped_data)

                    # 4) AI'SIZ DIRECT WEB — en son emniyet agi
                    if (needs_market_data or needs_stats_data) and enrich_match_data_with_direct_web is not None:
                        logs.append("Puter da eksigi kapatmadi; AI'siz direkt web parser son kontrolu yapiliyor...")
                        try:
                            enriched = enrich_match_data_with_direct_web(
                                scraped_data,
                                matched_home,
                                matched_away,
                                match_date,
                                sport,
                                logs,
                                bet_choice=bet_choice,
                                bet_subchoice=bet_subchoice,
                                stats_view=stats_view,
                                missing_hint=pre_explanation if needs_market_data else None,
                            )
                            if isinstance(enriched, dict):
                                scraped_data = enriched
                        except Exception as exc:
                            logs.append(f"Direkt web eksik-veri tamamlama HATASI: {type(exc).__name__}: {exc}")
            except Exception as exc:
                scraped_data.setdefault("debug_logs", []).append(
                    f"Eksik-veri fallback zinciri HATASI: {type(exc).__name__}: {exc}"
                )

        self.result_queue.put(
            (scraped_data, sport, home, away, match_date, bet_choice, bet_subchoice, stats_view)
        )

    def _check_queue(self):
        try:
            data = self.result_queue.get_nowait()
        except queue.Empty:
            self.root.after(200, self._check_queue)
            return

        scraped_data, sport, home, away, match_date, bet_choice, bet_subchoice, stats_view = data

        self._show_final(
            scraped_data,
            sport,
            home,
            away,
            match_date,
            bet_choice,
            bet_subchoice,
            stats_view
        )
        self._record_history(
            scraped_data,
            sport,
            home,
            away,
            match_date,
            bet_choice,
            bet_subchoice,
            stats_view,
        )

        self.btn_run.config(
            state="normal",
            text="✦  Otomatik Veri Çek ve Analiz Et"
        )
        self._set_status("● HAZIR")

    def _get_player_stat(self, stats, *keys):
        for key in keys:
            if stats.get(key) is not None:
                return stats.get(key)
        return None

    def _format_team_statistics(self, scraped_data, stats_view, home, away):
        period_map = {
            "Takım İstatistikleri - Toplam": ("ALL", "TOPLAM"),
            "Takım İstatistikleri - 1. Yarı": ("1ST", "1. YARI"),
            "Takım İstatistikleri - 2. Yarı": ("2ND", "2. YARI"),
        }

        if stats_view not in period_map:
            return ""

        period, title = period_map[stats_view]
        all_stats = scraped_data.get("team_stats") or {}
        period_stats = all_stats.get(period) or {}
        source = scraped_data.get("stats_source") or scraped_data.get("source") or "Bilinmiyor"

        lines = [
            "",
            f"📊 MAÇ İSTATİSTİKLERİ - {title}",
            f"Kaynak: {source}",
            f"{'İstatistik':<38} | {home:<18} | {away}",
            "-" * 82,
        ]

        available = 0
        for key, label in STAT_DISPLAY_ORDER:
            row = period_stats.get(key)
            if row:
                hv = str(row.get("home", "—"))
                av = str(row.get("away", "—"))
                available += 1
            else:
                hv = "—"
                av = "—"

            lines.append(f"{label:<38} | {hv:<18} | {av}")

        if available == 0:
            lines.extend([
                "",
                "ℹ️ Bu maç/kaynak için seçilen periyotta ayrıntılı istatistik alınamadı.",
            ])

        return "\n".join(lines)

    def _format_player_statistics(self, scraped_data, home, away):
        players = scraped_data.get("player_stats") or {}
        home_rows = players.get("home") or []
        away_rows = players.get("away") or []

        if not home_rows and not away_rows:
            return (
                "\n\n👤 OYUNCU İSTATİSTİKLERİ\n"
                "ℹ️ Bu maç/kaynak için oyuncu bazlı maç istatistiği alınamadı."
            )

        lines = [
            "",
            "👤 OYUNCU İSTATİSTİKLERİ",
            "Oyuncu | Rating | Dk | Gol | Asist | Şut/İsabet | "
            "Pas İsabet/Toplam | Müdahale | İkili Mücadele | Kurtarış",
            "-" * 115,
        ]

        def val(stats, *keys):
            for key in keys:
                if stats.get(key) is not None:
                    return stats.get(key)
            return "—"

        def render(team_name, rows):
            lines.append(f"\n🏟️ {team_name}")
            for item in rows:
                st = item.get("statistics") or {}
                name = item.get("name") or "Bilinmeyen"
                rating = val(st, "rating")
                minutes = val(st, "minutesPlayed", "minutes")
                goals = val(st, "goals")
                assists = val(st, "goalAssist", "assists")
                shots = val(st, "totalShots", "shotsTotal")
                target = val(st, "shotsOnTarget", "onTargetScoringAttempt")
                accurate = val(st, "accuratePass")
                passes = val(st, "totalPass")
                tackles = val(st, "tackles", "tackleWon")
                duels = val(st, "duelWon")
                saves = val(st, "saves", "goalkeeperSaves")

                lines.append(
                    f"{name:<25} | {str(rating):<6} | {str(minutes):<3} | "
                    f"{str(goals):<3} | {str(assists):<5} | "
                    f"{str(shots)}/{str(target):<7} | "
                    f"{str(accurate)}/{str(passes):<12} | "
                    f"{str(tackles):<8} | {str(duels):<15} | {saves}"
                )

        render(home, home_rows)
        render(away, away_rows)
        return "\n".join(lines)

    def _format_esports_statistics(
        self,
        scraped_data,
        home,
        away
    ):
        game = scraped_data.get("esport_game") or "E-Spor"
        event_name = scraped_data.get("event_name") or "—"
        score = scraped_data.get("score") or "—"
        round_score = scraped_data.get("round_score")
        map_scores = scraped_data.get("map_scores") or []

        lines = [
            "",
            "🎮 E-SPOR KARŞILAŞMA ÖZETİ",
            f"Oyun: {game}",
            f"Turnuva: {event_name}",
            f"Seri Skoru: {home} {score} {away}",
        ]

        if round_score:
            lines.append(f"Harita / Round Skoru: {round_score}")

        if map_scores:
            lines.append("")
            lines.append("🗺️ Harita Sonuçları:")
            for index, row in enumerate(map_scores, 1):
                map_name = row.get("map") or f"Harita {index}"
                hv = row.get("home", "—")
                av = row.get("away", "—")
                lines.append(
                    f"• {map_name}: {home} {hv}-{av} {away}"
                )

        # Futbol istatistik etiketlerini E-Spor'a kesinlikle ekleme.
        return "\\n".join(lines)

    def _format_generic_sport_summary(
        self,
        scraped_data,
        home,
        away
    ):
        sport = scraped_data.get("sport") or "Spor"
        score = scraped_data.get("score") or "—"
        period_scores = scraped_data.get("period_scores") or {}
        event_name = scraped_data.get("event_name")

        lines = [
            "",
            "📊 KARŞILAŞMA ÖZETİ",
            f"Spor: {sport}",
            f"Skor: {home} {score} {away}",
        ]

        if event_name:
            lines.append(f"Organizasyon: {event_name}")

        if period_scores:
            lines.append("")
            lines.append("Periyot / Set / Bölüm Skorları:")
            for key in sorted(period_scores, key=lambda x: int(x) if str(x).isdigit() else 999):
                row = period_scores[key]
                lines.append(
                    f"• {key}: {row.get('home', '—')}-{row.get('away', '—')}"
                )

        return "\\n".join(lines)

    def _format_ai_enrichment_note(self, scraped_data):
        if not scraped_data.get("ai_enrichment_attempted"):
            return ""
        if not scraped_data.get("ai_enrichment_verified"):
            summary = str(scraped_data.get("ai_enrichment_summary") or "").strip()
            if summary:
                return (
                    "\n\n🤖 Groq eksik-veri taraması yapıldı ancak doğrulama eşiği sağlanmadı.\n"
                    f"ℹ️ {summary}"
                )
            return "\n\n🤖 Groq eksik-veri taraması yapıldı; doğrulanmış yeni veri eklenmedi."

        fields = scraped_data.get("ai_enriched_fields") or []
        confidence = scraped_data.get("ai_enrichment_confidence")
        try:
            confidence_text = f"%{float(confidence) * 100:.0f}"
        except (TypeError, ValueError):
            confidence_text = "—"
        field_text = ", ".join(str(x) for x in fields) if fields else "eksik maç verileri"
        return (
            "\n\n🤖 Groq Web AI ile doğrulanarak tamamlandı: "
            f"{field_text} (güven {confidence_text})."
        )

    def _format_source_link(self, scraped_data):
        web_urls = scraped_data.get("web_source_urls") or []
        if isinstance(web_urls, (list, tuple)):
            cleaned_urls = []
            for item in web_urls:
                url = str(item or "").strip()
                if url.startswith(("https://", "http://")) and url not in cleaned_urls:
                    cleaned_urls.append(url)
            if cleaned_urls:
                return (
                    "\n\n"
                    "🔗 Web Kanıt Kaynakları (kopyalanabilir):\n"
                    + "\n".join(cleaned_urls[:3])
                )

        source_url = str(
            scraped_data.get("source_url") or ""
        ).strip()

        if not source_url:
            return ""

        # Düz metin URL bilinçli olarak kullanılıyor:
        # sonuç kutusundan fare/CTRL+C ile kolayca kopyalanabilir.
        return (
            "\n\n"
            "🔗 Veri Kaynağı (kopyalanabilir):\n"
            f"{source_url}"
        )

    def _format_selected_statistics(self, scraped_data, stats_view, home, away):
        if not stats_view or stats_view == "Kapalı":
            return ""

        sport = scraped_data.get("sport") or "Futbol"

        if sport == "E-Spor":
            # E-Spor'da futbol takım istatistikleri (şut, korner, kart vb.)
            # gösterilmez. Yalnız E-Spor'a uygun seri/map özeti gösterilir.
            return self._format_esports_statistics(
                scraped_data,
                home,
                away
            )

        if sport != "Futbol":
            return self._format_generic_sport_summary(
                scraped_data,
                home,
                away
            )

        if stats_view == "Oyuncu İstatistikleri":
            return self._format_player_statistics(
                scraped_data,
                home,
                away
            )

        return self._format_team_statistics(
            scraped_data,
            stats_view,
            home,
            away
        )

    def _show_final(
        self,
        scraped_data,
        sport,
        home,
        away,
        match_date,
        bet_choice,
        bet_subchoice,
        stats_view
    ):
        # Maç bulundu ancak final sonucu yoksa (ertelendi, iptal, canlı vb.)
        # "Maç Bulunamadı" demek yerine gerçek durumu göster.
        if scraped_data:
            current_status = scraped_data.get("status")

            if current_status == "AI_FALLBACK":
                source = scraped_data.get("source") or "Groq Web AI"
                matched_home = scraped_data.get("matched_home") or home
                matched_away = scraped_data.get("matched_away") or away
                answer = scraped_data.get("ai_answer") or (
                    "Online yapay zeka web taraması yaptı ancak otomatik bahis "
                    "sonuçlandırması için yeterli doğrulanmış kanıt bulamadı."
                )
                model = scraped_data.get("ai_model") or "openai/gpt-oss-20b"
                confidence = scraped_data.get("ai_confidence")
                try:
                    confidence_text = f"%{float(confidence) * 100:.0f}"
                except (TypeError, ValueError):
                    confidence_text = "—"
                searches = scraped_data.get("ai_suggested_searches") or []
                notes = scraped_data.get("ai_notes") or []
                web_urls = scraped_data.get("web_source_urls") or []

                extra_lines = []
                if searches:
                    extra_lines.append("\n🔎 AI alternatif arama önerileri:")
                    extra_lines.extend(f"• {item}" for item in searches[:3])
                if notes:
                    extra_lines.append("\n📝 AI notları:")
                    extra_lines.extend(f"• {item}" for item in notes[:3])
                if web_urls:
                    extra_lines.append("\n🔗 Web kanıt kaynakları:")
                    extra_lines.extend(f"• {item}" for item in web_urls[:3])
                extra_text = "\n".join(extra_lines)

                self._update_dashboard_ai(
                    sport,
                    match_date,
                    matched_home,
                    matched_away,
                    bet_choice,
                    bet_subchoice,
                    scraped_data,
                )
                self.show_result(
                    "🌐🤖 ONLINE WEB SON YEDEK\n"
                    f"📅 Tarih: {match_date}\n"
                    f"🏅 Spor: {sport}\n"
                    f"⚔️ Karşılaşma: {matched_home} vs {matched_away}\n"
                    f"🧠 Model: {model}\n"
                    f"📊 AI güveni: {confidence_text}\n"
                    f"📌 Seçilen Bahis: {bet_choice}\n"
                    f"🎫 Alt Seçenek: {bet_subchoice}\n"
                    "------------------------------------------------------------"
                    "--------------------\n"
                    f"{answer}"
                    f"{extra_text}\n\n"
                    f"⚠️ {source} web taraması yaptı; ancak "
                    "bu sorguda otomatik settlement için güven/kaynak eşiği sağlanmadı. "
                    "Bu nedenle bahis KAZANDI/KAYBETTİ olarak otomatik sonuçlandırılmadı.\n"
                    f"🤖 AI Kaynağı: {source}"
                )
                return

            special_statuses = {
                "POSTPONED": "⏸️ ERTELENDİ",
                "CANCELLED": "🚫 İPTAL EDİLDİ",
                "INTERRUPTED": "⚠️ YARIDA KESİLDİ",
                "ABANDONED": "⚠️ TERK EDİLDİ",
                "DELAYED": "⏳ GECİKTİ",
                "SCHEDULED": "🕒 HENÜZ BAŞLAMADI",
                "LIVE": "🔴 CANLI",
                "WALKOVER": "⚠️ HÜKMEN / WALKOVER",
                "AWARDED": "⚠️ HÜKMEN SONUÇLANDIRILDI",
            }

            if current_status in special_statuses:
                source = scraped_data.get("source", "Otomasyon")
                matched_home = scraped_data.get("matched_home") or home
                matched_away = scraped_data.get("matched_away") or away
                status_text = (
                    scraped_data.get("status_text")
                    or special_statuses[current_status]
                )
                current_score = scraped_data.get("score")
                score_line = (
                    f"\n⚽ Mevcut skor: {current_score}"
                    if current_score
                    else ""
                )

                self.show_result(
                    f"📅 Tarih: {match_date} | Kaynak: {source}\n"
                    f"🏅 Spor: {sport}\n"
                    f"⚔️ Karşılaşma: {matched_home} vs {matched_away}\n"
                    f"📣 Durum: {special_statuses[current_status]}\n"
                    f"ℹ️ {status_text}"
                    f"{score_line}\n"
                    f"📌 Seçilen Bahis: {bet_choice}\n"
                    f"🎫 Alt Seçenek: {bet_subchoice}\n"
                    f"------------------------------------------------------------"
                    f"--------------------\n"
                    f"ℹ️ Final sonuç bulunmadığı için bahis kazanmış/kaybetmiş "
                    f"olarak otomatik sonuçlandırılmadı."
                    f"{self._format_source_link(scraped_data)}"
                )
                return

        if (
            scraped_data
            and scraped_data.get("status") == "OK"
            and scraped_data.get("score") is not None
        ):
            final_score = scraped_data.get("score", "0-0")
            h_c = scraped_data.get("corners", {}).get("home", 0)
            a_c = scraped_data.get("corners", {}).get("away", 0)
            source = scraped_data.get("source", "Otomasyon")

            # Scraper gerçek eşleşen takım adlarını döndürüyorsa raporda göster.
            matched_home = scraped_data.get("matched_home") or home
            matched_away = scraped_data.get("matched_away") or away

            match_info = {
                "date": match_date,
                "sport": sport,
                "home": matched_home,
                "away": matched_away,
                "score": final_score,
                "corners": {
                    "home": h_c,
                    "away": a_c
                },
                "status": "FT",
                "ht_score": scraped_data.get("ht_score"),
                "ht_corners": scraped_data.get("ht_corners"),
                "goals": scraped_data.get("goals") or [],
                "events": scraped_data.get("events") or [],
                "team_stats": scraped_data.get("team_stats") or {},
                "player_stats": scraped_data.get("player_stats") or {},
                "source": source,
                "event_id": scraped_data.get("event_id"),
            }

            try:
                explanation = explain_bet(
                    match_info,
                    bet_choice,
                    bet_subchoice
                )
            except Exception as e:
                explanation = (
                    "⚠️ Maç verisi bulundu ancak analyzer.py bu bahis "
                    "seçeneğini işlerken hata verdi.\\n"
                    f"Bahis: {bet_choice}\\n"
                    f"Hata: {type(e).__name__}: {e}"
                )

            statistics_text = self._format_selected_statistics(
                scraped_data,
                stats_view,
                matched_home,
                matched_away
            )

            if sport == "Futbol":
                match_summary = (
                    f"⚽ Maç: {matched_home} vs {matched_away} "
                    f"(Skor: {final_score} | "
                    f"Kornerler: Ev {h_c} - Dep {a_c})"
                )
            else:
                match_summary = (
                    f"⚔️ Karşılaşma: {matched_home} vs {matched_away} "
                    f"(Skor: {final_score})"
                )

            output_report = (
                f"📅 Tarih: {match_date} | Kaynak: {source}\n"
                f"🏅 Spor: {sport}\n"
                f"{match_summary}\n"
                f"📌 Seçilen Bahis: {bet_choice}\n"
                f"🎫 Alt Seçenek: {bet_subchoice}\n"
                f"📊 İstatistik Görünümü: {stats_view}\n"
                f"------------------------------------------------------------"
                f"--------------------\n"
                f"{explanation}"
                f"{self._format_ai_enrichment_note(scraped_data)}"
                f"{statistics_text}"
                f"{self._format_source_link(scraped_data)}"
            )

            self._update_dashboard_final(
                sport,
                match_date,
                matched_home,
                matched_away,
                bet_choice,
                bet_subchoice,
                explanation,
                scraped_data,
            )
            self.show_result(output_report)
            return

        logs = (
            scraped_data.get(
                "debug_logs",
                ["Bilinmeyen hata oluştu."]
            )
            if scraped_data
            else ["Veri alınamadı veya bağlantı kurulamadı."]
        )

        log_text = "\\n".join(
            [f"• {log}" for log in logs]
        )

        self.show_result(
            "❌ HATA: Maç Bulunamadı!\\n\\n"
            "🔍 ARKA PLAN ADIM ADIM İŞLEM GÜNLÜĞÜ (DEBUG):\n"
            "------------------------------------------------------------"
            "--------------------\n"
            f"{log_text}"
        )


if __name__ == "__main__":
    try:
        root = tk.Tk()
        app = FootballAnalyzerApp(root)
        root.mainloop()
    except Exception:
        hata_detayi = traceback.format_exc()

        print("\\n❌ PROGRAM KRİTİK BİR HATAYLA ÇÖKTÜ:")
        print(hata_detayi)

        try:
            with open(
                "hata_raporu.txt",
                "w",
                encoding="utf-8"
            ) as f:
                f.write(hata_detayi)

            print(
                "💾 Hata 'hata_raporu.txt' dosyasına kaydedildi."
            )
        except Exception:
            pass

        input("\\nÇıkmak için ENTER tuşuna basın...")
