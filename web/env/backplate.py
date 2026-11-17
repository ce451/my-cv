"""Backdrop behind the desk, made from a Poly Haven HDRI (CC0).

Projects a perspective view out of the equirectangular HDR, blurs it with a
disc kernel in linear light (bright lamps turn into bokeh discs, as with a fast
lens), darkens it to an evening mood and writes a PPM for ffmpeg.

    blender -b -P env/backplate.py -- --hdr room_2k.hdr --out plate.ppm \
        [--yaw 0] [--pitch 0] [--hfov 100] [--size 2560x1440] [--blur 22] [--ev -2] [--sat 1]

With --equirect the panorama itself is resampled to --size instead (small
environment map for the reflections).
"""

import sys

import bpy
import numpy as np


def arg(name, default):
    argv = sys.argv[sys.argv.index("--") + 1:]
    return argv[argv.index(name) + 1] if name in argv else default


hdr = arg("--hdr", None)
out = arg("--out", "plate.ppm")
yaw = np.radians(float(arg("--yaw", 0)))
pitch = np.radians(float(arg("--pitch", 0)))
hfov = np.radians(float(arg("--hfov", 100)))
W, H = (int(v) for v in arg("--size", "2560x1440").split("x"))
blur = float(arg("--blur", 22))
ev = float(arg("--ev", -2))
sat = float(arg("--sat", 1))

img = bpy.data.images.load(hdr)
w, h = img.size
src = np.empty(w * h * 4, dtype=np.float32)
img.pixels.foreach_get(src)
src = src.reshape(h, w, 4)[::-1, :, :3]  # Blender stores rows bottom-up

equirect = "--equirect" in sys.argv

# rays of a pinhole camera looking down -z, pitched up, then turned
f = (W / 2) / np.tan(hfov / 2)
x, y = np.meshgrid((np.arange(W) + 0.5 - W / 2) / f, -(np.arange(H) + 0.5 - H / 2) / f)
d = np.stack([x, y, -np.ones_like(x)], -1)
cp, sp = np.cos(pitch), np.sin(pitch)
d = np.stack([d[..., 0], d[..., 1] * cp - d[..., 2] * sp, d[..., 1] * sp + d[..., 2] * cp], -1)
cy, sy = np.cos(yaw), np.sin(yaw)
d = np.stack([d[..., 0] * cy + d[..., 2] * sy, d[..., 1], -d[..., 0] * sy + d[..., 2] * cy], -1)
d /= np.linalg.norm(d, axis=-1, keepdims=True)
lon = np.arctan2(d[..., 0], -d[..., 2])
lat = np.arcsin(np.clip(d[..., 1], -1, 1))
u = (lon / (2 * np.pi) + 0.5) * w - 0.5
v = (0.5 - lat / np.pi) * h - 0.5

# bilinear lookup, wrapping around in longitude
u0 = np.floor(u).astype(int)
v0 = np.clip(np.floor(v).astype(int), 0, h - 2)
fu, fv = (u - u0)[..., None], np.clip(v - v0, 0, 1)[..., None]
u0 %= w
u1 = (u0 + 1) % w
plate = (src[v0, u0] * (1 - fu) * (1 - fv) + src[v0, u1] * fu * (1 - fv)
         + src[v0 + 1, u0] * (1 - fu) * fv + src[v0 + 1, u1] * fu * fv)
if equirect:
    # box filter down to the output size
    plate = src[:h - h % H, :w - w % W].reshape(H, h // H, W, w // W, 3).mean(axis=(1, 3))

# disc blur via FFT, padded so nothing wraps around the edges
if blur > 0:
    r = int(np.ceil(blur))
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    k = np.clip(blur + 0.5 - np.hypot(xx, yy), 0, 1)
    k /= k.sum()
    P = np.pad(plate, ((r, r), (r, r), (0, 0)), mode="edge")
    K = np.zeros(P.shape[:2], np.float32)
    K[:k.shape[0], :k.shape[1]] = k
    K = np.roll(K, (-r, -r), (0, 1))
    FK = np.fft.rfft2(K)
    plate = np.stack([np.fft.irfft2(np.fft.rfft2(P[..., c]) * FK, P.shape[:2]) for c in range(3)], -1)
    plate = plate[r:-r, r:-r]

# exposure, saturation, soft filmic shoulder, sRGB
plate = np.maximum(plate, 0) * 2.0 ** ev
luma = (plate @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
plate = np.maximum(luma + (plate - luma) * sat, 0)
plate = plate * (2.51 * plate + 0.03) / (plate * (2.43 * plate + 0.59) + 0.14)
plate = np.where(plate <= 0.0031308, plate * 12.92, 1.055 * np.power(np.clip(plate, 0, 1), 1 / 2.4) - 0.055)
rgb = (np.clip(plate, 0, 1) * 255 + 0.5).astype(np.uint8)
with open(out, "wb") as fh:
    fh.write(b"P6 %d %d 255\n" % (W, H))
    fh.write(rgb.tobytes())
print("wrote", out, W, H)
