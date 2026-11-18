"""The two marks of the ThinkPad for render/scene.py, written into the laptop
assets folder:
  thinkpad-logo.ttf   the wordmark's typeface as a static instance: scene.py sets
                      the letters (the i without its dot) as real geometry and cuts
                      them into the lid and the palm rest; the dot is drawn in the
                      material (red on the palm rest, an LED on the lid)
  logo-lenovo.png     the badge on the lid, 37 x 12.5 mm: red = the plate, green =
                      the lettering on it

Sizes and places on the lid are measured on Lenovo's top view of the P16s Gen 3.

  python3 web/render/logo_texture.py <laptop assets folder>
(needs Pillow, fontTools with brotli)
"""
import io
import pathlib
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFilter, ImageFont

WEB = pathlib.Path(__file__).resolve().parents[1]
THINKPAD_AXES = {"wght": 600, "wdth": 62}  # condensed and fairly heavy, like the web scene's wordmark


def font(file: str, px: int, axes=None) -> ImageFont.FreeTypeFont:
    f = TTFont(WEB / "public/fonts" / file)
    f.flavor = None
    ttf = io.BytesIO()
    f.save(ttf)
    ttf.seek(0)
    out = ImageFont.truetype(ttf, px)
    if axes:
        out.set_variation_by_axes(axes)
    return out


def thinkpad(out: pathlib.Path):
    """the wordmark's typeface for Blender, which cannot set the axes of a variable font"""
    var = TTFont(WEB / "public/fonts/archivo-latin-wdth-normal.woff2")
    var.flavor = None
    instancer.instantiateVariableFont(var, THINKPAD_AXES).save(out / "thinkpad-logo.ttf")


def lenovo(out: pathlib.Path):
    """aluminium plate with rounded corners, the lettering along its length"""
    px = 40  # per mm
    W, H = round(37 * px), round(12.5 * px)
    plate = Image.new("L", (W, H), 0)
    ImageDraw.Draw(plate).rounded_rectangle((px // 2, px // 2, W - px // 2 - 1, H - px // 2 - 1), radius=round(1.0 * px), fill=255)
    letters = Image.new("L", (W, H), 0)
    f = font("hanken-grotesk-latin-wght-normal.woff2", round(7.6 * px), [500])
    ImageDraw.Draw(letters).text((W / 2, H / 2), "Lenovo", font=f, fill=255, anchor="mm")
    Image.merge("RGB", (plate.filter(ImageFilter.GaussianBlur(1.5)), letters.filter(ImageFilter.GaussianBlur(1.0)), Image.new("L", (W, H), 0))).save(
        out / "logo-lenovo.png", optimize=True)


def main(out: pathlib.Path):
    out.mkdir(parents=True, exist_ok=True)
    thinkpad(out)
    lenovo(out)
    print("wrote", out)


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
