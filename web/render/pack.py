"""Page assets from the rendered sequences (scene.py --seq): vignetting, WebP
frames and the corner metadata the page maps the display and the business card with.

  python web/render/pack.py web/render/out/seq web/public/seq [--quality 72] [--width 1920] [--full-last close]
(frame counts from path.json next to the sequence folder; --full-last: the last frame of
these sequences keeps the render's width and gets --last-quality, so the business card and
the lid's logo read sharp)

Writes <dst>/<seg>/NNN.webp and <dst>/meta.json:
  {"w", "h", "segs": {seg: [[screen x,y * 4, card x,y * 4, laptop x0,y0,x1,y1] | null per frame]}}
Corners are fractions of the frame from the top left (tl, tr, br, bl); the laptop's
box is missing where the render predates it or the laptop reaches behind the camera. Frames
not rendered yet (drafts with --step) are null; the page shows the nearest one.
"""
import argparse
import json
import pathlib
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from PIL import Image

from post import finish

SEGMENTS = ("pull", "now", "zoom", "pan", "close")  # and "dive" in the portrait frames, from path.json


def one(job):
    src, dst, width, quality = job
    im = Image.open(src).convert("RGB")
    if width and im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    Image.fromarray(finish(np.asarray(im, np.float32) / 255, grain=0)).save(dst, "WEBP", quality=quality, method=6)
    return im.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--quality", type=int, default=72)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--full-last", default="")
    ap.add_argument("--last-quality", type=int, default=90, help="WebP quality of the --full-last frames")
    a = ap.parse_args()
    src, dst = pathlib.Path(a.src), pathlib.Path(a.dst)
    path = json.load(open(src.parent / "path.json")) if (src.parent / "path.json").exists() else None
    meta = {"segs": {}}
    jobs = []
    for seg in (list(path) if path else SEGMENTS):
        corners = json.load(open(src / f"{seg}.json")) if (src / f"{seg}.json").exists() else {}
        n = len(path[seg]) if path else 1 + max(map(int, corners), default=-1)
        (dst / seg).mkdir(parents=True, exist_ok=True)
        frames = []
        for i in range(n):
            png = src / seg / f"{i:03d}.png"
            c = corners.get(str(i))
            if c and png.exists():
                frames.append([round(v, 4) for v in c["screen"] + c["card"] + (c.get("laptop") or [])])
                full = seg in a.full_last.split(",") and i == n - 1
                jobs.append((png, dst / seg / f"{i:03d}.webp", None if full else a.width, a.last_quality if full else a.quality))
            else:
                frames.append(None)
        meta["segs"][seg] = frames
    with ProcessPoolExecutor() as ex:
        sizes = list(ex.map(one, jobs))
    meta["w"], meta["h"] = sizes[0]  # the size the page lays the frames out at (a larger last frame is drawn into it)
    (dst / "meta.json").write_text(json.dumps(meta, separators=(",", ":")))
    total = sum(f.stat().st_size for f in dst.rglob("*.webp"))
    print(f"{len(jobs)} frames, {total / 2**20:.1f} MB")


if __name__ == "__main__":
    main()
