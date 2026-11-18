"""Page assets from the rendered sequences (scene.py --seq): vignetting, WebP
frames and the corner metadata the page maps the display and the note with.

  python web/render/pack.py web/render/out/seq web/public/seq [--quality 72] [--width 1920]
(frame counts from path.json next to the sequence folder)

Writes <dst>/<seg>/NNN.webp and <dst>/meta.json:
  {"w", "h", "segs": {seg: [[screen x,y * 4, note x,y * 4] | null per frame]}}
Corners are fractions of the frame from the top left (tl, tr, br, bl). Frames
not rendered yet (drafts with --step) are null; the page shows the nearest one.
"""
import argparse
import json
import pathlib
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from PIL import Image

from post import finish

SEGMENTS = ("pull", "now", "zoom", "pan", "close")


def one(job):
    src, dst, width, quality = job
    im = Image.open(src).convert("RGB")
    if im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    out = finish(np.asarray(im, np.float32) / 255, grain=0)
    Image.fromarray(out).save(dst, "WEBP", quality=quality, method=6)
    return im.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--quality", type=int, default=72)
    ap.add_argument("--width", type=int, default=1920)
    a = ap.parse_args()
    src, dst = pathlib.Path(a.src), pathlib.Path(a.dst)
    path = json.load(open(src.parent / "path.json")) if (src.parent / "path.json").exists() else None
    meta = {"segs": {}}
    jobs = []
    for seg in SEGMENTS:
        corners = json.load(open(src / f"{seg}.json")) if (src / f"{seg}.json").exists() else {}
        n = len(path[seg]) if path else 1 + max(map(int, corners), default=-1)
        (dst / seg).mkdir(parents=True, exist_ok=True)
        frames = []
        for i in range(n):
            png = src / seg / f"{i:03d}.png"
            c = corners.get(str(i))
            if c and png.exists():
                frames.append([round(v, 4) for v in c["screen"] + c["note"]])
                jobs.append((png, dst / seg / f"{i:03d}.webp", a.width, a.quality))
            else:
                frames.append(None)
        meta["segs"][seg] = frames
    with ProcessPoolExecutor() as ex:
        sizes = list(ex.map(one, jobs))
    meta["w"], meta["h"] = sizes[0]
    (dst / "meta.json").write_text(json.dumps(meta, separators=(",", ":")))
    total = sum(f.stat().st_size for f in dst.rglob("*.webp"))
    print(f"{len(jobs)} frames, {total / 2**20:.1f} MB")


if __name__ == "__main__":
    main()
