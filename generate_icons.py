"""Erzeugt die PWA-Icons (Donut-Ring grün/rot + € auf dunklem Grund)."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT, exist_ok=True)

BG     = (11, 11, 13)       # #0b0b0d
GREEN  = (52, 211, 153)     # #34d399
ROSE   = (251, 113, 133)    # #fb7185
TEXT   = (236, 236, 240)    # #ececf0


def font(size):
    for name in ("segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make(size):
    # 4x supersampling für saubere Kanten
    s = size * 4
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)

    margin = int(s * 0.20)
    bbox = [margin, margin, s - margin, s - margin]
    w = int(s * 0.12)

    # Ring: grüner Bogen (Einnahmen) + roter Bogen (Ausgaben)
    d.arc(bbox, start=-90, end=160, fill=GREEN, width=w)
    d.arc(bbox, start=160, end=270, fill=ROSE, width=w)

    # € in der Mitte
    f = font(int(s * 0.30))
    d.text((s / 2, s / 2 - int(s * 0.02)), "€", font=f, fill=TEXT, anchor="mm")

    img = img.resize((size, size), Image.LANCZOS)
    path = os.path.join(OUT, f"icon-{size}.png")
    img.save(path)
    print("geschrieben:", path)


make(192)
make(512)
