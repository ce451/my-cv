"""Procedural Lenovo ThinkPad P16s Gen 3 (Intel, black) for the scroll scene.

Dimensions follow Lenovo PSREF (361.5 x 248.6 x 21.13 mm, 16" 16:10 panel,
TrackPad 115 x 67.6 mm). Key, touchpad and port positions are measured from
Lenovo's orthographic product shots; the keyboard is the German/Austrian ISO
variant of that geometry. No logos on purpose.

Run headless:
  blender -b -P web/model/thinkpad.py -- --layout web/src/scene/keyboard-layout.json \
      [--glb /tmp/thinkpad.glb] [--preview /tmp/p.png --view three|top|front]
(the page no longer loads the glTF; render/scene.py builds the model with this script)

Blender is Z-up with the laptop front facing -Y; the glTF exporter converts to
Y-up, so in three.js the front faces +Z.

Measured positions use "photo millimetres": x from the centre line, y from
the front edge. P() converts them to model metres.
"""
import json
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

MM = 0.001

# --- overall dimensions -----------------------------------------------------
W = 361.5
D = 248.6
BASE_H = 14.4
LID_T = 5.9
CORNER_R = 4.0  # measured on the Lenovo top photo: 3.5 to 4 mm
OPEN_TILT = -18.0  # degrees; negative leans the lid back

HINGE_Y = 240.6  # photo mm from the front edge
HINGE_Z = BASE_H - 2.6

PANEL_W = 344.6  # 16" at 16:10, active area
PANEL_H = 215.4
LID_TOP = HINGE_Y  # lid top edge above the hinge axis: closed, the lid is flush with the front
LID_BOTTOM = -7.0  # lid bottom edge below the hinge axis (drops into the base)
TOP_BEZEL = 8.4
PANEL_CZ = LID_TOP - TOP_BEZEL - PANEL_H / 2

TRAY_DEPTH = 1.3  # keyboard sits in a shallow well
KEY_TOP = BASE_H + 0.9


def P(x, y):
    return x * MM, (y - D / 2) * MM


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = {}
    for i in range(0, len(argv) - 1, 2):
        out[argv[i].lstrip("-")] = argv[i + 1]
    return out


# --- 2D outlines (metres) -----------------------------------------------------
def arc(cx, cy, r, a0, a1, seg):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / seg), cy + r * math.sin(a0 + (a1 - a0) * i / seg))
            for i in range(seg + 1)]


def rrect(w, d, r, seg=8, cx=0.0, cy=0.0):
    """Rounded rectangle, counter-clockwise from above."""
    r = max(min(r, w / 2 - 1e-6, d / 2 - 1e-6), 1e-5)
    pts = []
    for ox, oy, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90),
                       (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)):
        pts += arc(cx + ox, cy + oy, r, math.radians(a0), math.radians(a0 + 90), seg)
    return pts


def ortho_outline(corners, r, inset=0.0, seg=6):
    """Axis-aligned polygon (CCW corner list) with filleted corners, offset inwards.

    Convex corners keep their arc centre and shrink by the inset, concave
    corners grow by it, so stacked insets stay parallel.
    """
    n = len(corners)
    pts = []
    for i in range(n):
        p = Vector(corners[i])
        a = (p - Vector(corners[i - 1])).normalized()
        b = (Vector(corners[(i + 1) % n]) - p).normalized()
        na = Vector((-a.y, a.x))
        nb = Vector((-b.y, b.x))
        convex = a.x * b.y - a.y * b.x > 0
        if convex:
            # past the fillet radius the arc would turn inside out: keep a small one
            rad = max(r - inset, 0.3 * MM)
            c = p + (na + nb) * (inset + rad)
            s, e = -na, -nb
        else:
            c = p - (na + nb) * r
            s, e, rad = na, nb, r + inset
        a0 = math.atan2(s.y, s.x)
        a1 = math.atan2(e.y, e.x)
        d = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        pts += arc(c.x, c.y, rad, a0, a0 + d, seg)
    return pts


def key_outline(w, h, r, inset, smile=0.0, cx=0.0, cy=0.0, seg=4):
    """ThinkPad keycap: rounded rectangle whose front edge sags into a 'smile'."""
    rr = max(r - inset, 0.6 * MM)  # deep insets (the dish) keep rounded corners instead of inverting them
    pts = rrect(w - 2 * inset, h - 2 * inset, rr, seg, cx, cy)
    if smile <= 0:
        return pts
    # insert points along the front edge, between the two front corner arcs
    front_y = cy - (h / 2 - inset)
    half = w / 2 - inset - rr
    i = 3 * (seg + 1)  # first point of the front-right arc
    edge = []
    for k in range(1, 8):
        x = cx - half + 2 * half * k / 8
        t = (x - cx) / (w / 2)
        edge.append((x, front_y - smile * (1 - t * t)))
    return pts[:i] + edge + pts[i:]


def convex_inset(poly, d):
    """Inset a convex CCW polygon by d."""
    n = len(poly)
    lines = []
    for i in range(n):
        p, q = Vector(poly[i]), Vector(poly[(i + 1) % n])
        t = (q - p).normalized()
        nrm = Vector((-t.y, t.x))
        lines.append((p + nrm * d, t))
    out = []
    for i in range(n):
        (p1, t1), (p2, t2) = lines[i - 1], lines[i]
        den = t1.x * t2.y - t1.y * t2.x
        s = ((p2.x - p1.x) * t2.y - (p2.y - p1.y) * t2.x) / den
        v = p1 + t1 * s
        out.append((v.x, v.y))
    return out


# --- solids -------------------------------------------------------------------
def loft_rings(bm, rings, matrix=Matrix(), cap_bottom=True, cap_top=True):
    """Closed solid through rings [[(x, y), ...], z] with equal point counts."""
    loops = []
    for pts, z in rings:
        loops.append([bm.verts.new(matrix @ Vector((x, y, z))) for x, y in pts])
    n = len(loops[0])
    for a, b in zip(loops, loops[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    caps = []
    if cap_bottom:
        caps.append(bm.faces.new(list(reversed(loops[0]))))
    if cap_top:
        caps.append(bm.faces.new(loops[-1]))
    for cap in caps:
        for e in cap.edges:
            e.tag = True  # caps stay flat; see to_object
    return loops


def loft(bm, w, d, r, rings, matrix=Matrix(), seg=8, cx=0.0, cy=0.0, **kw):
    """Rounded-rect solid lofted through [(inset, z), ...]."""
    return loft_rings(bm, [(rrect(w - 2 * i, d - 2 * i, max(r - i, 0.4 * MM), seg, cx, cy), z) for i, z in rings],
                      matrix, **kw)


def circle_loft(bm, radius, rings, matrix=Matrix(), seg=8, cx=0.0, cy=0.0):
    loft(bm, 2 * radius, 2 * radius, radius, rings, matrix, seg, cx, cy)


def material(name, color, rough, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1.0)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    return m


def srgb(hex_):
    """Hex sRGB to linear floats (Blender colour inputs are linear)."""
    out = []
    for i in (0, 2, 4):
        c = int(hex_[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def to_object(bm, name, mat, parent=None, smooth_angle=40, planar_uv=None):
    if planar_uv is not None:
        x0, y0, x1, y1 = planar_uv
        uv = bm.loops.layers.uv.new("UVMap")
        for f in bm.faces:
            for loop in f.loops:
                co = loop.vert.co
                loop[uv].uv = ((co.x - x0) / (x1 - x0), (co.y - y0) / (y1 - y0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    limit = math.radians(smooth_angle)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = not e.tag and (len(e.link_faces) != 2 or e.calc_face_angle(0.0) < limit)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


# --- keyboard (photo mm) ------------------------------------------------------
ROWS = {0: (192.0, 202.3), 1: (173.2, 188.4), 2: (154.5, 169.7), 3: (135.5, 150.8),
        4: (116.6, 132.0), 5: (97.9, 113.2)}
NUM_X = [(104.2, 118.6), (121.8, 136.2), (139.4, 153.8), (157.0, 171.4)]
TRAY = [(-173.8, 95.4), (50.4, 95.4), (50.4, 88.3), (103.2, 88.3), (103.2, 95.4),
        (173.8, 95.4), (173.8, 204.5), (-173.8, 204.5)]
TRACKPOINT = (-47.15, 133.8)

# legend helpers: (text, rx, ry, size_mm, align); "@name" draws an icon
L = "l"
R = "r"
C = "c"


def letter(ch):
    return [(ch, 0.22, 0.34, 4.0, L)]


def two(top, bottom, altgr=None):
    out = [(top, 0.22, 0.30, 3.0, L), (bottom, 0.22, 0.70, 3.4, L)]
    if altgr:
        out.append((altgr, 0.80, 0.70, 2.6, R))
    return out


def word(text, size=2.3, rx=0.14, ry=0.32, align=L):
    return [(text, rx, ry, size, align)]


def fkey(n, icon):
    return [(icon, 0.28, 0.36, 3.0, C), (f"F{n}", 0.14, 0.76, 1.6, L)]


def keyboard_layout():
    """List of keys: dict(x0, x1, y0, y1, legends, shape)."""
    keys = []

    def add(x0, x1, row, legends, y=None, shape=None):
        y0, y1 = y if y else ROWS[row]
        keys.append({"x0": x0, "x1": x1, "y0": y0, "y1": y1, "legends": legends, "shape": shape, "row": row})

    def run(row, start, pitch, width, legend_list):
        for i, lg in enumerate(legend_list):
            add(start + i * pitch, start + i * pitch + width, row, lg)

    # function row
    add(-171.1, -150.5, 0, [("Esc", 0.14, 0.34, 2.2, L), ("FnLock", 0.14, 0.74, 1.5, L)])
    icons = ["@mute", "@voldn", "@volup", "@micoff", "@sundn", "@sunup", "@display", "Mode",
             "Druck", "@bubble", "@phone", "@star"]
    for g, start in enumerate((-149.8, -88.2, -25.4)):
        for i in range(4):
            n = g * 4 + i + 1
            ic = icons[n - 1]
            lg = fkey(n, ic) if ic.startswith("@") else [(ic, 0.14, 0.36, 1.9, L), (f"F{n}", 0.14, 0.76, 1.6, L)]
            add(start + i * 14.85, start + i * 14.85 + 13.7, 0, lg)
    run(0, 35.7, 17.0, 14.0, [word("Pos1", 2.0), word("Ende", 2.0), word("Einfg", 2.0), word("Entf", 2.0)])
    for (x0, x1), lg in zip(NUM_X, [[("@calc", 0.28, 0.4, 3.2, C)], [("(", 0.25, 0.4, 3.0, L)],
                                    [(")", 0.25, 0.4, 3.0, L)], [("@back", 0.30, 0.40, 3.0, C)]]):
        add(x0, x1, 0, lg)

    # number row
    add(-171.1, -158.1, 1, two("°", "^"))
    run(1, -155.1, 19.0, 16.0, [two("!", "1"), two('"', "2", "²"), two("§", "3", "³"), two("$", "4"),
                                 two("%", "5"), two("&", "6"), two("/", "7", "{"), two("(", "8", "["),
                                 two(")", "9", "]"), two("=", "0", "}"), two("?", "ß", "\\"), two("`", "´")])
    add(72.9, 100.7, 1, [("@back", 0.20, 0.36, 3.4, C)])

    # Q row and ISO Enter (one L-shaped key across rows 2 and 3)
    add(-171.1, -148.6, 2, [("@tab", 0.24, 0.36, 3.4, C)])
    run(2, -145.6, 19.0, 16.0, [letter(c) for c in "QWERTZUIOP"] + [letter("Ü"), two("*", "+", "~")])
    enter_y = (ROWS[3][0], ROWS[2][1])
    keys.append({"x0": 82.4, "x1": 100.7, "y0": enter_y[0], "y1": enter_y[1], "row": 2,
                 "rects": [(82.4, 100.7, ROWS[2][0], ROWS[2][1]), (87.4, 100.7, ROWS[3][0], ROWS[2][0])],
                 "legends": [("@enter", 0.62, 0.17, 3.4, C)],
                 "shape": [(87.4, ROWS[3][0]), (100.7, ROWS[3][0]), (100.7, ROWS[2][1]),
                           (82.4, ROWS[2][1]), (82.4, ROWS[2][0]), (87.4, ROWS[2][0])]})

    # A row
    add(-171.1, -144.1, 3, [("@caps", 0.20, 0.36, 3.4, C)])
    run(3, -140.6, 19.0, 16.0, [letter(c) for c in "ASDFGHJKL"] + [letter("Ö"), letter("Ä"), two("'", "#")])

    # Y row (ISO: short left shift plus the <> key)
    add(-171.1, -154.1, 4, [("@shift", 0.30, 0.36, 3.4, C)])
    add(-150.6, -134.6, 4, two(">", "<", "|"))
    run(4, -131.1, 19.0, 15.9, [letter(c) for c in "YXCVBN"] + [letter("M") + [("µ", 0.80, 0.70, 2.6, R)]]
        + [two(";", ","), two(":", "."), two("_", "-")])
    add(58.9, 100.7, 4, [("@shift", 0.15, 0.36, 3.4, C)])

    # bottom row
    add(-171.1, -154.3, 5, word("Strg"))
    add(-151.3, -134.6, 5, word("Fn"))
    add(-131.1, -115.2, 5, [("@win", 0.5, 0.5, 3.2, C)])
    add(-112.1, -96.2, 5, word("Alt"))
    add(-93.1, -0.8, 5, [])
    add(2.2, 16.0, 5, word("Alt Gr", 2.1))
    add(19.0, 32.6, 5, [("@copilot", 0.5, 0.5, 4.2, C)])
    add(35.8, 49.6, 5, word("Strg"))

    # arrow cluster: half-height page keys beside the up arrow, lowered bottom row
    add(52.5, 67.2, 5, word("Bild▲", 1.9, 0.5, 0.5, C), y=(104.0, 113.4))
    add(69.4, 84.0, 5, [("@up", 0.5, 0.46, 3.2, C)], y=(101.5, 113.4))
    add(86.4, 100.9, 5, word("Bild▼", 1.9, 0.5, 0.5, C), y=(104.0, 113.4))
    add(52.5, 67.2, 5, [("@left", 0.5, 0.5, 3.2, C)], y=(90.4, 101.8))
    add(69.4, 84.0, 5, [("@down", 0.5, 0.5, 3.2, C)], y=(90.4, 100.9))
    add(86.4, 100.9, 5, [("@right", 0.5, 0.5, 3.2, C)], y=(90.4, 101.8))

    # numeric keypad
    def num(main, sub=None):
        out = [(main, 0.22, 0.34, 3.6, L)]
        if sub:
            out.append((sub, 0.22, 0.74, 1.8, L))
        return out

    for (x0, x1), lg in zip(NUM_X, [word("Num", 2.0), num("/"), num("*"), num("-")]):
        add(x0, x1, 1, lg)
    for row, labels in ((2, [("7", "Pos1"), ("8", "▲"), ("9", "Bild▲")]),
                        (3, [("4", "◀"), ("5", None), ("6", "▶")]),
                        (4, [("1", "Ende"), ("2", "▼"), ("3", "Bild▼")])):
        for (x0, x1), (m, s) in zip(NUM_X[:3], labels):
            add(x0, x1, row, num(m, s))
    add(*NUM_X[3], 2, num("+"), y=(ROWS[3][0], ROWS[2][1]))
    add(*NUM_X[3], 4, [("@enter", 0.5, 0.30, 3.0, C)], y=(ROWS[5][0], ROWS[4][1]))
    add(NUM_X[0][0], NUM_X[1][1], 5, num("0", "Einfg"))
    add(*NUM_X[2], 5, num(",", "Entf"))
    return keys


KEY_GROW = 0.8  # mm per side beyond the photo-measured caps: tighter gaps
MIN_GAP = 1.0  # never closer than this between two caps
EDGE_GAP = 1.0  # clearance to the keyboard well


def grow_keys(keys):
    """Enlarges every cap towards its neighbours, as far as the gaps allow."""
    rects = [k.get("rects") or [(k["x0"], k["x1"], k["y0"], k["y1"])] for k in keys]
    tx0, tx1, ty1 = TRAY[0][0], TRAY[5][0], TRAY[6][1]
    eps = 0.01
    for i, k in enumerate(keys):
        g = dict(l=KEY_GROW, r=KEY_GROW, b=KEY_GROW, t=KEY_GROW)
        for ax0, ax1, ay0, ay1 in rects[i]:
            floor = TRAY[2][1] if ax0 >= TRAY[1][0] and ax1 <= TRAY[3][0] else TRAY[0][1]
            g["l"] = min(g["l"], ax0 - tx0 - EDGE_GAP)
            g["r"] = min(g["r"], tx1 - ax1 - EDGE_GAP)
            g["t"] = min(g["t"], ty1 - ay1 - EDGE_GAP)
            g["b"] = min(g["b"], ay0 - floor - EDGE_GAP)
            for j, other in enumerate(rects):
                if j == i:
                    continue
                for bx0, bx1, by0, by1 in other:
                    ys = by0 < ay1 - eps and by1 > ay0 + eps
                    xs = bx0 < ax1 - eps and bx1 > ax0 + eps
                    if ys and bx0 >= ax1 - eps:
                        g["r"] = min(g["r"], (bx0 - ax1 - MIN_GAP) / 2)
                    if ys and bx1 <= ax0 + eps:
                        g["l"] = min(g["l"], (ax0 - bx1 - MIN_GAP) / 2)
                    if xs and by0 >= ay1 - eps:
                        g["t"] = min(g["t"], (by0 - ay1 - MIN_GAP) / 2)
                    if xs and by1 <= ay0 + eps:
                        g["b"] = min(g["b"], (ay0 - by1 - MIN_GAP) / 2)
        g = {s: max(0.0, v) for s, v in g.items()}
        if k["shape"]:
            k["grow"] = min(g.values())
        else:
            k["x0"] -= g["l"]
            k["x1"] += g["r"]
            k["y0"] -= g["b"]
            k["y1"] += g["t"]
    return keys


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    args = parse_args()

    m_chassis = material("chassis", srgb("17181a"), 0.55)
    m_keys = material("keys", srgb("141416"), 0.5)
    m_touch = material("touchpad", srgb("151618"), 0.4)
    m_red = material("trackpoint", srgb("c41e24"), 0.85)
    m_panel = material("panel", srgb("050506"), 0.3)
    m_screen = material("screen", srgb("000000"), 0.9)
    m_black = material("port", srgb("060607"), 0.9)
    m_lens = material("lens", srgb("020203"), 0.12)
    m_iris = material("lens-iris", srgb("3a1c0e"), 0.15)  # the warm glint in the middle of the lens
    m_shutter = material("shutter", srgb("030304"), 0.5)
    m_led = material("led", srgb("0b0b0c"), 0.6)
    m_floor = material("kbfloor", srgb("1c1d20"), 0.75)

    root = bpy.data.objects.new("ThinkPad", None)
    bpy.context.scene.collection.objects.link(root)

    # base shell: undercut, straight sides, soft top edge; the top cap has the
    # keyboard well cut out of it
    bm = bmesh.new()
    rings = [(4.0, 0.0), (1.0, 3.4), (0.0, 4.8), (0.0, BASE_H - 0.8), (0.25, BASE_H - 0.25), (0.8, BASE_H)]
    loops = loft(bm, W * MM, D * MM, CORNER_R * MM, [(i * MM, z * MM) for i, z in rings], cap_top=False)
    tray = [P(x, y) for x, y in TRAY]
    tray_top = ortho_outline(tray, 2.4 * MM)
    tray_floor = ortho_outline(tray, 2.4 * MM, inset=0.5 * MM)
    well = loft_rings(bm, [(tray_floor, (BASE_H - TRAY_DEPTH) * MM), (tray_top, BASE_H * MM)], cap_top=False)
    edges = [bm.edges.get((a, b)) or bm.edges.new((a, b)) for lp in (loops[-1], well[-1])
             for a, b in zip(lp, lp[1:] + lp[:1])]
    res = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges, normal=(0, 0, 1))
    for f in res["geom"]:
        if isinstance(f, bmesh.types.BMFace):
            for e in f.edges:
                e.tag = True
    to_object(bm, "Base", m_chassis, root, smooth_angle=40)

    # keycaps, joined, with a planar UV over the keyboard well for the legends
    kb = (TRAY[0][0], 88.3, TRAY[5][0], TRAY[6][1])  # x0, y0, x1, y1 (photo mm)
    u0, v0 = P(kb[0], kb[1])
    u1, v1 = P(kb[2], kb[3])
    bm = bmesh.new()
    out_keys = []
    z0 = (BASE_H - TRAY_DEPTH) * MM
    zt = KEY_TOP * MM
    for k in grow_keys(keyboard_layout()):
        x0, y0 = P(k["x0"], k["y0"])
        x1, y1 = P(k["x1"], k["y1"])
        cx, cy, w, h = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
        if k["shape"]:
            corners = [P(x, y) for x, y in k["shape"]]
            ring = lambda i, g=k["grow"]: ortho_outline(corners, 1.5 * MM, (i - g) * MM, seg=4)
        else:
            smile = 0.45 * MM if k["row"] in (1, 2, 3, 4, 5) and h > 12 * MM else 0.0
            ring = lambda i, w=w, h=h, cx=cx, cy=cy, smile=smile: key_outline(w, h, 1.6 * MM, i * MM, smile, cx, cy)
        # sides, rounded top edge, then a shallow dish like the real caps (0.3 mm deep)
        room = (min(w, h) / MM if not k["shape"] else 12.0) / 2 - 1.4
        m = max(room - 0.55, 0.5)
        depth = 0.3 * MM * min(1.0, m / 4.5)
        dish = [(0.55 + m * f, zt - depth * d) for f, d in ((0.3, 0.38), (0.62, 0.78), (1.0, 1.0))]
        loops = loft_rings(bm, [(ring(0.0), z0), (ring(0.08), zt - 0.9 * MM), (ring(0.3), zt - 0.2 * MM),
                                (ring(0.55), zt)] + [(ring(i), z) for i, z in dish], cap_top=False)
        # untagged: the dish shades smoothly into its floor; poked into a fan around the
        # centre, since a corner fan smears the tilted rim normals into a diagonal crease
        bmesh.ops.poke(bm, faces=[bm.faces.new(loops[-1])])
        out_keys.append({
            "u": (x0 - u0) / (u1 - u0), "v": (v1 - y1) / (v1 - v0),
            "w": w / (u1 - u0), "h": h / (v1 - v0),
            "legends": k["legends"], "shape": k["shape"] is not None,
        })
    to_object(bm, "Keys", m_keys, root, smooth_angle=50, planar_uv=(u0, v0, u1, v1))

    # keyboard floor, visible in the gaps
    bm = bmesh.new()
    loft_rings(bm, [(ortho_outline(tray, 2.4 * MM, inset=0.4 * MM), (BASE_H - TRAY_DEPTH - 0.4) * MM),
                    (ortho_outline(tray, 2.4 * MM, inset=0.4 * MM), (BASE_H - TRAY_DEPTH + 0.02) * MM)])
    to_object(bm, "KeyboardFloor", m_floor, root)

    # TrackPoint between G, H and B
    tx, ty = P(*TRACKPOINT)
    bm = bmesh.new()
    circle_loft(bm, 3.8 * MM, [
        (0.0, zt - 0.6 * MM), (0.0, zt + 0.7 * MM), (0.8 * MM, zt + 1.15 * MM), (1.9 * MM, zt + 1.3 * MM)],
        seg=6, cx=tx, cy=ty)
    to_object(bm, "TrackPoint", m_red, root, smooth_angle=60)

    # touchpad module: pad and three buttons in one dark frame
    pad_x0, pad_x1 = -104.4, 10.6
    pad_front, pad_back, btn_back = 6.5, 74.1, 88.2
    bm = bmesh.new()
    fx0, fy0 = P(pad_x0 - 0.6, pad_front - 0.6)
    fx1, fy1 = P(pad_x1 + 0.6, btn_back + 0.6)
    loft(bm, fx1 - fx0, fy1 - fy0, 2.6 * MM, [(0.0, (BASE_H - 1.0) * MM), (0.0, (BASE_H + 0.01) * MM)],
         cx=(fx0 + fx1) / 2, cy=(fy0 + fy1) / 2)
    to_object(bm, "TouchFrame", m_black, root)

    bm = bmesh.new()
    px0, py0 = P(pad_x0, pad_front)
    px1, py1 = P(pad_x1, pad_back - 0.35)
    loft(bm, px1 - px0, py1 - py0, 2.0 * MM, [
        (0.0, (BASE_H - 0.6) * MM), (0.0, (BASE_H - 0.05) * MM), (0.3 * MM, (BASE_H + 0.06) * MM)],
        cx=(px0 + px1) / 2, cy=(py0 + py1) / 2)
    to_object(bm, "Touchpad", m_touch, root)

    mid = -47.0
    btn_y0 = pad_back + 0.35
    polys = [
        [(pad_x0, btn_y0), (mid - 9.0 - 0.8, btn_y0), (mid - 11.9 - 0.8, btn_back), (pad_x0, btn_back)],
        [(mid - 9.0, btn_y0), (mid + 9.0, btn_y0), (mid + 11.9, btn_back), (mid - 11.9, btn_back)],
        [(mid + 9.0 + 0.8, btn_y0), (pad_x1, btn_y0), (pad_x1, btn_back), (mid + 11.9 + 0.8, btn_back)],
    ]
    bm = bmesh.new()
    for poly in polys:
        pts = [P(x, y) for x, y in poly]
        loft_rings(bm, [(convex_inset(pts, 0.0), (BASE_H - 0.6) * MM),
                        (convex_inset(pts, 0.0), (BASE_H + 0.05) * MM),
                        (convex_inset(pts, 0.3 * MM), (BASE_H + 0.17) * MM)])
    to_object(bm, "TrackPointButtons", m_touch, root)

    # red accents: only along the front of the outer buttons (notebookcheck photo
    # of the P16s G2); the middle button has none
    bm = bmesh.new()
    zr = (BASE_H + 0.02) * MM

    def strip(a, b, width=0.45):
        (ax, ay), (bx, by) = P(*a), P(*b)
        t = Vector((bx - ax, by - ay)).normalized()
        n = Vector((-t.y, t.x)) * width * MM / 2
        pts = [(ax - n.x, ay - n.y), (bx - n.x, by - n.y), (bx + n.x, by + n.y), (ax + n.x, ay + n.y)]
        loft_rings(bm, [(pts, zr - 0.2 * MM), (pts, zr)])

    strip((pad_x0 + 1.5, pad_back), (mid - 10.6, pad_back))
    strip((mid + 10.6, pad_back), (pad_x1 - 1.5, pad_back))
    to_object(bm, "ButtonStripes", m_red, root)

    # power button with fingerprint reader: dark gap ring, cap just proud of the deck
    bx, by = P(138.0, 220.1)
    bm = bmesh.new()
    circle_loft(bm, 5.6 * MM, [(0.0, (BASE_H - 0.5) * MM), (0.0, (BASE_H + 0.02) * MM)], seg=10, cx=bx, cy=by)
    to_object(bm, "PowerRing", m_black, root)
    bm = bmesh.new()
    circle_loft(bm, 5.0 * MM, [
        (0.0, (BASE_H - 0.4) * MM), (0.0, (BASE_H + 0.06) * MM), (0.35 * MM, (BASE_H + 0.16) * MM)],
        seg=10, cx=bx, cy=by)
    to_object(bm, "PowerButton", m_chassis, root)
    bm = bmesh.new()
    lx, ly = P(128.5, 219.9)
    circle_loft(bm, 0.45 * MM, [(0.0, (BASE_H - 0.2) * MM), (0.0, (BASE_H + 0.02) * MM)], seg=3, cx=lx, cy=ly)
    to_object(bm, "PowerLed", m_led, root)

    # ports as flush black insets; side < 0 is left. pos = photo mm from the front
    left_rot = Matrix.Rotation(math.radians(-90), 4, "Y")
    right_rot = Matrix.Rotation(math.radians(90), 4, "Y")
    bm = bmesh.new()

    def port(side, pos, w, h, z=7.0, r=0.6):
        rot = left_rot if side < 0 else right_rot
        _, y = P(0, pos)
        m = Matrix.Translation((side * (W / 2 - 0.25) * MM, y, z * MM)) @ rot
        loft(bm, h * MM, w * MM, r * MM, [(0.0, 0.0), (0.0, 0.3 * MM)], m, seg=3)

    port(-1, 210.2, 15.0, 5.6, r=0.8)  # HDMI
    port(-1, 188.6, 8.6, 3.0, r=1.45)  # Thunderbolt
    port(-1, 171.6, 8.6, 3.0, r=1.45)  # Thunderbolt
    port(-1, 152.6, 12.6, 5.0, r=0.5)  # USB-A
    port(-1, 137.0, 3.6, 3.6, r=1.79)  # audio
    port(1, 62.0, 53.7, 1.4, z=7.6, r=0.6)  # smart card
    port(1, 168.3, 12.0, 1.4, z=7.6, r=0.5)  # nano-SIM / microSD tray
    port(1, 192.9, 12.6, 5.0, r=0.5)  # USB-A
    port(1, 218.2, 14.0, 8.0, z=7.6, r=0.6)  # RJ-45 with drop-jaw
    port(1, 235.9, 5.5, 2.6, r=0.6)  # lock slot
    to_object(bm, "Ports", m_black, root)

    # lid: empty on the hinge axis, children modelled standing upright
    lid = bpy.data.objects.new("Lid", None)
    bpy.context.scene.collection.objects.link(lid)
    lid.parent = root
    hx, hy = P(0, HINGE_Y)
    lid.location = (0, hy, HINGE_Z * MM)
    lid.rotation_euler = (math.radians(OPEN_TILT), 0, 0)
    # loft xy = lid plane (y = height), loft z = thickness towards the user
    stand = Matrix.Translation((0, LID_T / 2 * MM, 0)) @ Matrix.Rotation(math.radians(90), 4, "X")
    lid_h = LID_TOP - LID_BOTTOM
    lid_cy = (LID_TOP + LID_BOTTOM) / 2

    bm = bmesh.new()
    loft(bm, W * MM, lid_h * MM, CORNER_R * MM, [
        (0.9 * MM, 0.0), (0.25 * MM, 0.4 * MM), (0.0, 1.1 * MM),
        (0.0, (LID_T - 0.6) * MM), (0.3 * MM, (LID_T - 0.15) * MM), (0.7 * MM, LID_T * MM)],
        stand, cy=lid_cy * MM)
    to_object(bm, "LidShell", m_chassis, lid)

    # communications bar, after his photos of the front and the back: a housing
    # with round ends on the top edge, 98 x 10.5 mm; its back is flush with the lid
    # behind a fine seam (scene.py prints "P16s" on it), its front is flush with
    # the panel (just behind it, so the panel covers it below the lid edge)
    bar_w, bar_up, bar_down, bar_fwd = 98.0, 3.0, 7.5, 0.1
    bar_h = bar_up + bar_down
    bar_cy = LID_TOP + (bar_up - bar_down) / 2
    bm = bmesh.new()
    loft(bm, bar_w * MM, bar_h * MM, bar_h / 2 * MM, [
        (0.25 * MM, -0.03 * MM), (0.0, 0.3 * MM),
        (0.0, (LID_T + bar_fwd - 0.5) * MM), (0.35 * MM, (LID_T + bar_fwd - 0.1) * MM), (0.8 * MM, (LID_T + bar_fwd) * MM)],
        stand, seg=12, cy=bar_cy * MM)
    to_object(bm, "CommBar", m_chassis, lid)

    # the whole front face is one black surface, like the real bezel and panel
    bm = bmesh.new()
    face_bot = LID_BOTTOM + 1.0
    face_top = LID_TOP - 1.0
    loft(bm, (W - 2.0) * MM, (face_top - face_bot) * MM, (CORNER_R - 1.0) * MM, [
        (0.0, (LID_T - 0.1) * MM), (0.0, (LID_T + 0.12) * MM)],
        stand, seg=6, cy=(face_top + face_bot) / 2 * MM)
    to_object(bm, "Panel", m_panel, lid)

    # on the front of the bar, measured on his photo from the camera outwards:
    # the lens in a black ring, the privacy shutter (open) to its right with its
    # slider on the top edge, a sensor to the left, the microphones further out
    cam_z = (LID_T + 0.12) * MM  # on the panel's front
    cam_y = (LID_TOP - 2.6) * MM
    face = lambda a, b: [(0.0, cam_z + a * MM), (0.0, cam_z + b * MM)]
    bm = bmesh.new()
    loft(bm, 12.0 * MM, 5.5 * MM, 2.75 * MM, face(-0.05, 0.06), stand, seg=8, cx=10.0 * MM, cy=cam_y)
    to_object(bm, "Shutter", m_shutter, lid)
    bm = bmesh.new()
    for dx, rad in ((-9.6, 0.6), (-24.2, 0.65), (24.2, 0.65)):
        circle_loft(bm, rad * MM, face(-0.05, 0.01), stand, seg=4, cx=dx * MM, cy=cam_y)
    to_object(bm, "BarHoles", m_black, lid)
    bm = bmesh.new()
    circle_loft(bm, 3.25 * MM, face(-0.05, 0.05), stand, seg=8, cy=cam_y)
    loft(bm, 11.6 * MM, 0.8 * MM, 0.35 * MM, [(0.0, 2.5 * MM), (0.0, (LID_T + bar_fwd - 0.4) * MM)], stand, seg=4,
         cx=4.2 * MM, cy=(LID_TOP + bar_up + 0.1) * MM)
    to_object(bm, "CameraRing", m_panel, lid)
    bm = bmesh.new()
    circle_loft(bm, 2.0 * MM, face(0.05, 0.08), stand, seg=8, cy=cam_y)
    to_object(bm, "Camera", m_lens, lid, smooth_angle=60)
    bm = bmesh.new()
    circle_loft(bm, 0.75 * MM, face(0.08, 0.09), stand, seg=6, cy=cam_y)
    to_object(bm, "CameraIris", m_iris, lid, smooth_angle=60)

    # the screen: a plain quad whose local bounds are the active area
    bm = bmesh.new()
    vs = [bm.verts.new((x * PANEL_W / 2 * MM, y * PANEL_H / 2 * MM, 0)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm.faces.new(vs)
    scr = to_object(bm, "Screen", m_screen, lid, smooth_angle=10)
    scr.location = (0, (-LID_T / 2 - 0.2) * MM, PANEL_CZ * MM)
    scr.rotation_euler = (math.radians(90), 0, 0)

    if "layout" in args:
        with open(args["layout"], "w", encoding="utf-8") as fh:
            json.dump({"keys": out_keys, "mm": [kb[2] - kb[0], kb[3] - kb[1]]}, fh, ensure_ascii=False)
    if "glb" in args:
        bpy.ops.export_scene.gltf(filepath=args["glb"], export_format="GLB", export_apply=True)
    if "preview" in args:
        preview(args["preview"], args.get("view", "three"))


def preview(path, view):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 1400, 875
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.6, 0.6, 0.62, 1)
    sc.world = world
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    cam.data.lens = 50
    cam.location = (-0.42, -0.55, 0.42)
    target = Vector((0.0, 0.03, 0.06))
    if view == "top":
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = 0.40
        cam.location = (0.0, 0.0, 1.0)
        target = Vector((0.0, 0.0, 0.0))
    elif view == "front":
        cam.location = (0.0, -1.1, 0.30)
        target = Vector((0.0, 0.05, 0.12))
    elif view == "left":
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = 0.30
        cam.location = (-1.0, 0.0, 0.06)
        target = Vector((0.0, 0.0, 0.06))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    for loc, energy, size in (((-0.6, -0.4, 0.8), 30, 0.8), ((0.5, 0.6, 0.4), 15, 0.6), ((0.0, -0.8, 0.3), 8, 1.0)):
        light = bpy.data.objects.new("l", bpy.data.lights.new("l", "AREA"))
        light.data.energy = energy
        light.data.size = size
        light.location = loc
        light.rotation_euler = (Vector((0, 0, 0.05)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(light)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


build()
