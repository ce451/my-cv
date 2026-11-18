"""Texture of the top sheet of the notepad for the Cycles render: squared paper
(5 mm grid) with the contact note in blue ballpoint.

The note is set glyph by glyph from the Caveat handwriting font with small
random changes in size, slant, baseline and pressure, so no two letters are
alike, and the ink gets the uneven flow of a ballpoint. Writes into the output folder:
  note-color.png  paper, grid and ink (sRGB)
  note-ink.png    ink coverage (linear), drives the groove and the sheen of the ink
  note-links.json where the contact lines sit on the sheet (mm from the top left),
                  for the links the page lays over the note (src/scene/note-links.json)

The mail address comes from the page (base64 in index.html), never from this file.

  python3 web/render/note_texture.py web/render/out
(needs Pillow, numpy, scipy, fontTools with brotli)
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
from scipy import ndimage

HERE = pathlib.Path(__file__).resolve().parent
WEB = HERE.parent
PX_MM = 16  # 148 x 210 mm -> 2368 x 3360 px
W_MM, H_MM = 148, 210
W, H = W_MM * PX_MM, H_MM * PX_MM
rng = np.random.default_rng(7)


def address() -> str:
    html = (WEB / "index.html").read_text(encoding="utf-8")
    return base64.b64decode(re.search(r'data-mail="([^"]+)"', html).group(1)).decode()


def caveat(weight: int) -> ImageFont.FreeTypeFont:
    ttf = io.BytesIO()
    f = TTFont(WEB / "public/fonts/caveat-latin-wght-normal.woff2")
    f.flavor = None
    f.save(ttf)
    ttf.seek(0)
    font = ImageFont.truetype(ttf, 10)
    font.set_variation_by_axes([weight])
    return font


def paper() -> np.ndarray:
    """Off-white paper with faint fibres and a light blue-grey 5 mm grid."""
    base = np.array([243, 241, 235], np.float32)
    img = np.ones((H, W, 3), np.float32) * base
    # fibres: soft low-frequency mottling plus fine grain
    mott = ndimage.gaussian_filter(rng.standard_normal((H // 8, W // 8)), 6)
    mott = np.kron(mott / mott.std(), np.ones((8, 8)))[:H, :W]
    grain = ndimage.gaussian_filter(rng.standard_normal((H, W)), 0.8)
    img += (mott * 1.0 + grain * 1.2)[..., None]
    # grid: printed lines 0.12 mm, inside a 4 mm border, from below the glued edge
    grid = np.zeros((H, W), np.float32)
    step = 5 * PX_MM
    x0, x1 = 4 * PX_MM, W - 4 * PX_MM
    y0, y1 = 14 * PX_MM, H - 4 * PX_MM
    lw = max(1, round(0.12 * PX_MM))
    for x in range(x0 + (x1 - x0) % step // 2, x1 + 1, step):
        grid[y0:y1, x:x + lw] = 1
    for y in range(y0, y1 + 1, step):
        grid[y:y + lw, x0:x1] = 1
    grid = ndimage.gaussian_filter(grid, 0.6) * 0.55
    line = np.array([150, 170, 186], np.float32)
    img = img * (1 - grid[..., None]) + line * grid[..., None]
    return img


def write(ink: Image.Image, text: str, x: float, y: float, size: float, weight: int, slope=0.0):
    """Sets text letter by letter with small human variation. x, y in mm (baseline)."""
    font = caveat(weight)
    pen = x * PX_MM
    base = y * PX_MM
    drift = 0.0
    for ch in text:
        s = size * PX_MM * (1 + rng.normal(0, 0.035))
        f = font.font_variant(size=max(8, int(round(s))))
        f.set_variation_by_axes([min(700, weight + int(rng.normal(0, 20)))])
        adv = f.getlength(ch)
        if ch != " ":
            pad = int(s)
            tile = Image.new("L", (int(adv) + 2 * pad, int(s * 1.6) + 2 * pad), 0)
            ImageDraw.Draw(tile).text((pad, pad + s), ch, font=f, fill=255, anchor="ls")
            ang = rng.normal(0, 2.2) + slope
            tile = tile.rotate(ang, resample=Image.BICUBIC, center=(pad, pad + s), expand=False)
            pressure = np.clip(rng.normal(0.9, 0.06), 0.72, 1.0)
            tile = tile.point(lambda v, p=pressure: int(v * p))
            dy = rng.normal(0, 0.012) * s + drift
            _max_paste(ink, tile, int(pen - pad), int(base - s - pad + dy))
        drift += rng.normal(0, 0.004) * size * PX_MM
        drift *= 0.9
        pen += adv * (1 + rng.normal(0, 0.03)) + 0.04 * PX_MM
    return pen / PX_MM


def _max_paste(dst: Image.Image, tile: Image.Image, x: int, y: int):
    region = (x, y, x + tile.width, y + tile.height)
    under = dst.crop(region)
    dst.paste(Image.fromarray(np.maximum(np.asarray(under), np.asarray(tile))), region)


def stroke(ink: Image.Image, pts_mm, width_mm=0.42):
    d = ImageDraw.Draw(ink)
    pts = [(x * PX_MM, y * PX_MM) for x, y in pts_mm]
    d.line(pts, fill=235, width=max(1, round(width_mm * PX_MM)), joint="curve")


def main(out: pathlib.Path):
    out.mkdir(parents=True, exist_ok=True)
    ink = Image.new("L", (W, H), 0)
    # the note, laid out on the 5 mm grid (baselines on grid lines)
    end = write(ink, "Klingt interessant?", 13, 39, 9.2, 700, slope=1.2)
    # a quick line under the question
    xs = np.linspace(13.5, end - 1.5, 40)
    stroke(ink, [(x, 41.6 + 0.5 * np.sin((x - 13) / (end - 13) * np.pi) * -1 + rng.normal(0, 0.05)) for x in xs])
    write(ink, "Dann reden wir.", 15, 54, 9.2, 700, slope=0.8)
    links = {}

    def link(key, text, x, y, size, weight, slope):
        end = write(ink, text, x, y, size, weight, slope=slope)
        # the line from the start of the writing to its end, ascenders to descenders
        links[key] = [round(v, 2) for v in (x - 1.5, y - 0.8 * size, end - x + 3, 1.15 * size)]

    link("mail", address(), 14, 79, 7.2, 680, 0.6)
    link("linkedin", "linkedin.com/in/christopher-elstner", 13, 94, 6.0, 660, 0.5)
    link("github", "github.com/ce451", 14, 109, 7.2, 680, 0.7)
    write(ink, "Christopher", 78, 134, 8.0, 700, slope=1.5)
    stroke(ink, [(68.5, 131.2), (72.5, 131.0), (75.0, 131.1)])

    # a 0.7 mm gel roller: a little wider than the font's stroke
    a = ndimage.grey_dilation(np.asarray(ink, np.float32) / 255, size=(3, 3))
    # ballpoint: ink settles unevenly, slightly heavier at the stroke edges, tiny skips
    flow = ndimage.gaussian_filter(rng.standard_normal(a.shape), 1.2)
    flow = np.clip(0.9 + 0.18 * flow / flow.std(), 0.55, 1.0)
    edge = a - ndimage.gaussian_filter(a, 1.5)
    a = np.clip(a * flow * 1.1 + 0.25 * np.clip(edge, 0, None), 0, 1)
    a = ndimage.gaussian_filter(a, 0.55)  # the ink takes a hair into the paper

    img = paper()
    blue = np.array([10, 58, 162], np.float32)  # ballpoint blue, holds up under the warm lamp
    img = img * (1 - a[..., None]) + blue * a[..., None]
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(out / "note-color.png", optimize=True)
    Image.fromarray((a * 255).astype(np.uint8)).save(out / "note-ink.png", optimize=True)
    (out / "note-links.json").write_text(json.dumps({"w": W_MM, "h": H_MM, "links": links}, indent=1) + "\n")
    print("wrote", out / "note-color.png", W, H)


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else HERE / "out"))
