"""Camera finish for Cycles frames: lens vignetting and fine sensor grain.

  python -I web/render/post.py in.png out.png [--vignette 0.28] [--grain 0.012] [--seed 0]

Grain is luminance noise, stronger in the shadows like a real sensor. The page
sequences leave it out (it doubles the file size) and get live grain in the
browser instead (render/pack.py).
"""
import argparse

import numpy as np
from PIL import Image


def finish(img, vignette=0.28, grain=0.012, seed=0):
    """img: float RGB 0..1 (h, w, 3) -> uint8 with vignetting, grain and dither"""
    h, w, _ = img.shape
    # natural (cos^4-like) falloff towards the corners, measured on the diagonal
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2)) / np.sqrt(2)
    img = img * (1 - vignette * r ** 2.2)[..., None]

    rng = np.random.default_rng(seed)
    if grain > 0:
        noise = rng.normal(0, 1, (h, w)).astype(np.float32)
        # a touch of spatial correlation: real grain is not single-pixel
        noise = (noise + np.roll(noise, 1, 0) + np.roll(noise, 1, 1)) / np.sqrt(3)
        luma = img @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        img = img + noise[..., None] * (grain * (1.4 - luma))[..., None]
    return np.clip(img * 255 + rng.uniform(-0.5, 0.5, img.shape), 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--vignette", type=float, default=0.28)
    ap.add_argument("--grain", type=float, default=0.012)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    img = np.asarray(Image.open(a.src).convert("RGB"), dtype=np.float32) / 255
    Image.fromarray(finish(img, a.vignette, a.grain, a.seed)).save(a.dst)


if __name__ == "__main__":
    main()
