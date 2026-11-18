"""Photoreal Cycles render of the desk scene: the ThinkPad from model/thinkpad.py
on a varnished wooden desk in the evening, lit by a warm desk lamp and its own
screen; in the last scene a business card lies to the right of it.

Runs after the model script in the same Blender session:
  blender -b -P web/model/thinkpad.py -P web/render/scene.py -- \\
      --assets <render-assets folder> [--card <folder with card-color.png>] \\
      --out shot.png [--shot laptopPose] [--samples 128] [--res 1920x1200]

The assets folder holds CC0 downloads and exports from the dev server:
  hdri/fireplace_4k.hdr, tex/kitchen_wood_{diff,rough,nor_gl}_8k.jpg (Poly Haven),
  tex/Fingerprints006/, tex/Fingerprints009/ (ambientCG 4K-JPG),
  laptop/legend.png, laptop/legend-glow.png (textures.ts, drawn in the browser),
  laptop/thinkpad-logo.ttf, laptop/logo-lenovo.png (render/logo_texture.py),
  laptop/screen-{hero,now,prompt,term}.png (the display content at 2880x1800: hero,
  CAD drawing, empty prompt, CV in micro; they light the keyboard, the page lays
  its DOM over the panel),
  The camera poses come from src/scene/poses.json (window.__poses of /?gl).

Shots: --shot laptopPose|nowPose|coverPose|zoomPose|readPose|shutPose|cardPose
(web cameras), ref (studio check against the notebookcheck photos), macro, lid.
Finish with render/post.py (vignetting, grain).

Sequences for the page: --seq path.json (render/path.ts) --seqdir <folder>
[--segs pull,now] [--step 1] [--force 0] renders every frame of the camera path
to <seqdir>/<seg>/NNN.png and writes the display and card corners of each frame
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

    # the marks (render/logo_texture.py): the ThinkPad wordmark is cut into the
    # palm rest and the lid; its i-dot and the Lenovo badge on the lid are drawn
    # into the part's own material, so no decal edge can show
    font = bpy.data.fonts.load(f"{lap}/thinkpad-logo.ttf", check_existing=True)

    def glyphs(body):
        """the text set flat in the wordmark's typeface, as a mesh (font units)"""
        cu = bpy.data.curves.new("wordmark", "FONT")
        cu.body = body
        cu.font = font
        cu.resolution_u = 24
        tmp = bpy.data.objects.new("wordmark", cu)
        sc.collection.objects.link(tmp)
        me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(tmp)
        bpy.data.curves.remove(cu)
        return me

    def frame(right, up, angle):
        """axes of the lettering at angle (degrees) in a plane seen with right and up"""
        a = math.radians(angle)
        return right * math.cos(a) + up * math.sin(a), -right * math.sin(a) + up * math.cos(a)

    def deboss(ob, centre, right, up, angle, text_mm, depth=0.25 * MM):
        """cut the wordmark (dotless i) depth deep into the flat face of ob at
        centre (local), the lettering text_mm long. Floor and walls keep the
        part's own matte coating (his correction: the letters show only by the
        shadows at their edges), the walls meet the surface at sharp edges.
        Returns where the i-dot goes (local centre, radius), for the material to
        draw it."""
        me = glyphs("Th\u0131nkPad")
        xs = [v.co.x for v in me.vertices]
        ys = [v.co.y for v in me.vertices]
        k = text_mm * MM / (max(xs) - min(xs))
        mid = Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2))
        normal = right.cross(up)
        hit, at, _, _ = ob.ray_cast(centre + normal * 0.1, -normal)  # from well above the part
        assert hit, f"no face of {ob.name} under the wordmark"
        dx, dy = frame(right, up, angle)
        place = lambda x, y: at + dx * ((x - mid.x) * k) + dy * ((y - mid.y) * k)
        # the i-dot: the one piece of a dotted "Thi" that lies wholly above the baseline
        bm = bmesh.new()
        dotted = glyphs("Thi")
        bm.from_mesh(dotted)
        bpy.data.meshes.remove(dotted)
        pieces, seen = [], set()
        for f in bm.faces:
            if f in seen:
                continue
            piece, todo = [], [f]
            while todo:
                g = todo.pop()
                if g in seen:
                    continue
                seen.add(g)
                piece.append(g)
                todo += [h for e in g.edges for h in e.link_faces if h not in seen]
            pieces.append(piece)
        dot = [q for q in pieces if min(v.co.y for g in q for v in g.verts) > 0.3]
        assert len(dot) == 1, f"{len(dot)} pieces above the baseline in Thi"
        dot = dot[0]
        area = sum(f.calc_area() for f in dot)
        c = sum((f.calc_center_median() * f.calc_area() for f in dot), Vector()) / area
        dot_at, dot_r = place(c.x, c.y), (area / math.pi) ** 0.5 * k
        bm.free()
        bm = bmesh.new()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        height = depth + 2 * MM
        top = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])["geom"]
        bmesh.ops.translate(bm, verts=[g for g in top if isinstance(g, bmesh.types.BMVert)], vec=(0, 0, 1))
        for v in bm.verts:
            v.co = place(v.co.x, v.co.y) + normal * (v.co.z * height - depth)
        # every letter a solid facing out: recalc_face_normals turns the n inside
        # out, which the boolean then leaves uncut or cuts upside down
        seen = set()
        for f in bm.faces:
            if f in seen:
                continue
            letter, todo = [], [f]
            while todo:
                g = todo.pop()
                if g in seen:
                    continue
                seen.add(g)
                letter.append(g)
                todo += [h for e in g.edges for h in e.link_faces if h not in seen]
            o = letter[0].verts[0].co
            volume = 0.0  # x6, signed: positive when the faces point out
            for g in letter:
                c = [v.co - o for v in g.verts]
                volume += sum(c[0].dot(c[i].cross(c[i + 1])) for i in range(1, len(c) - 1))
            if volume < 0:
                bmesh.ops.reverse_faces(bm, faces=letter)
        cutter_me = bpy.data.meshes.new("wordmark-cut")
        bm.to_mesh(cutter_me)
        bm.free()
        cutter = bpy.data.objects.new("wordmark-cut", cutter_me)
        sc.collection.objects.link(cutter)
        cutter.matrix_world = ob.matrix_world
        mod = ob.modifiers.new("wordmark", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = cutter
        with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter)
        # the cut faces (floor and walls: below the surface, within the mark) are
        # flat, in the part's material, and meet the surface at a sharp edge
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        for f in bm.faces:
            c = f.calc_center_median()
            below = (c - at).dot(normal)
            if -depth - 1e-6 < below < -1e-6 and (c - at).length < text_mm * MM * 0.6:
                f.material_index = 0
                f.smooth = False
                for e in f.edges:
                    e.smooth = False
        bm.to_mesh(ob.data)
        bm.free()
        return dot_at, dot_r

    def project(me, name, plane, centre, angle, size):
        """UV map that lays a decal of size (m) on the mesh: plane maps a local
        vertex to 2D as the mark is seen (x right, y up), the decal's x runs at
        angle (degrees) to that x"""
        ux = Vector((math.cos(math.radians(angle)), math.sin(math.radians(angle))))
        uy = Vector((-ux.y, ux.x))
        uv = me.uv_layers.new(name=name)
        for loop in me.loops:
            d = plane(me.vertices[loop.vertex_index].co) - Vector(centre)
            uv.data[loop.index].uv = (d.dot(ux) / size[0] + 0.5, d.dot(uy) / size[1] + 0.5)

    def uv_map(nt, name):
        n = nt.nodes.new("ShaderNodeUVMap")
        n.uv_map = name
        return n.outputs["UV"]

    def i_dot(nt, at_r):
        """the wordmark's i-dot (0..1) on the part's surface; the red dot is a
        little larger than a plain i-dot"""
        at, r = at_r
        r *= 1.1
        d = node(nt, "ShaderNodeVectorMath")
        d.operation = "DISTANCE"
        nt.links.new(nt.nodes.new("ShaderNodeTexCoord").outputs["Object"], d.inputs[0])
        d.inputs[1].default_value = at
        return map_range(nt, d.outputs["Value"], 1.0, 0.0, r - 0.03 * MM, r + 0.03 * MM)

    def mix(nt, fac, a, b):
        n = node(nt, "ShaderNodeMix")
        n.data_type = "RGBA"
        for sock, v in (("A", a), ("B", b)):
            if isinstance(v, tuple):
                n.inputs[sock].default_value = v
            else:
                nt.links.new(v, n.inputs[sock])
        nt.links.new(fac, n.inputs["Factor"])
        return n.outputs["Result"]

    chassis_col = lin(A.get("chassis", "222326"))

    # palm rest: the wordmark is cut into the coating, black like it, with the
    # red i-dot (placement from the web scene)
    base_ob = bpy.data.objects["Base"]
    palm_dot = deboss(base_ob, Vector((0.1475, -(0.1243 - 0.0312), 0.0)), Vector((1, 0, 0)), Vector((0, 1, 0)), 40, 23.0)
    base = base_ob.data

    def red_dot(m, nt, p, rough_around, n):
        dot = i_dot(nt, palm_dot)
        nt.links.new(mix(nt, dot, chassis_col, lin("c41e24")), p.inputs["Base Color"])
        nt.links.new(n, p.inputs["Normal"])

    base.materials[0] = coating("chassis-base", root, red_dot, palm=True)

    # lid, measured on Lenovo's top view: seen from behind the open lid, the
    # wordmark sits up left (centre 38 mm from the side, 31 mm below the top edge,
    # rising at 35 degrees) with the i-dot as a red LED; the aluminium badge
    # (37 x 12.5 mm) sits low right, 7.8 mm from the side, reading upwards
    shell_ob = bpy.data.objects["LidShell"]
    shell = shell_ob.data
    side = max(v.co.x for v in shell.vertices)
    top = max(v.co.z for v in shell.vertices)
    behind = lambda co: Vector((-co.x, co.z))
    mark = Vector((-side + 38 * MM, top - 31 * MM))
    # seen from behind, right is -x and up is +z; the outside faces +y
    lid_dot = deboss(shell_ob, Vector((-mark.x, 0.0, mark.y)), Vector((-1, 0, 0)), Vector((0, 0, 1)), 35, 40.0)
    project(shell, "Badge", behind, (side - 7.8 * MM, 27.9 * MM), 90, (37 * MM, 12.5 * MM))

    def lid_marks(m, nt, p, rough_around, n):
        # only on the outside of the lid (its normal is +y in lid space)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Normal"], sep.inputs["Vector"])
        outside = map_range(nt, sep.outputs["Y"], 0.0, 1.0, 0.5, 0.7)
        dot = math_node(nt, "MULTIPLY", i_dot(nt, lid_dot), outside)
        tex = image(nt, f"{lap}/logo-lenovo.png", "Non-Color", "CLIP")
        nt.links.new(uv_map(nt, "Badge"), tex.inputs["Vector"])
        rgb = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(tex.outputs["Color"], rgb.inputs["Color"])
        plate = math_node(nt, "MULTIPLY", rgb.outputs["Red"], outside)
        text = math_node(nt, "MULTIPLY", rgb.outputs["Green"], plate)
        col = mix(nt, plate, chassis_col, lin("c6c7c9"))
        col = mix(nt, text, col, lin("2e2f31"))
        nt.links.new(mix(nt, dot, col, lin("ff2a22")), p.inputs["Base Color"])
        nt.links.new(math_node(nt, "MULTIPLY", plate, math_node(nt, "SUBTRACT", 1.0, text)), p.inputs["Metallic"])
        r = mix(nt, plate, rough_around, (0.32, 0.32, 0.32, 1.0))
        nt.links.new(mix(nt, text, r, (0.5, 0.5, 0.5, 1.0)), p.inputs["Roughness"])
        nt.links.new(mix(nt, dot, (0, 0, 0, 1.0), lin("ff1a10")), p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = num("led", 30.0)
        nt.links.new(bump(nt, plate, 0.3, 0.0001, n), p.inputs["Normal"])

    shell_mat = coating("chassis-lid-shell", lid, lid_marks)

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
    bpy.data.objects["LidShell"].data.materials[0] = shell_mat


SLIDES = ("hero", "now", "prompt", "term")
SCREEN_BG = "1b1815"  # the empty display between the slides (--screen-bg)


def screen(paths, strength, weights=(1.0, 0.0, 0.0, 0.0)):
    """the panel shows the page: content as emission under an anti-glare (matte)
    surface that still mirrors the lamp softly. The slides are mixed by value
    nodes w_hero, w_now, w_prompt, w_term, w_bg (set per frame in sequences)."""
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
    wood = A.get("wood_tex", "kitchen_wood")  # his pick 18.11.: rough, open-grained oak
    res = A.get("wood_res", "8k")  # 8k: the scan stays sharper than the pixels in the view of the card
    col = image(nt, f"{tex}/{wood}_diff_{res}.jpg")
    rough = image(nt, f"{tex}/{wood}_rough_{res}.jpg", "Non-Color")
    nor = image(nt, f"{tex}/{wood}_nor_gl_{res}.jpg", "Non-Color")
    for n in (col, rough, nor):
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    # stain: the scan's brightness scaled (a black laptop must stay darker than the desk)
    hsv = node(nt, "ShaderNodeHueSaturation", Value=num("wood", 0.65), Saturation=num("wood_sat", 1.0))
    nt.links.new(col.outputs["Color"], hsv.inputs["Color"])
    vec = coords(nt)
    # the stain never takes quite evenly: broad, faint patches
    blotch = map_range(nt, noise(nt, vec, 3.0, detail=3), 0.92, 1.06, 0.35, 0.65)
    stained = node(nt, "ShaderNodeVectorMath")
    stained.operation = "SCALE"
    nt.links.new(hsv.outputs["Color"], stained.inputs[0])
    nt.links.new(blotch, stained.inputs["Scale"])
    # dust on the varnish: sparse specks a few tenths of a millimetre across
    vor = node(nt, "ShaderNodeTexVoronoi", Scale=num("dust_scale", 260.0))
    nt.links.new(vec, vor.inputs["Vector"])
    rgb = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(vor.outputs["Color"], rgb.inputs["Color"])
    speck = math_node(nt, "MULTIPLY", map_range(nt, vor.outputs["Distance"], 1.0, 0.0, 0.035, 0.07),
                      map_range(nt, rgb.outputs["Red"], 0.0, 1.0, 0.82, 0.84))
    dusty = node(nt, "ShaderNodeMix")
    dusty.data_type = "RGBA"
    nt.links.new(speck, dusty.inputs["Factor"])
    nt.links.new(stained.outputs["Vector"], dusty.inputs["A"])
    dusty.inputs["B"].default_value = lin("b8b2a8")
    nt.links.new(dusty.outputs["Result"], p.inputs["Base Color"])
    nt.links.new(map_range(nt, rough.outputs["Color"], 0.45, 0.8), p.inputs["Roughness"])
    nm = node(nt, "ShaderNodeNormalMap", Strength=num("wood_nor", 0.8))
    nt.links.new(nor.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    # the varnish: glossy, with wiping marks and dust in its roughness, fine
    # scratches from years of use, and the open pores of the wood below it
    wipe = noise(nt, vec, 6.0, detail=4, distortion=1.2)
    dust = noise(nt, vec, 420.0, detail=2)
    cr = math_node(nt, "ADD", map_range(nt, wipe, 0.05, 0.16, 0.35, 0.7), map_range(nt, dust, 0.0, 0.07, 0.55, 0.8))
    scratches = None
    for k, (angle, at) in enumerate(((12, 0.0), (71, 3.1), (136, 7.7), (-28, 11.3))):
        mp_ = node(nt, "ShaderNodeMapping")
        mp_.inputs["Location"].default_value = (at, at * 0.7, 0)
        mp_.inputs["Rotation"].default_value = (0, 0, math.radians(angle))
        mp_.inputs["Scale"].default_value = (1.5, 260.0, 1)
        nt.links.new(vec, mp_.inputs["Vector"])
        line = map_range(nt, noise(nt, mp_.outputs["Vector"], 22.0, detail=1, rough=0.4), 0.0, 1.0, 0.585, 0.6)
        scratches = line if scratches is None else math_node(nt, "MAXIMUM", scratches, line)
    # scratches gather where hands and things move: patches of them
    worn = map_range(nt, noise(nt, vec, 2.2, detail=2), 0.0, 1.0, 0.45, 0.62)
    scratches = math_node(nt, "MULTIPLY", scratches, worn)
    cr = math_node(nt, "ADD", cr, math_node(nt, "MULTIPLY", scratches, 0.25))
    cr = math_node(nt, "ADD", cr, math_node(nt, "MULTIPLY", speck, 0.6))
    nt.links.new(cr, p.inputs["Coat Roughness"])
    nt.links.new(bump(nt, math_node(nt, "MAXIMUM", scratches, speck), 0.25, 0.00002, nm.outputs["Normal"]), p.inputs["Coat Normal"])
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


# --- business card ------------------------------------------------------------------------
CARD_W, CARD_H, CARD_T = 85 * MM, 55 * MM, 0.38 * MM
CARD_AT = (0.27, -0.08)  # on the desk to the right of the laptop
CARD_TURN = -0.25


def card(tex):
    """the business card of the last scene (render/card_texture.py): heavy uncoated
    card, a touch bowed as cards lie on a desk"""
    m, nt, p = principled("card", **{"Roughness": 0.72, "Specular IOR Level": 0.35})
    col = image(nt, f"{tex}/card-color.png", "sRGB", "EXTEND")
    nt.links.new(col.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(bump(nt, noise(nt, coords(nt), 2400, detail=8), 0.15, 0.00003), p.inputs["Normal"])
    nx, ny = 34, 22
    bm = bmesh.new()
    grid = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            # bowed along its length, the back right corner lifted a little: a card
            # never lies quite flat, and the gaps under it give the soft contact shadow
            z = CARD_T + num("card_bow", 0.6) * MM * (1 - (2 * u - 1) ** 2) + num("card_lift", 0.6) * MM * (u * v) ** 2
            row.append(bm.verts.new(((u - 0.5) * CARD_W, (v - 0.5) * CARD_H, z)))
        grid.append(row)
    uv = bm.loops.layers.uv.new()
    for j in range(ny):
        for i in range(nx):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            f.smooth = False  # flat: a sharp paper edge (smooth shading rounded the rim like a plastic tile)
            for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uv].uv = (a / nx, b / ny)
    me = bpy.data.meshes.new("Card")
    bm.to_mesh(me)
    o = bpy.data.objects.new("Card", me)
    me.materials.append(m)
    sol = o.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = CARD_T
    sol.offset = -1
    sc.collection.objects.link(o)
    at = [float(v) for v in A["card_at"].split(",")] if "card_at" in A else CARD_AT
    o.location = (at[0], at[1], 0)
    o.rotation_euler.z = CARD_TURN
    return o


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


def close_laptop():
    lid = bpy.data.objects["Lid"]
    lid.rotation_euler.x = math.radians(90)
    lid.location.z += LID_LIFT


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
screen(slides, num("glow", 2.0), tuple(float(v) for v in A.get("slides", "1,0,0,0").split(",")))
desk()
world()
lamp()
card(A.get("card", f"{ASSETS}/card"))

# shots: web poses (stage.ts) or fixed views for checks against the reference photos
shot = A.get("shot", "laptopPose")
fstop = num("fstop", 4.0)
if shot.endswith("Pose"):  # a camera pose of the web scene, exported from the dev server
    pz = json.load(open(A.get("poses", pathlib.Path(__file__).resolve().parents[1] / "src/scene/poses.json")))[shot]
    loc, tgt, up = web_pose(pz["t"], pz["r"], pz["az"], pz["el"], pz["up"])
    focus = A.get("focus")
    focus = tuple(float(v) for v in focus.split(",")) if focus else three(pz["f"])
    if shot == "cardPose":
        close_laptop()
    camera(loc, tgt, fstop, focus=focus, up=up)
elif shot == "ref":  # like the notebookcheck photo nbc-vorn1: front left, slightly above
    camera((-0.42, -0.62, 0.52), (0.03, 0.03, 0.06), fstop, focus=(-0.02, -0.03, 0.03))
elif shot == "lid":  # the closed lid from above, front at the bottom, like nbc-deckel
    close_laptop()
    camera((0.0, -0.12, 0.62), (0.0, -0.01, 0.0), 11.0, up=(0, 1, 0))
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
    lid0, lz0 = lid.rotation_euler.x, lid.location.z
    scr = bpy.data.objects["Screen"]
    crd = bpy.data.objects["Card"]
    scr_q, card_q = outline(scr), outline(crd)
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
            # the card is on the desk only in the last sequence
            crd.hide_render = seg != "close"
            set_screen(fr["screen"], glow * (1 - fr["dark"]))
            keys.inputs["Emission Strength"].default_value = BACKLIT * fr["backlight"]
            bpy.context.view_layer.update()
            meta[str(i)] = {"screen": quad(scr, scr_q), "card": quad(crd, card_q)}
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
