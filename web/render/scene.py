"""Photoreal Cycles render of the desk scene: the ThinkPad from model/thinkpad.py
on a varnished wooden desk in the evening, lit by a warm desk lamp and its own
screen, with an A5 notepad and a ballpoint pen to the right.

Runs after the model script in the same Blender session:
  blender -b -P web/model/thinkpad.py -P web/render/scene.py -- \\
      --assets <render-assets folder> --tex <folder with note-color.png, note-ink.png> \\
      --out shot.png [--shot laptopPose] [--samples 128] [--res 1920x1200]

The assets folder holds CC0 downloads and exports from the dev server:
  hdri/fireplace_4k.hdr, tex/oak_veneer_01_{diff,rough,nor_gl}_4k.jpg (Poly Haven),
  tex/Fingerprints006/, tex/Fingerprints009/ (ambientCG 4K-JPG),
  laptop/legend.png, laptop/legend-glow.png, laptop/wordmark-rough.png,
  laptop/wordmark.json (textures.ts, drawn in the browser),
  laptop/screen-{hero,now,term}.png (the display content at 2880x1800: hero, CAD
  drawing, CV in micro; they light the keyboard, the page lays its DOM over the panel),
  The camera poses come from src/scene/poses.json (window.__poses of /?gl).

Shots: --shot laptopPose|nowPose|coverPose|zoomPose|readPose|shutPose|notePose
(web cameras), ref (studio check against the notebookcheck photos), macro.
Finish with render/post.py (vignetting, grain).

Sequences for the page: --seq path.json (render/path.ts) --seqdir <folder>
[--segs pull,now] [--step 1] [--force 0] renders every frame of the camera path
to <seqdir>/<seg>/NNN.png and writes the display and note corners of each frame
(viewport fractions) to <seqdir>/<seg>.json. Finished frames are skipped, so an
interrupted run resumes. Then render/pack.py makes the page assets.

Coordinates: Blender is Z-up with the laptop front facing -Y. The web scene
(three.js, Y-up, front +Z) maps as blender (x, y, z) = three (x, -z, y).
"""
import json
import math
import pathlib
import sys

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

MM = 0.001
BACKLIT = 3.0  # emission of the keyboard backlight when fully on


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = {}
    for i in range(0, len(argv) - 1, 2):
        out[argv[i].lstrip("-")] = argv[i + 1]
    return out


A = args()
ASSETS = A["assets"]
sc = bpy.context.scene


def num(key, default):
    return float(A.get(key, default))


# --- node helpers ----------------------------------------------------------------
def principled(name, **inputs):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    for k, v in inputs.items():
        p.inputs[k].default_value = v
    return m, nt, p


def lin(hex_):
    c = [int(hex_[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def image(nt, path, colorspace="sRGB", extension="REPEAT"):
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = bpy.data.images.load(path, check_existing=True)
    n.image.colorspace_settings.name = colorspace
    n.extension = extension
    return n


def node(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def math_node(nt, op, a=None, b=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def map_range(nt, value, lo, hi, a=0.0, b=1.0):
    n = node(nt, "ShaderNodeMapRange")
    n.inputs["From Min"].default_value = a
    n.inputs["From Max"].default_value = b
    n.inputs["To Min"].default_value = lo
    n.inputs["To Max"].default_value = hi
    nt.links.new(value, n.inputs["Value"])
    return n.outputs["Result"]


def coords(nt, obj=None):
    """object-space coordinates; with obj, in that object's space, so several
    parts of one body share one continuous pattern"""
    tc = nt.nodes.new("ShaderNodeTexCoord")
    if obj is not None:
        tc.object = obj
    return tc.outputs["Object"]


def noise(nt, vec, scale, detail=6.0, rough=0.55, distortion=0.0):
    n = node(nt, "ShaderNodeTexNoise", Scale=scale, Detail=detail, Roughness=rough, Distortion=distortion)
    nt.links.new(vec, n.inputs["Vector"])
    return n.outputs["Fac"]


def bump(nt, height, strength, distance, normal=None):
    b = node(nt, "ShaderNodeBump", Strength=strength, Distance=distance)
    nt.links.new(height, b.inputs["Height"])
    if normal is not None:
        nt.links.new(normal, b.inputs["Normal"])
    return b.outputs["Normal"]


def wear(nt, vec, base, smudge, scale=9.0):
    """roughness of a used surface: soft greasy patches (lower roughness) over a
    fine even grain"""
    patches = map_range(nt, noise(nt, vec, scale, detail=3, rough=0.5, distortion=0.4), 0.0, 1.0, 0.5, 0.7)
    smooth = math_node(nt, "MULTIPLY", patches, smudge)
    return math_node(nt, "SUBTRACT", base, smooth)


def prints(nt, vec, palm=False):
    """finger marks (ambientCG Fingerprints, CC0; one 4K tile ~ 22 cm): sparse
    ones everywhere, dense ones where the hands rest (palm rest: y < -3 cm in
    laptop space). 0 = clean, ~0.7 = a fresh print"""
    def tile(name, scale):
        sc_ = node(nt, "ShaderNodeVectorMath")
        sc_.operation = "SCALE"
        sc_.inputs["Scale"].default_value = scale
        nt.links.new(vec, sc_.inputs[0])
        t = image(nt, f"{ASSETS}/tex/{name}/{name}_4K-JPG_Opacity.jpg", "Non-Color")
        nt.links.new(sc_.outputs["Vector"], t.inputs["Vector"])
        return t.outputs["Color"]
    out = tile("Fingerprints006", 4.5)
    if palm:
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(vec, sep.inputs["Vector"])
        mask = map_range(nt, sep.outputs["Y"], 0.0, 1.0, -0.03, -0.065)
        dense = math_node(nt, "MULTIPLY", tile("Fingerprints009", 4.1), mask)
        out = math_node(nt, "MAXIMUM", out, dense)
    return out


# --- laptop -------------------------------------------------------------------------
def laptop_materials():
    root = bpy.data.objects["ThinkPad"]
    lid = bpy.data.objects["Lid"]
    lap = f"{ASSETS}/laptop"

    def coating(name, space, extra=None, palm=False):
        """black soft-touch coating (PSREF: 'Black'): reads charcoal grey in the
        notebookcheck photos, a velvety sheen at grazing angles, greasy where hands rest"""
        m, nt, p = principled(name, **{
            "Base Color": lin(A.get("chassis", "222326")), "Specular IOR Level": num("spec", 0.4),
            "Sheen Weight": num("sheen", 0.1), "Sheen Roughness": 0.45, "Sheen Tint": lin("3a3c40")})
        vec = coords(nt, space)
        rough = wear(nt, vec, num("rough", 0.65), 0.08, scale=16)
        # skin oil fills the soft-touch texture: prints are glossier patches
        rough = math_node(nt, "SUBTRACT", rough, math_node(nt, "MULTIPLY", prints(nt, vec, palm), num("fp", 0.2)))
        nt.links.new(rough, p.inputs["Roughness"])
        grain = noise(nt, vec, 2600, detail=4)
        n = bump(nt, grain, 0.05, 0.0002)
        if extra:
            extra(m, nt, p, rough, n)
        else:
            nt.links.new(n, p.inputs["Normal"])
        return m

    chassis = coating("chassis", root, palm=True)
    lid_mat = coating("chassis-lid", lid)

    # palm-rest wordmark: printed a light grey, a touch glossier than the coating,
    # with the red i-dot (placement from the web scene). Projected into the deck's
    # own material through a second UV map, so no decal edge can show.
    info = json.load(open(f"{lap}/wordmark.json"))
    mark_w = 50.0  # mm
    mark_h = mark_w / info["aspect"]
    centre = Vector((0.1475, -(0.1243 - 0.0312)))
    ux = Vector((math.cos(math.radians(40)), math.sin(math.radians(40))))
    uy = Vector((-ux.y, ux.x))
    base = bpy.data.objects["Base"].data
    uv = base.uv_layers.new(name="Mark")
    for loop in base.loops:
        d = base.vertices[loop.vertex_index].co.xy - centre
        uv.data[loop.index].uv = (d.dot(ux) / (mark_w * MM) + 0.5, d.dot(uy) / (mark_h * MM) + 0.5)

    def letters(m, nt, p, rough_around, n):
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = "Mark"
        tex = image(nt, f"{lap}/wordmark-rough.png", "Non-Color", "EXTEND")
        nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
        # the texture is 255 - 70 * letter with a blank border, so EXTEND keeps the
        # deck clean around the decal (CLIP would draw its outline)
        mask = map_range(nt, tex.outputs["Color"], 1.0, 0.0, 1 - 70 / 255, 1.0)
        # i-dot: a disc in decal millimetres
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(uvn.outputs["UV"], sep.inputs["Vector"])
        dx = math_node(nt, "MULTIPLY", math_node(nt, "SUBTRACT", sep.outputs["X"], info["dot"]["u"]), mark_w)
        dy = math_node(nt, "MULTIPLY", math_node(nt, "SUBTRACT", sep.outputs["Y"], 1 - info["dot"]["v"]), mark_h)
        dist = math_node(nt, "SQRT", math_node(nt, "ADD", math_node(nt, "MULTIPLY", dx, dx), math_node(nt, "MULTIPLY", dy, dy)))
        dot = map_range(nt, dist, 1.0, 0.0, 0.70, 0.78)
        col = node(nt, "ShaderNodeMix", Factor=0.0)
        col.data_type = "RGBA"
        col.inputs["A"].default_value = lin(A.get("chassis", "222326"))
        col.inputs["B"].default_value = lin("74767b")
        nt.links.new(mask, col.inputs["Factor"])
        col2 = node(nt, "ShaderNodeMix")
        col2.data_type = "RGBA"
        nt.links.new(col.outputs["Result"], col2.inputs["A"])
        col2.inputs["B"].default_value = lin("c41e24")
        nt.links.new(dot, col2.inputs["Factor"])
        nt.links.new(col2.outputs["Result"], p.inputs["Base Color"])
        r = math_node(nt, "SUBTRACT", rough_around, math_node(nt, "MULTIPLY", math_node(nt, "MAXIMUM", mask, dot), 0.2))
        nt.links.new(r, p.inputs["Roughness"])
        nt.links.new(n, p.inputs["Normal"])

    base.materials[0] = coating("chassis-base", root, letters, palm=True)

    # keycaps: satin black with grey legends from the browser's legend texture
    m, nt, p = principled("keys", **{"Specular IOR Level": 0.5})
    legend = image(nt, f"{lap}/legend.png", "Non-Color")
    col = node(nt, "ShaderNodeMix")
    col.data_type = "RGBA"
    col.inputs["A"].default_value = lin(A.get("keys", "0a0a0b"))
    col.inputs["B"].default_value = lin("a3a5aa")
    nt.links.new(legend.outputs["Color"], col.inputs["Factor"])
    nt.links.new(col.outputs["Result"], p.inputs["Base Color"])
    vec = coords(nt, root)
    nt.links.new(wear(nt, vec, num("keyrough", 0.6), 0.12, scale=14), p.inputs["Roughness"])
    nt.links.new(bump(nt, noise(nt, vec, 3200, detail=3), 0.04, 0.0002), p.inputs["Normal"])
    # backlight through the legends (textures.ts), warm white like the web scene
    glow = image(nt, f"{lap}/legend-glow.png", "Non-Color")
    tint = node(nt, "ShaderNodeVectorMath")
    tint.operation = "MULTIPLY"
    nt.links.new(glow.outputs["Color"], tint.inputs[0])
    tint.inputs[1].default_value = lin("ffe2c4")[:3]
    nt.links.new(tint.outputs["Vector"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = BACKLIT * num("backlight", 0.0)

    # glass-fibre pad in the deck colour, a little smoother than the coating
    m, nt, p = principled("touchpad", **{"Base Color": lin(A.get("pad", "222326")), "Specular IOR Level": 0.5})
    vec = coords(nt, root)
    pr = math_node(nt, "MULTIPLY", prints(nt, vec, palm=True), num("fp", 0.2))
    nt.links.new(math_node(nt, "SUBTRACT", wear(nt, vec, 0.5, 0.14, scale=20), pr), p.inputs["Roughness"])
    principled("kbfloor", **{"Base Color": lin("222326"), "Roughness": 0.8})  # lighter than the caps (his call)
    principled("port", **{"Base Color": lin("040405"), "Roughness": 0.7})
    principled("panel", **{"Base Color": lin("09090b"), "Roughness": 0.42, "Specular IOR Level": 0.5})
    principled("lens", **{"Base Color": lin("020203"), "Roughness": 0.05, "Coat Weight": 1.0})
    m, nt, p = principled("trackpoint", **{"Base Color": lin(A.get("red", "7a1015")), "Roughness": 0.9})
    nt.links.new(bump(nt, noise(nt, coords(nt), 9000, detail=2), 0.5, 0.0001), p.inputs["Normal"])
    principled("led", **{"Base Color": lin("ffffff"), "Emission Color": lin("eef2ff"), "Emission Strength": 30.0})

    # the display side is black throughout, the camera bar included (his call)
    bpy.data.objects["CommBar"].data.materials[0] = bpy.data.materials["panel"]
    # lid parts get the lid's own coating, so their pattern moves with the lid
    for o in lid.children_recursive:
        if o.type == "MESH" and o.data.materials and o.data.materials[0].name == "chassis":
            o.data.materials[0] = lid_mat


SLIDES = ("hero", "now", "term")
SCREEN_BG = "1b1815"  # the empty display between the slides (--screen-bg)


def screen(paths, strength, weights=(1.0, 0.0, 0.0)):
    """the panel shows the page: content as emission under an anti-glare (matte)
    surface that still mirrors the lamp softly. The slides are mixed by value
    nodes w_hero, w_now, w_term, w_bg (set per frame in sequences)."""
    scr = bpy.data.objects["Screen"]
    me = scr.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x - min(xs)) / (max(xs) - min(xs)), (co.y - min(ys)) / (max(ys) - min(ys)))
    m, nt, p = principled("screen", **{"Base Color": lin("030304"), "Roughness": num("scr_rough", 0.3),
                                        "Specular IOR Level": num("scr_spec", 0.25),
                                        "Emission Strength": strength})
    rgb = node(nt, "ShaderNodeRGB")
    rgb.outputs[0].default_value = lin(SCREEN_BG)
    sources = [(k, image(nt, paths[k], "sRGB", "EXTEND").outputs["Color"]) for k in SLIDES] + [("bg", rgb.outputs[0])]
    acc = None
    for key, col in sources:
        w = node(nt, "ShaderNodeValue")
        w.name = f"w_{key}"
        scale = node(nt, "ShaderNodeVectorMath")
        scale.operation = "SCALE"
        nt.links.new(col, scale.inputs[0])
        nt.links.new(w.outputs[0], scale.inputs["Scale"])
        if acc is None:
            acc = scale.outputs["Vector"]
        else:
            add = node(nt, "ShaderNodeVectorMath")
            add.operation = "ADD"
            nt.links.new(acc, add.inputs[0])
            nt.links.new(scale.outputs["Vector"], add.inputs[1])
            acc = add.outputs["Vector"]
    nt.links.new(acc, p.inputs["Emission Color"])
    set_screen(weights, strength)
    return scr


def set_screen(weights, strength):
    nt = bpy.data.materials["screen"].node_tree
    for k, w in zip(SLIDES, weights):
        nt.nodes[f"w_{k}"].outputs[0].default_value = w
    nt.nodes["w_bg"].outputs[0].default_value = max(0.0, 1.0 - sum(weights))
    nt.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = strength


# --- desk, room, light -------------------------------------------------------------------
def desk():
    """varnished oak table top, as in the web scene (3.2 x 1.2 m)"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.3, 0.27, -0.015))
    d = bpy.context.object
    d.name = "Desk"
    d.scale = (3.2, 1.2, 0.03)
    bpy.ops.object.transform_apply(scale=True)
    bev = d.modifiers.new("edge", "BEVEL")
    bev.width = 2 * MM
    bev.segments = 3
    tex = f"{ASSETS}/tex"
    m, nt, p = principled("desk", **{"Coat Weight": 1.0, "Coat IOR": 1.5, "Specular IOR Level": 0.5})
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    k = num("wood_scale", 1.8)
    mp.inputs["Scale"].default_value = (k, k, k)
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(90))
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    wood = A.get("wood_tex", "oak_veneer_01")
    col = image(nt, f"{tex}/{wood}_diff_4k.jpg")
    rough = image(nt, f"{tex}/{wood}_rough_4k.jpg", "Non-Color")
    nor = image(nt, f"{tex}/{wood}_nor_gl_4k.jpg", "Non-Color")
    for n in (col, rough, nor):
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    # stain: the scan's brightness scaled (a black laptop must stay darker than the desk)
    hsv = node(nt, "ShaderNodeHueSaturation", Value=num("wood", 0.65), Saturation=num("wood_sat", 1.0))
    nt.links.new(col.outputs["Color"], hsv.inputs["Color"])
    nt.links.new(hsv.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(map_range(nt, rough.outputs["Color"], 0.45, 0.8), p.inputs["Roughness"])
    nm = node(nt, "ShaderNodeNormalMap", Strength=0.6)
    nt.links.new(nor.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    # the varnish: glossy, with wiping marks and dust in its roughness, and the
    # open pores of the wood below it
    vec = coords(nt)
    wipe = noise(nt, vec, 6.0, detail=4, distortion=1.2)
    dust = noise(nt, vec, 420.0, detail=2)
    cr = math_node(nt, "ADD", map_range(nt, wipe, 0.05, 0.16, 0.35, 0.7), map_range(nt, dust, 0.0, 0.07, 0.55, 0.8))
    nt.links.new(cr, p.inputs["Coat Roughness"])
    nt.links.new(nm.outputs["Normal"], p.inputs["Coat Normal"])
    d.data.materials.append(m)
    return d


def world():
    w = bpy.data.worlds.new("room")
    w.use_nodes = True
    nt = w.node_tree
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(f"{ASSETS}/hdri/{A.get('hdri', 'fireplace')}_4k.hdr")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(num("hdri_rot", 120)))
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    bg = nt.nodes["Background"]
    bg.inputs["Strength"].default_value = num("env", 0.3)
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    sc.world = w


def blackbody(light, kelvin):
    light.use_nodes = True
    bb = light.node_tree.nodes.new("ShaderNodeBlackbody")
    bb.inputs["Temperature"].default_value = kelvin
    light.node_tree.links.new(bb.outputs["Color"], light.node_tree.nodes["Emission"].inputs["Color"])


def lamp():
    """desk lamp up to the left: the opening of its shade is a warm disc that
    throws a soft-edged pool onto the desk"""
    l = bpy.data.lights.new("lamp", "AREA")
    l.shape = "DISK"
    l.size = 0.12
    l.spread = math.radians(num("spread", 70))
    l.energy = num("lamp", 1.2)
    blackbody(l, 3000)
    o = bpy.data.objects.new("lamp", l)
    o.location = tuple(float(v) for v in A.get("lamp_at", "-0.3,-0.15,0.5").split(","))
    o.rotation_euler = (Vector((0.02, -0.04, 0)) - o.location).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(o)


# --- notepad and pen -------------------------------------------------------------------
PW, PD = 148 * MM, 210 * MM
STACK = 5.2 * MM
BOARD = 1.4 * MM
GLUE = 13 * MM


def box(name, w, d, h, mat, loc=(0, 0, 0), bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc) + Vector((0, 0, h / 2)), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect="EDGES")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    o = bpy.data.objects.new(name, me)
    me.materials.append(mat)
    for poly in me.polygons:
        poly.use_smooth = False
    return o


def notepad(tex):
    root = bpy.data.objects.new("Notepad", None)
    sc.collection.objects.link(root)

    # grey board at the back
    m, nt, p = principled("board", **{"Base Color": lin("7f786f"), "Roughness": 0.92})
    nt.links.new(bump(nt, noise(nt, coords(nt), 900), 0.25, 0.0002), p.inputs["Normal"])
    board = box("Board", PW + 0.6 * MM, PD + 0.6 * MM, BOARD, m, bevel=0.2 * MM)

    # the paper block: its sides show the sheets
    m, nt, p = principled("paper-edge", **{"Base Color": lin("ebe8e0"), "Roughness": 0.9})
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Z"
    wave.inputs["Scale"].default_value = 520
    wave.inputs["Distortion"].default_value = 3
    wave.inputs["Detail"].default_value = 2
    nt.links.new(coords(nt), wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = lin("cfcbc2")
    ramp.color_ramp.elements[1].color = lin("f2f0ea")
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(bump(nt, wave.outputs["Fac"], 0.6, 0.0001), p.inputs["Normal"])
    stack = box("Stack", PW, PD, STACK, m, loc=(0, 0, BOARD))

    # top sheet: the note; matte paper (a sheen layer would wash the ink out)
    m, nt, p = principled("sheet", **{"Roughness": 0.86, "Specular IOR Level": 0.35})
    col = image(nt, f"{tex}/note-color.png")
    ink = image(nt, f"{tex}/note-ink.png", "Non-Color")
    nt.links.new(col.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(map_range(nt, ink.outputs["Color"], 0.86, 0.72), p.inputs["Roughness"])
    fib = math_node(nt, "MULTIPLY", noise(nt, coords(nt), 1800, detail=8), 0.15)
    # the groove of the ballpoint is shallow: a strong step would catch the light
    # along every stroke edge and make the writing look thin and grey
    groove = math_node(nt, "MULTIPLY", ink.outputs["Color"], 0.12)
    nt.links.new(bump(nt, math_node(nt, "SUBTRACT", fib, groove), 0.2, 0.00004), p.inputs["Normal"])
    nx, ny = 48, 68
    bm = bmesh.new()
    z0 = BOARD + STACK + 0.05 * MM
    grid = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            u, v = i / nx, j / ny  # v = 0 at the near (bottom) edge
            x = (u - 0.5) * PW
            y = (v - 0.5) * PD
            cu = max(0.0, (u - 0.55) / 0.45) ** 2
            cv = max(0.0, (0.4 - v) / 0.4) ** 2
            z = z0 + 3.2 * MM * (cu * cv) ** 0.9 + 0.6 * MM * math.sin(u * 3.1) * math.sin(v * 2.3) * (1 - v)
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    uv = bm.loops.layers.uv.new()
    for j in range(ny):
        for i in range(nx):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            f.smooth = True
            for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uv].uv = (a / nx, b / ny)
    me = bpy.data.meshes.new("Sheet")
    bm.to_mesh(me)
    sheet = bpy.data.objects.new("Sheet", me)
    me.materials.append(m)
    sol = sheet.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = 0.09 * MM
    sol.offset = -1

    # glued edge: black cloth tape folded over the top of the block
    m, nt, p = principled("tape", **{"Base Color": lin("17171a"), "Roughness": 0.78, "Sheen Weight": 0.4, "Sheen Roughness": 0.4})
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.inputs["Scale"].default_value = 900
    wv.bands_direction = "DIAGONAL"
    nt.links.new(coords(nt), wv.inputs["Vector"])
    nt.links.new(bump(nt, wv.outputs["Fac"], 0.25, 0.00005), p.inputs["Normal"])
    tape = box("Tape", PW + 1.2 * MM, GLUE, BOARD + STACK + 0.6 * MM, m,
               loc=(0, PD / 2 - GLUE / 2 + 0.3 * MM, -0.05 * MM), bevel=0.5 * MM)

    for o in (board, stack, sheet, tape):
        sc.collection.objects.link(o)
        o.parent = root
    return root


def lathe(name, profile, mat, seg=48):
    """solid of revolution around the local Z axis; profile = [(r, z), ...] in mm"""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((r * MM * math.cos(2 * math.pi * k / seg), r * MM * math.sin(2 * math.pi * k / seg), z * MM))
                      for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k])).smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    o = bpy.data.objects.new(name, me)
    me.materials.append(mat)
    o.modifiers.new("ws", "WEIGHTED_NORMAL")
    return o


def pen():
    root = bpy.data.objects.new("Pen", None)
    sc.collection.objects.link(root)
    black, _, _ = principled("pen-black", **{"Base Color": lin("101013"), "Roughness": 0.38, "Specular IOR Level": 0.45})
    chrome, _, _ = principled("pen-chrome", **{"Base Color": lin("c4c6c9"), "Metallic": 1.0, "Roughness": 0.33})
    tip, _, _ = principled("pen-tip", **{"Base Color": lin("8a8c90"), "Metallic": 1.0, "Roughness": 0.3})
    # 140 mm ballpoint, z along the pen from the tip
    parts = [
        lathe("PenTip", [(0.0, 0.0), (0.35, 0.2), (0.5, 1.2), (1.4, 4.0), (2.6, 9.0), (3.3, 12.0), (3.4, 12.6)], tip),
        lathe("PenGrip", [(3.4, 12.6), (3.9, 13.0), (4.2, 16.0), (4.3, 30.0), (4.35, 31.0)], black),
        lathe("PenRing", [(4.35, 31.0), (4.6, 31.3), (4.6, 33.2), (4.4, 33.5)], chrome),
        lathe("PenBarrel", [(4.4, 33.5), (4.5, 34.0), (4.5, 118.0), (4.3, 121.0)], black),
        lathe("PenEnd", [(4.3, 121.0), (4.1, 121.0), (4.1, 130.0), (3.6, 133.5), (2.4, 135.0), (0.0, 135.3)], chrome),
    ]
    bm = bmesh.new()
    prev = None
    for r, z in [(4.6, 88.0), (5.6, 92.0), (5.9, 118.0), (5.0, 123.0), (4.1, 124.0)]:
        ring = [bm.verts.new((dx * MM, r * MM + dy * MM, z * MM)) for dx, dy in ((-1.6, 0), (1.6, 0), (1.6, 0.7), (-1.6, 0.7))]
        if prev:
            for k in range(4):
                bm.faces.new((prev[k], prev[(k + 1) % 4], ring[(k + 1) % 4], ring[k]))
        prev = ring
    me = bpy.data.meshes.new("PenClip")
    bm.to_mesh(me)
    clip = bpy.data.objects.new("PenClip", me)
    gun, _, _ = principled("pen-clip", **{"Base Color": lin("3a3b3e"), "Metallic": 1.0, "Roughness": 0.42})
    me.materials.append(gun)
    bev = clip.modifiers.new("bev", "BEVEL")
    bev.width = 0.3 * MM
    bev.segments = 3
    parts.append(clip)
    for o in parts:
        sc.collection.objects.link(o)
        o.parent = root
    return root


# --- camera ----------------------------------------------------------------------------------
FOV = 30.0  # vertical, as the web camera
LID_LIFT = 6.1 * MM  # the hinge rises as the lid comes down onto the deck (timeline.ts)


def three(v):
    """three.js (x, y, z) to Blender"""
    return Vector((v[0], -v[2], v[1]))


def web_pose(target, r, az, el, up=(0, 1, 0)):
    """camera location, target and up from a web Pose (orbit around a three.js target)"""
    c = math.cos(el)
    tx, ty, tz = target
    p = (tx + r * c * math.sin(az), ty + r * math.sin(el), tz + r * c * math.cos(az))
    return three(p), three(target), three(up)


def aim(cam, loc, target, up=(0, 0, 1), focus=None):
    """look at the target with the given up vector, as three.js lookAt does"""
    cam.location = loc
    f = (Vector(target) - Vector(loc)).normalized()
    right = f.cross(Vector(up)).normalized()
    true_up = right.cross(f)
    cam.rotation_euler = Matrix((right, true_up, -f)).transposed().to_euler()
    cam.data.dof.focus_distance = (Vector(focus or target) - Vector(loc)).length


def camera(loc, target, fstop=4.0, focus=None, up=(0, 0, 1)):
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    cam.data.sensor_fit = "VERTICAL"
    cam.data.sensor_height = 24
    cam.data.lens = 12 / math.tan(math.radians(FOV / 2))
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = fstop
    cam.data.dof.aperture_blades = 7
    cam.data.dof.aperture_rotation = math.radians(12)
    aim(cam, loc, target, up, focus)
    sc.camera = cam
    return cam


def close_laptop(push=0.11):
    lid = bpy.data.objects["Lid"]
    lid.rotation_euler.x = math.radians(90)
    lid.location.z += LID_LIFT
    bpy.data.objects["ThinkPad"].location.y += push


# --- output ------------------------------------------------------------------------------------
def compositor():
    """lens character: bloom around the bright screen and the LED, a trace of
    lateral colour fringing at the frame edges"""
    sc.render.use_compositing = True
    ng = bpy.data.node_groups.new("lens", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    glare = ng.nodes.new("CompositorNodeGlare")
    glare.inputs["Type"].default_value = "Bloom"
    glare.inputs["Quality"].default_value = "High"
    glare.inputs["Threshold"].default_value = num("bloom_at", 0.9)
    glare.inputs["Strength"].default_value = num("bloom", 0.25)
    glare.inputs["Size"].default_value = 0.6
    lens = ng.nodes.new("CompositorNodeLensdist")
    lens.inputs["Dispersion"].default_value = num("disp", 0.006)
    out = ng.nodes.new("NodeGroupOutput")
    ng.links.new(rl.outputs["Image"], glare.inputs["Image"])
    ng.links.new(glare.outputs["Image"], lens.inputs["Image"])
    ng.links.new(lens.outputs["Image"], out.inputs[0])
    sc.compositing_node_group = ng


def setup_render():
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    if A.get("device", "gpu") == "gpu":
        # Intel Arc via oneAPI (official Blender build); CPU when there is no GPU backend
        prefs = bpy.context.preferences.addons["cycles"].preferences
        try:
            prefs.compute_device_type = "ONEAPI"
            prefs.use_oneapirt = False  # needs intel-level-zero-gpu-raytracing, not installed
            prefs.get_devices()
            for d in prefs.devices:
                d.use = d.type == "ONEAPI"
            if any(d.use for d in prefs.devices):
                sc.cycles.device = "GPU"
        except TypeError:
            pass
    print("RENDER DEVICE", sc.cycles.device)
    sc.cycles.samples = int(A.get("samples", 128))
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.01
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
        sc.cycles.use_denoising = True
    except TypeError:  # Blender built without OIDN (some distro packages)
        sc.cycles.use_denoising = False
        print("WARNING no denoiser in this Blender build")
    sc.cycles.max_bounces = 12
    sc.cycles.glossy_bounces = 6
    sc.cycles.transmission_bounces = 6
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 0.5
    rx, ry = (int(v) for v in A.get("res", "1920x1200").split("x"))
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = A.get("look", "AgX - Medium High Contrast")
    sc.view_settings.exposure = num("exposure", 0.0)
    # white balance like a camera under tungsten light: warm, but white stays white
    sc.view_settings.use_white_balance = True
    sc.view_settings.white_balance_temperature = num("wb", 4300)
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "8"
    sc.render.filepath = A.get("out", "//still.png")
    if A.get("comp", "1") == "1":
        compositor()


# --- scene ---------------------------------------------------------------------------------------
laptop = bpy.data.objects["ThinkPad"]
laptop.location.z = 1.5 * MM  # rubber feet
laptop_materials()
slides = {k: f"{ASSETS}/laptop/screen-{k}.png" for k in SLIDES}
slides["hero"] = A.get("screen", slides["hero"])
screen(slides, num("glow", 2.0), tuple(float(v) for v in A.get("slides", "1,0,0").split(",")))
desk()
world()
lamp()
if "tex" in A:
    pad = notepad(A["tex"])
    pad.location = (0.34, -0.07, 0)
    pad.rotation_euler.z = -0.2
    pn = pen()
    pn.rotation_euler = (math.radians(90), 0, -0.2 + math.radians(-14))
    pn.location = (0.34 + 0.095, -0.07 + 0.01, 4.6 * MM)

# shots: web poses (stage.ts) or fixed views for checks against the reference photos
shot = A.get("shot", "laptopPose")
fstop = num("fstop", 4.0)
SCREEN_MID = (0.0, 0.125, 0.13)  # display centre (Blender), for focusing
if shot.endswith("Pose"):  # a camera pose of the web scene, exported from the dev server
    pz = json.load(open(A.get("poses", pathlib.Path(__file__).resolve().parents[1] / "src/scene/poses.json")))[shot]
    loc, tgt, up = web_pose(pz["t"], pz["r"], pz["az"], pz["el"], pz["up"])
    focus = A.get("focus")
    focus = tuple(float(v) for v in focus.split(",")) if focus else (SCREEN_MID if shot in ("coverPose", "zoomPose", "readPose") else (-0.03, 0.03, 0.04))
    camera(loc, tgt, fstop, focus=focus, up=up)
elif shot == "ref":  # like the notebookcheck photo nbc-vorn1: front left, slightly above
    camera((-0.42, -0.62, 0.52), (0.03, 0.03, 0.06), fstop, focus=(-0.02, -0.03, 0.03))
elif shot == "note":
    close_laptop()
    camera((0.29, -0.43, 0.36), (0.345, -0.085, 0.0), fstop, focus=(0.325, -0.065, 0.007))
elif shot == "macro":  # keyboard and palm rest up close
    camera((-0.02, -0.33, 0.2), (0.05, -0.04, 0.012), fstop)

def span(t, a, b):
    return min(1.0, max(0.0, (t - a) / (b - a)))


def quad(obj, corners):
    """mesh vertices nearest to the given local (x, y) corners, projected into the
    camera view: x, y as fractions of the frame from the top left"""
    out = []
    for cx, cy in corners:
        v = min(obj.data.vertices, key=lambda v: (v.co.x - cx) ** 2 + (v.co.y - cy) ** 2)
        p = world_to_camera_view(sc, sc.camera, obj.matrix_world @ v.co)
        out += [round(p.x, 5), round(1 - p.y, 5)]
    return out


def outline(obj):
    """local corners of a flat mesh in the order of a DOM box: tl, tr, br, bl (top = +y)"""
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    return [(min(xs), max(ys)), (max(xs), max(ys)), (max(xs), min(ys)), (min(xs), min(ys))]


def sequence():
    """every frame of the page's camera path (render/path.ts)"""
    path = json.load(open(A["seq"]))
    outdir = pathlib.Path(A["seqdir"])
    step = int(A.get("step", 1))
    cam = sc.camera
    lid = bpy.data.objects["Lid"]
    lid0, lz0, ly0 = lid.rotation_euler.x, lid.location.z, laptop.location.y
    scr = bpy.data.objects["Screen"]
    sheet = bpy.data.objects["Sheet"]
    scr_q, sheet_q = outline(scr), outline(sheet)
    keys = bpy.data.materials["keys"].node_tree.nodes["Principled BSDF"]
    glow = num("glow", 2.0)
    sc.render.use_persistent_data = True
    for seg in A.get("segs", ",".join(path)).split(","):
        (outdir / seg).mkdir(parents=True, exist_ok=True)
        meta_path = outdir / f"{seg}.json"
        meta = json.load(open(meta_path)) if meta_path.exists() else {}
        for i, fr in enumerate(path[seg]):
            if i % step and i != len(path[seg]) - 1:
                continue
            aim(cam, three(fr["eye"]), three(fr["target"]), three(fr["up"]), three(fr["focus"]))
            theta = lid0 + (math.radians(90) - lid0) * fr["shut"]
            lid.rotation_euler.x = theta
            s = span(math.degrees(theta), 50, 90)
            lid.location.z = lz0 + LID_LIFT * s * s * (3 - 2 * s)
            laptop.location.y = ly0 + fr["back"]
            set_screen(fr["screen"], glow * (1 - fr["dark"]))
            keys.inputs["Emission Strength"].default_value = BACKLIT * fr["backlight"]
            bpy.context.view_layer.update()
            meta[str(i)] = {"screen": quad(scr, scr_q), "note": quad(sheet, sheet_q)}
            png = outdir / seg / f"{i:03d}.png"
            if A.get("force", "0") == "1" or not png.exists():
                sc.render.filepath = str(png)
                bpy.ops.render.render(write_still=True)
                print(f"FRAME {seg} {i}", flush=True)
            json.dump(meta, open(meta_path, "w"))


setup_render()
if "seq" in A:
    sequence()
elif A.get("render", "1") == "1":
    bpy.ops.render.render(write_still=True)
