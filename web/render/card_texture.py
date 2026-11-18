"""Print of the business card on the desk in the last scene (85 x 55 mm): the
round portrait with the copper ring as on the start page, the name, the ways to
get in touch. Writes into the output folder:
  card-color.png   the printed face (sRGB, 40 px per mm)
  card-links.json  where the contact lines sit on the card (mm from the top left),
                   for the links the page lays over it (src/scene/card-links.json)

The mail address comes from the page (base64 in index.html), never from this file.

  python3 web/render/card_texture.py <out folder>
(needs Pillow, numpy, fontTools with brotli)
"""
import base64
import io
import json
import pathlib
import re
import sys

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
WEB = HERE.parent
PX = 40  # per mm
W_MM, H_MM = 85, 55
W, H = W_MM * PX, H_MM * PX
PAPER = (241, 237, 229)
INK = (27, 24, 21)  # --screen-bg
GREY = (92, 86, 79)
COPPER = (201, 129, 79)  # --copper
rng = np.random.default_rng(3)


def address() -> str:
    html = (WEB / "index.html").read_text(encoding="utf-8")
    return base64.b64decode(re.search(r'data-mail="([^"]+)"', html).group(1)).decode()


def font(file: str, size_mm: float, axes=None) -> ImageFont.FreeTypeFont:
    src = WEB / "public/fonts" / file
    if src.suffix == ".woff2":
        ttf = io.BytesIO()
        f = TTFont(src)
        f.flavor = None
        f.save(ttf)
        ttf.seek(0)
        out = ImageFont.truetype(ttf, round(size_mm * PX))
    else:
        out = ImageFont.truetype(str(src), round(size_mm * PX))
    if axes:
        out.set_variation_by_axes(axes)
    return out


def fit(text: str, make, size_mm: float, room_mm: float):
    """the font at size_mm, smaller if the text would run past room_mm"""
    f = make(size_mm)
    w = f.getlength(text) / PX
    return make(size_mm * room_mm / w) if w > room_mm else f


def main(out: pathlib.Path):
    out.mkdir(parents=True, exist_ok=True)
    # paper: faint fibres
    img = np.ones((H, W, 3), np.float32) * np.array(PAPER, np.float32)
    grain = rng.standard_normal((H, W)).astype(np.float32)
    img += (grain * 1.2)[..., None]
    card = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(card)

    # portrait: round, with the copper ring a little apart from it
    cx, cy, r = 20.5 * PX, 27.5 * PX, 13.5 * PX
    photo = Image.open(WEB / "public/portrait-800.webp").convert("RGB").resize((2 * round(r), 2 * round(r)), Image.LANCZOS)
    mask = Image.new("L", (8 * round(r), 8 * round(r)), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, mask.width - 1, mask.height - 1), fill=255)
    mask = mask.resize(photo.size, Image.LANCZOS)
    card.paste(photo, (round(cx - r), round(cy - r)), mask)
    ring = 1.25 * PX
    d.ellipse((cx - r - ring, cy - r - ring, cx + r + ring, cy + r + ring), outline=COPPER, width=round(0.4 * PX))

    # name like the start page: Archivo, wide and heavy, on two lines
    x0, room = 40.0, 85 - 40.0 - 5.0
    name = lambda s: font("archivo-latin-wdth-normal.woff2", s, [800, 125])
    f_name = fit("Christopher", name, 5.4, room)
    d.text((x0 * PX, 20.0 * PX), "Christopher", font=f_name, fill=INK, anchor="ls")
    d.text((x0 * PX, 25.6 * PX), "Elstner", font=f_name, fill=INK, anchor="ls")
    d.line((x0 * PX, 29.2 * PX, (x0 + 9) * PX, 29.2 * PX), fill=COPPER, width=round(0.35 * PX))

    # the ways to get in touch, in the terminal font of the page
    mono = lambda s: font("hack-regular.woff2", s)
    lines = [("mail", address()), ("linkedin", "linkedin/christopher-elstner"), ("github", "github/ce451")]
    f_mono = min((fit(t, mono, 2.15, room) for _, t in lines), key=lambda f: f.size)
    links = {}
    for i, (key, text) in enumerate(lines):
        y = 35.2 + i * 4.3
        d.text((x0 * PX, y * PX), text, font=f_mono, fill=GREY, anchor="ls")
        size = f_mono.size / PX
        w = f_mono.getlength(text) / PX
        links[key] = [round(v, 2) for v in (x0 - 0.8, y - 0.95 * size, w + 1.6, 1.35 * size)]

    card = card.filter(ImageFilter.GaussianBlur(0.35))  # print on uncoated card, a hair soft
    card.save(out / "card-color.png", optimize=True)
    (out / "card-links.json").write_text(json.dumps({"w": W_MM, "h": H_MM, "links": links}, indent=1) + "\n")
    print("wrote", out / "card-color.png", W, H)


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else HERE / "out"))
