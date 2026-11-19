"""World points of the scene for render/poses-portrait.ts, in three.js coordinates:
the laptop's box with the lid open (Base, LidShell, CommBar), the display's corners
and the business card's box.

  blender -b -P web/model/thinkpad.py -P web/render/scene.py -P web/render/geometry.py \\
      -- --assets <render-assets folder> --render 0 --geometry <out.json>
"""
import json
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_path = args[args.index("--geometry") + 1]

bpy.context.view_layer.update()
O = bpy.data.objects
# blender (x, y, z) = three (x, -z, y)
three = lambda v: [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]
box = lambda names: [three(O[n].matrix_world @ Vector(c)) for n in names for c in O[n].bound_box]
out = {
    "laptopOpen": box(["Base", "LidShell", "CommBar"]),
    "screen": [three(O["Screen"].matrix_world @ v.co) for v in O["Screen"].data.vertices],
    "card": box(["Card"]),
}
json.dump(out, open(out_path, "w"))
print("wrote", out_path, {k: len(v) for k, v in out.items()})
