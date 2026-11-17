#!/usr/bin/env python3
"""Turns FIG 1 of US 12,230,429 B2 into the exploding drawing on the laptop.

The patent (Siemens Energy, "Transportable power transformer unit", inventor
from Weiz) has an isometric line drawing of a power transformer. This removes
the reference numerals and their leader lines, splits the drawing into parts
(terminals, bushings and sockets, lid, conservator, device box, coolers, fans,
pipes, control unit, tank), bridges the conservator's
edges that the bushings hide, and writes each part as a transparent WebP with
light lines over an opaque silhouette in the panel colour.

    curl -o fig1.png https://patentimages.storage.googleapis.com/12/51/82/9576254a61848a/US12230429-20250218-D00001.png
    python3 web/drawing/transformer.py fig1.png [preview.png]  # optional: who owns which line

Needs numpy, scipy, scikit-image and opencv-python-headless (a venv will do).
Writes web/public/scene/transformer/*.webp and src/scene/transformer-parts.json.
Pixel coordinates below are those of the 2037 x 2223 source image.
"""
import json
import sys
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from scipy.ndimage import binary_fill_holes
from skimage.measure import label
from skimage.morphology import skeletonize

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "public" / "scene" / "transformer"
META = WEB / "src" / "scene" / "transformer-parts.json"

g = cv2.imread(sys.argv[1], cv2.IMREAD_GRAYSCALE)
if g is None or g.shape != (2223, 2037):
    sys.exit("expects FIG 1 of US 12,230,429 B2 as PNG, 2037 x 2223")
OUT.mkdir(parents=True, exist_ok=True)

# ---- 1. numerals and leaders ---------------------------------------------
# Lines are a 1 px checker pattern; closing makes them solid. Everything but the
# drawing itself (numerals, arrows, "FIG 1") is a separate component. A leader
# is the skeleton branch that starts next to a numeral; where it crosses an
# outline it is followed straight on to its free end.
ink = (g < 128).astype(np.uint8)
ink = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(ink, 8)
main = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
body = (lab == main).astype(np.uint8)
# numerals and arrows are under 100 px tall; the nameplate on cooler 8 is not
numerals = [i for i in range(1, n) if i != main and st[i, 1] > 120 and st[i, cv2.CC_STAT_HEIGHT] < 100]
for i in range(1, n):
    if i != main and i not in numerals and st[i, 1] > 120:
        body[lab == i] = 1

sk = skeletonize(body > 0)
P = np.pad(sk, 1)
ring = [P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:], P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]]
cross = sum((~ring[k] & ring[(k + 1) % 8]).astype(int) for k in range(8))
cnt = sum(r.astype(int) for r in ring)
junc = sk & (cross >= 3)
jd = cv2.dilate(junc.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
branches = label(sk & ~jd, connectivity=2)
jlab = label(jd, connectivity=2)
ends = np.argwhere(sk & (cnt == 1))

def touching(br):
    """junction blobs a branch touches, with the branch pixels next to each"""
    m = cv2.dilate((branches == br).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    return [j for j in np.unique(jlab[m & jd]) if j]

def direction(br, j):
    """unit vector of branch br pointing away from junction blob j, over 14 px"""
    pts = np.argwhere(branches == br).astype(float)
    jc = np.argwhere(jlab == j).mean(0)
    d = np.hypot(*(pts - jc).T)
    near = pts[d < d.min() + 14]
    v = near.mean(0) - jc
    return v / (np.linalg.norm(v) + 1e-9)

erase = np.zeros(sk.shape, bool)
keep_out = np.zeros(sk.shape, bool)
for i in numerals:
    x, y, w, h, a = st[i]
    dx = np.maximum(np.maximum(x - ends[:, 1], ends[:, 1] - (x + w)), 0)
    dy = np.maximum(np.maximum(y - ends[:, 0], ends[:, 0] - (y + h)), 0)
    d = np.hypot(dx, dy)
    d[branches[ends[:, 0], ends[:, 1]] == 0] = 1e9  # end points swallowed by a junction blob
    k = np.argmin(d)
    if d[k] > 45:
        continue
    br = branches[tuple(ends[k])]
    chain = [br]
    prev_j = None
    for _ in range(1):  # a leader crosses at most one outline
        js = [j for j in touching(br) if j != prev_j]
        if not js:
            break
        j = js[0]
        vin = -direction(br, j)  # direction of travel into the junction
        best, bdot = None, np.cos(np.radians(35))
        for ob in np.unique(branches[cv2.dilate((jlab == j).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0]):
            if ob and ob not in chain and (branches == ob).sum() <= 30:
                dd = float(direction(ob, j) @ vin)
                if dd > bdot:
                    best, bdot = ob, dd
        keep_out |= jlab == j
        if best is None:
            break
        chain.append(best)
        br, prev_j = best, j
    # the first branch can run on into an outline it meets at a shallow angle:
    # only the first 115 px from the free end belong to the leader
    start = tuple(ends[k]); q = deque([start]); dist = {start: 0}
    while q:
        r, c = q.popleft()
        for a_ in (-1, 0, 1):
            for b_ in (-1, 0, 1):
                nb_ = (r + a_, c + b_)
                if nb_ not in dist and branches[nb_] == chain[0]:
                    dist[nb_] = dist[(r, c)] + 1; q.append(nb_)
    for (r, c), dd in dist.items():
        if dd <= 115:
            erase[r, c] = True
    if len(dist) > 125:
        chain = chain[:1]  # cut short: it did not cross anything
    for b in chain[1:]:
        erase |= branches == b
erase &= ~(cv2.dilate(jd.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0)  # keep the outline at crossings
er = cv2.dilate(erase.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
ko = cv2.dilate(keep_out.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) > 0
clean = body.astype(bool) & ~(er & ~ko)
# drop specks left over at the crossings
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(clean.astype(np.uint8), 8)
for i in range(1, n2):
    if st2[i, cv2.CC_STAT_AREA] < 60:
        clean[lab2 == i] = False

# ---- 2. leader stubs left inside parts --------------------------------------
BOXES = [  # x0, y0, x1, y1 in the 2037 x 2223 drawing
    (1300, 850, 1420, 950),   # leader of 18
    (300, 1105, 440, 1230),   # 7, inside the lid
    (600, 1770, 650, 1910),   # 3, on the tank wall
    (1710, 1855, 1815, 1975), # 22
    (1880, 1530, 1925, 1560), # 10, fan
    (1880, 1760, 1925, 1790), # 10, fan
    (1175, 1365, 1240, 1405), # 15
    (150, 1670, 205, 1715),   # 11
]
img = clean.copy()
for _ in range(3):
    sk = skeletonize(img)
    P = np.pad(sk, 1)
    ring = [P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:], P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]]
    cross = sum((~ring[k] & ring[(k + 1) % 8]).astype(int) for k in range(8))
    cnt = sum(r.astype(int) for r in ring)
    jd = cv2.dilate((sk & (cross >= 3)).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    br = label(sk & ~jd, connectivity=2)
    erase = np.zeros_like(sk)
    for x0, y0, x1, y1 in BOXES:
        for r, c in np.argwhere(sk[y0:y1, x0:x1] & (cnt[y0:y1, x0:x1] == 1)) + (y0, x0):
            b = br[r, c]
            if not b:
                continue
            pts = np.argwhere(br == b)
            inside = ((pts[:, 0] >= y0 - 4) & (pts[:, 0] < y1 + 4) & (pts[:, 1] >= x0 - 4) & (pts[:, 1] < x1 + 4)).all()
            if inside and len(pts) <= 170:
                erase |= br == b
    erase &= ~(cv2.dilate(jd.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
    img &= ~(cv2.dilate(erase.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0)
n, lab, st, _ = cv2.connectedComponentsWithStats(img.astype(np.uint8), 8)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] < 60:
        img[lab == i] = False

# ---- 3. long leaders that cross several outlines, picked by a point on them --
SEEDS = [(1367, 888, 150), (373, 1133, 150), (634, 1890, 150)]  # x, y, longest branch to follow
sk = skeletonize(img)
P = np.pad(sk, 1)
ring = [P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:], P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]]
cross = sum((~ring[k] & ring[(k + 1) % 8]).astype(int) for k in range(8))
jd = cv2.dilate((sk & (cross >= 3)).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
br = label(sk & ~jd, connectivity=2)
jl = label(jd, connectivity=2)
K3 = np.ones((3, 3), np.uint8)

def touching(b):
    m = cv2.dilate((br == b).astype(np.uint8), K3) > 0
    return [j for j in np.unique(jl[m & jd]) if j]

def direction(b, j):
    pts = np.argwhere(br == b).astype(float)
    jc = np.argwhere(jl == j).mean(0)
    d = np.hypot(*(pts - jc).T)
    v = pts[d < d.min() + 14].mean(0) - jc
    return v / (np.linalg.norm(v) + 1e-9)

erase = np.zeros_like(sk)
for x, y, maxlen in SEEDS:
    pts = np.argwhere(br > 0)
    k = np.argmin(np.hypot(pts[:, 0] - y, pts[:, 1] - x))
    b0 = br[tuple(pts[k])]
    chain = {b0}
    todo = [(b0, None)]
    while todo:
        b, came = todo.pop()
        for j in touching(b):
            if j == came:
                continue
            vin = -direction(b, j)
            best, bdot = None, np.cos(np.radians(35))
            for ob in np.unique(br[cv2.dilate((jl == j).astype(np.uint8), K3) > 0]):
                if ob and ob not in chain and (br == ob).sum() <= maxlen:
                    dd = float(direction(ob, j) @ vin)
                    if dd > bdot:
                        best, bdot = ob, dd
            if best is not None:
                chain.add(best)
                todo.append((best, j))
    for b in chain:
        erase |= br == b
erase &= ~(cv2.dilate(jd.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
img &= ~(cv2.dilate(erase.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0)
n, lab, st, _ = cv2.connectedComponentsWithStats(img.astype(np.uint8), 8)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] < 60:
        img[lab == i] = False

# ---- 4. parts: first shape that contains a pixel owns it, the rest is tank ---
# polygons, or ('e', cx, cy, rx, ry) for an ellipse
PARTS = {
    # outdoor terminals 19 on the bushing heads, cut above the cylinder's top rim
    't16': [(480, 190), (605, 190), (605, 297), (480, 297)],
    't17': [(895, 715), (1020, 715), (1020, 783), (895, 783)],
    't18': [(1240, 780), (1370, 780), (1370, 874), (1240, 874)],
    # bushings 16-18, down to the bottom of the porcelain
    'b16': [(495, 297), (592, 297), (592, 958), (495, 958)],
    'b17': [(910, 783), (1006, 783), (1006, 1270), (910, 1270)],
    'b18': [(1256, 874), (1354, 874), (1354, 1362), (1256, 1362)],
    # bushing sockets 15: neck and bolted flange
    's16': ('e', 540, 1008, 80, 54),
    's17': ('e', 952, 1310, 96, 46),
    's18': ('e', 1312, 1410, 110, 50),
    'fanR': [(1786, 1430), (1955, 1430), (1955, 1888), (1786, 1888)],
    'ctl': [(1735, 1888), (1870, 1888), (1870, 1995), (1735, 1995)],
    'coolR': [(1398, 1452), (1545, 1382), (1662, 1382), (1662, 1340), (1760, 1335), (1975, 1335), (1975, 2015),
              (1398, 2015)],
    'box': [(1628, 1115), (1880, 1115), (1880, 1335), (1760, 1335), (1662, 1340), (1628, 1340)],
    'cons': [(596, 700), (1900, 700), (1900, 1335), (1760, 1335), (1662, 1340), (1662, 1382), (1545, 1382),
             (1352, 1318), (1352, 1312), (1262, 1302), (998, 1230),
             (915, 1214), (873, 1206), (596, 1108)],
    'fanL': [(95, 1150), (131, 1150), (131, 1575), (95, 1575)],
    # inlet 11 down the tank's end face, outlet 12 under the cooler
    'pipe': [(290, 1290), (300, 1240), (318, 1205), (345, 1188), (378, 1192), (380, 1240), (340, 1262),
             (340, 1640), (392, 1650), (392, 1775), (190, 1775), (190, 1690), (290, 1640)],
    'coolL': [(90, 1035), (432, 1035), (442, 1186), (367, 1238), (367, 1655), (396, 1690), (396, 1768), (90, 1768)],
    'lid': [(285, 1215), (400, 1120), (470, 1080), (596, 1108), (873, 1206), (915, 1214), (998, 1230),
            (1262, 1302), (1352, 1312), (1352, 1318), (1545, 1382), (1398, 1452), (1405, 1531),
            (600, 1316), (420, 1281), (285, 1264)],
}
ink = img.copy()
owner = np.zeros(ink.shape, np.int8)
names = list(PARTS) + ['tank']
for k, (name, shape) in enumerate(PARTS.items(), 1):
    m = np.zeros(ink.shape, np.uint8)
    if shape[0] == 'e':
        cv2.ellipse(m, shape[1:3], shape[3:5], 0, 0, 360, 1, -1)
    else:
        cv2.fillPoly(m, [np.array(shape, np.int32)], 1)
    owner[(owner == 0) & (m > 0)] = k
owner[owner == 0] = len(names)
# the conservator's long edges run on behind the bushings: bridge each gap
cons = names.index('cons') + 1
GAPS = [(910, 1006), (1256, 1354)]
for gl, gr in GAPS:
    xl, xr = gl - 5, gr + 5
    def crossings(x):
        col = (ink[:, x] & (owner[:, x] == cons)).astype(int)
        d = np.diff(np.r_[0, col, 0])
        return [(a + b - 1) / 2 for a, b in zip(np.where(d == 1)[0], np.where(d == -1)[0])]
    L, R = crossings(xl), crossings(xr)
    for yl in L:
        cand = [yr for yr in R if abs(yr - (yl + 0.30 * (xr - xl))) < 9]
        if cand:
            yr = min(cand, key=lambda v: abs(v - (yl + 0.30 * (xr - xl))))
            m = np.zeros(ink.shape, np.uint8)
            cv2.line(m, (xl, int(round(yl))), (xr, int(round(yr))), 1, 3)
            ink |= m > 0
            owner[(m > 0)] = cons

if len(sys.argv) > 2:  # preview of who owns what
    pal = np.array([[0, 0, 0]] + [[(37 * k) % 200 + 40, (91 * k) % 200 + 40, (151 * k) % 200 + 40] for k in range(1, len(names) + 1)], np.uint8)
    prev = np.full(ink.shape + (3,), 255, np.uint8)
    prev[ink] = pal[owner[ink]]
    for k, name in enumerate(names, 1):
        ys, xs = np.nonzero(ink & (owner == k))
        if len(xs):
            cv2.putText(prev, name, (int(xs.mean()), int(ys.mean())), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 0, 255), 3)
    cv2.imwrite(sys.argv[2], prev)

# ---- 5. one WebP per part at half size --------------------------------------
LINE = np.array([0xe6, 0xe6, 0xe6], np.float32) / 255  # light lines on the dark CAD canvas
FILL = np.array([0x1e, 0x1e, 0x1e], np.float32) / 255  # .cad__canvas background
S = 2
meta = {}
for k, name in enumerate(names, 1):
    m = ink & (owner == k)
    # drop slivers a boundary cut off from their line
    n_, lab_, st_, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    m &= np.isin(lab_, np.where(st_[:, cv2.CC_STAT_AREA] >= 150)[0][1:])
    sil = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    sil = binary_fill_holes(sil > 0) | m
    # cut edges get an outline too, so every part reads as a closed shape
    edge = sil & ~cv2.erode(sil.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))).astype(bool)
    m = m | edge
    # the panel shows the drawing small: lines a little heavier than in print
    m = cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))).astype(bool)
    h, w = m.shape
    h2, w2 = h // S * S, w // S * S
    la = m[:h2, :w2].reshape(h2 // S, S, w2 // S, S).mean((1, 3))
    fa = sil[:h2, :w2].reshape(h2 // S, S, w2 // S, S).mean((1, 3))
    A = la + fa * (1 - la)
    C = (LINE * la[..., None] + FILL * (fa * (1 - la))[..., None]) / np.maximum(A, 1e-6)[..., None]
    ys, xs = np.nonzero(A > 0)
    y0, y1, x0, x1 = max(ys.min() - 2, 0), ys.max() + 3, max(xs.min() - 2, 0), xs.max() + 3
    rgba = np.dstack([C[..., ::-1], A])[y0:y1, x0:x1]  # BGR + alpha for OpenCV
    cv2.imwrite(f'{OUT}/{name}.webp', (rgba * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 101])
    meta[name] = [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]
json.dump({'size': [w2 // S, h2 // S], 'parts': meta}, open(META, 'w'), indent=1)
print(meta)
