"""The two marks of the ThinkPad for render/scene.py, written into the laptop
assets folder:
  thinkpad-logo.ttf   the wordmark's typeface as a static instance: scene.py sets
                      the letters (the i without its dot) as real geometry and cuts
                      them into the lid and the palm rest; the dot is drawn in the
                      material (red on the palm rest, an LED on the lid)
  logo-lenovo.png     the badge on the lid at 40 px per mm, 0.5 mm margin around
                      the plate: red = the plate, green = the lettering on it
  logo-p16s.png       the model name on the back of the camera bar, 40 px per mm
                      (his photo of the lid)

Sizes are measured on the notebookcheck lid photo (nbc-deckel) straightened to mm.

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
THINKPAD_AXES = {"wght": 800, "wdth": 62}  # as condensed as Archivo goes and heavy; scene.py stretches it taller


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
    """aluminium plate (33.6 x 11.3 mm) with rounded corners, the lettering
    (27.8 x 6 mm, as heavy as on nbc-deckel) along its length"""
    px = 40  # per mm
    W, H = round(34.6 * px), round(12.3 * px)
    plate = Image.new("L", (W, H), 0)
    ImageDraw.Draw(plate).rounded_rectangle((px // 2, px // 2, W - px // 2 - 1, H - px // 2 - 1), radius=round(0.8 * px), fill=255)
    f = font("hanken-grotesk-latin-wght-normal.woff2", 400, [800])
    text = Image.new("L", (3000, 800), 0)
    ImageDraw.Draw(text).text((100, 600), "Lenovo", font=f, fill=255, anchor="ls")
    text = text.crop(text.getbbox()).resize((round(27.8 * px), round(6.0 * px)), Image.LANCZOS)
    letters = Image.new("L", (W, H), 0)
    letters.paste(text, ((W - text.width) // 2, (H - text.height) // 2))
    Image.merge("RGB", (plate.filter(ImageFilter.GaussianBlur(1.5)), letters.filter(ImageFilter.GaussianBlur(1.0)), Image.new("L", (W, H), 0))).save(
        out / "logo-lenovo.png", optimize=True)


def model_name(out: pathlib.Path):
    """"P16s" as printed on the back of the camera bar: 8.6 x 3.4 mm, centred in
    an 11 x 5 mm image"""
    px = 40  # per mm
    W, H = round(11 * px), round(5 * px)
    f = font("hanken-grotesk-latin-wght-normal.woff2", 400, [500])
    text = Image.new("L", (3000, 800), 0)
    ImageDraw.Draw(text).text((100, 600), "P16s", font=f, fill=255, anchor="ls")
    text = text.crop(text.getbbox())
    text = text.resize((round(8.6 * px), round(3.4 * px)), Image.LANCZOS)  # a little narrower than Hanken
    im = Image.new("L", (W, H), 0)
    im.paste(text, ((W - text.width) // 2, (H - text.height) // 2))
    im.filter(ImageFilter.GaussianBlur(0.8)).save(out / "logo-p16s.png", optimize=True)
    return text.width / px


def main(out: pathlib.Path):
    out.mkdir(parents=True, exist_ok=True)
    thinkpad(out)
    lenovo(out)
    print("P16s", round(model_name(out), 2), "mm long")
    print("wrote", out)


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
