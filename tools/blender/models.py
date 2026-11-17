"""Set "ibrido" per Cow Abduction: low-poly hard-edge (mucche, veicoli) + UFO dark sci-fi.
Blender Z-up, fronte verso -Y (in glTF diventa +Z). Esporta GLB + render anteprima."""
import bpy, bmesh, math, sys, os
from mathutils import Vector, noise

OUT = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else '/home/claude/blender/out2'
os.makedirs(OUT, exist_ok=True)

def reset(): bpy.ops.wm.read_factory_settings(use_empty=True)
def hexc(h):
    c = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
def mat(name, color, metal=0.0, rough=0.6, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    return m
def link(o, parent=None, mats=()):
    bpy.context.collection.objects.link(o)
    for m in mats: o.data.materials.append(m)
    if parent:
        bpy.context.view_layer.update(); mw = o.matrix_world.copy(); o.parent = parent; o.matrix_world = mw
    return o
def empty(name, loc, parent=None):
    o = bpy.data.objects.new(name, None); o.location = loc; link(o)
    if parent: bpy.context.view_layer.update(); o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o
def mesh_from(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return bpy.data.objects.new(name, me)
def loft(name, rings, cap=True):
    """rings: lista di (y, [(x,z),...]) con stesso numero di punti -> solido sfaccettato."""
    verts, faces = [], []; n = len(rings[0][1])
    for y, pts in rings:
        for x, z in pts: verts.append((x, y, z))
    for r in range(len(rings) - 1):
        a, b = r * n, (r + 1) * n
        for i in range(n): faces.append((a + i, a + (i + 1) % n, b + (i + 1) % n, b + i))
    if cap:
        faces.append(tuple(range(n))[::-1]); faces.append(tuple(range((len(rings) - 1) * n, len(rings) * n)))
    return mesh_from(name, verts, faces)
def section(w, zt, zb, sag=0.0):
    """Sezione a 10 punti: dorso, spalle, fianchi, ventre (sfaccettata)."""
    h = zt - zb; mid = zb + h * 0.55
    half = [(0.0, zt - sag), (w * 0.62, zt - h * 0.1), (w, mid + h * 0.18), (w * 0.92, mid - h * 0.25), (w * 0.55, zb + h * 0.04)]
    pts = half + [(0.0, zb)] + [(-x, z) for x, z in reversed(half[1:])]
    return pts
def prism(name, p0, p1, r0, r1, sides=6):
    """Tronco di piramide tra due punti (zampe, corna, coda)."""
    p0, p1 = Vector(p0), Vector(p1); d = (p1 - p0).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(up).normalized(); v = d.cross(u).normalized()
    verts = []
    for p, r in ((p0, r0), (p1, r1)):
        for i in range(sides):
            t = i / sides * 2 * math.pi + math.pi / sides
            verts.append(tuple(p + (u * math.cos(t) + v * math.sin(t)) * r))
    faces = [(i, (i + 1) % sides, sides + (i + 1) % sides, sides + i) for i in range(sides)]
    faces += [tuple(range(sides))[::-1], tuple(range(sides, 2 * sides))]
    return mesh_from(name, verts, faces)
def ico(name, loc, scale, sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    bpy.context.collection.objects.unlink(o); return o
def box(name, loc, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); bpy.context.collection.objects.unlink(o); return o
def flat(o):
    if o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = False
def assign_by(o, matidx, pred):
    bpy.context.view_layer.update(); mw = o.matrix_world
    for p in o.data.polygons:
        if pred(mw @ p.center, p): p.material_index = matidx
def export(path, root, extra=()):
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root] + list(root.children_recursive): o.select_set(True); flat(o) if o.get('flat', True) else None
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_animations=False)

# ================================================================ MUCCA (low-poly a blocchi, dalla tavola di riferimento)
def bsec(w, zt, zb, ch=0.1):
    """Sezione squadrata con smussi (10 punti)."""
    h = zt - zb; c = min(ch, h * 0.25)
    half = [(0.0, zt), (w - c, zt), (w, zt - c), (w, zb + c), (w - c, zb)]
    return half + [(0.0, zb)] + [(-x, z) for x, z in reversed(half[1:])]
def build_cow(rootname='Cow'):
    M = dict(body=mat('Body', hexc(0xF2F0EC), rough=0.7), spot=mat('Spots', hexc(0x16161B), rough=0.6),
             pink=mat('Pink', hexc(0xF2A99A), rough=0.55), horn=mat('Horn', hexc(0xE3C9A0), rough=0.45),
             hoof=mat('Hoof', hexc(0x1E1A1A), rough=0.6), eye=mat('EyeWhite', hexc(0xFFFFFF), rough=0.25),
             pupil=mat('Eye', hexc(0x0B0B10), rough=0.1), glint=mat('Glint', (1, 1, 1), emit=(1, 1, 1), strength=2),
             bell=mat('Bell', hexc(0xFFC933), metal=1, rough=0.3))
    root = empty(rootname, (0, 0, 0))
    rings = [(-0.82, bsec(0.36, 1.42, 0.78, 0.14)), (-0.55, bsec(0.47, 1.5, 0.64, 0.12)), (0.0, bsec(0.5, 1.48, 0.6, 0.12)),
             (0.55, bsec(0.48, 1.5, 0.66, 0.12)), (0.88, bsec(0.4, 1.46, 0.8, 0.14))]
    body = link(loft('BodyMesh', rings), root, (M['body'], M['spot']))
    def spot(c, p):  # macchie grandi e decise come nella tavola
        x, y, z = c
        return (y < -0.35 and z > 1.0) or (0.05 < y < 0.6 and x > 0.2 and z > 0.9) or (0.35 < y and x < -0.2 and z > 1.05) or (-0.3 < y < 0.15 and x < -0.2 and z < 1.0) or (0.6 < y and z > 1.2 and abs(x) < 0.25)
    assign_by(body, 1, lambda c, p: spot(c, p))
    head = empty('Head', (0, -0.72, 1.3), root)
    hr = [(-0.72, bsec(0.3, 1.55, 1.0, 0.1)), (-0.9, bsec(0.36, 1.7, 0.98, 0.12)), (-1.22, bsec(0.35, 1.68, 1.02, 0.12)), (-1.3, bsec(0.3, 1.5, 1.0, 0.1))]
    skull = link(loft('Skull', hr), head, (M['body'], M['spot']))
    assign_by(skull, 1, lambda c, p: c.x > 0.05 and c.z > 1.2 and c.y > -1.28)
    link(loft('Muzzle', [(-1.24, bsec(0.3, 1.24, 0.92, 0.1)), (-1.44, bsec(0.28, 1.2, 0.94, 0.12))]), head, (M['pink'],))
    for s in (-1, 1):
        link(ico(f'Nostril{s}', (s * 0.1, -1.445, 1.08), (0.035, 0.015, 0.045), 1), head, (M['spot'],))
        link(ico(f'EyeW{s}', (s * 0.24, -1.2, 1.46), (0.12, 0.1, 0.13), 2), head, (M['eye'],))
        link(ico(f'Pupil{s}', (s * 0.27, -1.27, 1.45), (0.06, 0.05, 0.07), 2), head, (M['pupil'],))
        link(ico(f'Glint{s}', (s * 0.265, -1.31, 1.49), (0.018, 0.01, 0.018), 1), head, (M['glint'],))
        link(box(f'Ear{s}', (s * 0.48, -0.95, 1.58), (0.26, 0.08, 0.13)), head, (M['body'],)).rotation_euler = (0, s * -0.25, 0)
        link(prism(f'Horn{s}', (s * 0.22, -0.95, 1.66), (s * 0.3, -0.95, 1.88), 0.06, 0.025, 5), head, (M['horn'],))
    for name, x, y in (('LegFL', -0.3, -0.5), ('LegFR', 0.3, -0.5), ('LegBL', -0.3, 0.6), ('LegBR', 0.3, 0.6)):
        leg = empty(name, (x, y, 0.9), root)
        link(prism(name + 'Mesh', (x, y, 0.95), (x, y, 0.13), 0.13, 0.11, 4), leg, (M['body'],))
        link(prism(name + 'Hoof', (x, y, 0.15), (x, y, 0.0), 0.12, 0.125, 4), leg, (M['hoof'],))
    link(box('Udder', (0, 0.4, 0.6), (0.36, 0.34, 0.16)), root, (M['pink'],))
    for i, (x, y) in enumerate([(-0.09, 0.32), (0.09, 0.32), (-0.09, 0.48), (0.09, 0.48)]):
        link(prism(f'Teat{i}', (x, y, 0.53), (x, y, 0.44), 0.03, 0.022, 4), root, (M['pink'],))
    tail = empty('Tail', (0, 0.9, 1.4), root)
    link(prism('TailMesh', (0, 0.9, 1.4), (0, 1.02, 0.8), 0.035, 0.03, 4), tail, (M['body'],))
    link(prism('TailTuft', (0, 1.02, 0.84), (0, 1.04, 0.62), 0.08, 0.03, 4), tail, (M['spot'],))
    link(box('Bell', (0, -0.86, 0.82), (0.14, 0.14, 0.14)), root, (M['bell'],))
    laser = mat('Laser', hexc(0xFF0033), emit=hexc(0xFF0033), strength=8); steel = mat('Steel', hexc(0x7A8394), metal=1, rough=0.35)
    acy = empty('Acc_Cyborg', (0, -1.1, 1.45), head)
    link(box('Visor', (0, -1.3, 1.46), (0.74, 0.06, 0.12)), acy, (laser,))
    link(prism('Antenna', (0.15, -1.0, 1.7), (0.15, -1.0, 2.02), 0.015, 0.012, 4), acy, (steel,))
    link(ico('AntennaBulb', (0.15, -1.0, 2.05), (0.045, 0.045, 0.045), 1), acy, (laser,))
    abull = empty('Acc_Bull', (0, -1.0, 1.6), head)
    for s in (-1, 1):
        link(prism(f'BullHorn{s}', (s * 0.3, -0.95, 1.66), (s * 0.7, -1.02, 1.8), 0.09, 0.03, 5), abull, (M['horn'],))
    link(mesh_from('NoseRing', *ring_mesh((0, -1.46, 0.98), 0.07, 0.015)), abull, (M['bell'],))
    return root
def ring_mesh(c, R, r, n=10, m=4, plane='xz'):
    verts, faces = [], []
    for i in range(n):
        a = i / n * 2 * math.pi
        for j in range(m):
            b = j / m * 2 * math.pi
            q = (R + r * math.cos(b))
            if plane == 'xz': verts.append((c[0] + q * math.cos(a), c[1] + r * math.sin(b), c[2] + q * math.sin(a)))
            else: verts.append((c[0] + q * math.cos(a), c[1] + q * math.sin(a), c[2] + r * math.sin(b)))
    for i in range(n):
        for j in range(m):
            faces.append((i * m + j, ((i + 1) % n) * m + j, ((i + 1) % n) * m + (j + 1) % m, i * m + (j + 1) % m))
    return verts, faces

# ================================================================ UFO (dark sci-fi)
def lathe(name, prof, N):
    verts, faces = [], []
    for a in range(N):
        t = a / N * 2 * math.pi
        for r, z in prof: verts.append((r * math.cos(t), r * math.sin(t), z))
    P = len(prof)
    for a in range(N):
        for i in range(P - 1):
            A, B = a * P, ((a + 1) % N) * P
            faces.append((A + i, A + i + 1, B + i + 1, B + i))
    return mesh_from(name, verts, faces)
def build_ufo():
    """UFO dark sci-fi dalla tavola: disco a 12 facce a gradoni, 4 punte diagonali, anelli neon, emettitore grande."""
    hull = mat('Hull', hexc(0x3A4150), metal=0.75, rough=0.32); dark = mat('HullDark', hexc(0x161A22), metal=0.7, rough=0.45)
    dome = mat('Dome', hexc(0x232833), metal=0.7, rough=0.25); neon = mat('Neon', hexc(0x00FF88), emit=hexc(0x00FF88), strength=10)
    led = mat('LED', hexc(0x00FF88), emit=hexc(0x00FF88), strength=12); glow = mat('Emitter', hexc(0x9DFFC9), emit=hexc(0x55FFAA), strength=14)
    root = empty('UFO', (0, 0, 0)); N = 12
    prof = [(0.001, -0.3), (0.82, -0.3), (0.95, -0.42), (1.6, -0.34), (2.05, -0.12), (2.12, 0.0), (2.06, 0.07), (1.58, 0.13),
            (1.52, 0.24), (1.02, 0.3), (0.98, 0.42), (0.6, 0.5), (0.001, 0.52)]
    h = link(lathe('Hull', prof, N), root, (hull, dark, dome))
    assign_by(h, 1, lambda c, p: c.z < -0.2)
    assign_by(h, 2, lambda c, p: c.z > 0.36)
    def poly_ring(name, r, z, t, m):  # anello neon poligonale (12 lati)
        bm_ = []
        for i in range(N):
            a0, a1 = i / N * 2 * math.pi, (i + 1) / N * 2 * math.pi
            mid = (a0 + a1) / 2; L = 2 * r * math.sin(math.pi / N)
            o = link(box(f'{name}{i:02d}', (r * math.cos(mid), r * math.sin(mid), z), (t, L + t, t)), root, (m,))
            o.rotation_euler = (0, 0, mid); bm_.append(o)
        return bm_
    poly_ring('MidNeon', 1.53, 0.2, 0.05, neon)
    poly_ring('HubNeon', 0.99, 0.38, 0.045, neon)
    poly_ring('BandNeon', 1.85, -0.08, 0.05, neon)
    # 24 segmenti LED sul bordo esterno (animati dal gioco)
    for i in range(24):
        a = (i + 0.5) / 24 * 2 * math.pi; L = 2 * 2.13 * math.sin(math.pi / 24)
        l = link(box(f'LED{i:02d}', (2.13 * math.cos(a), 2.13 * math.sin(a), 0.0), (0.06, L * 0.92, 0.07)), root, (led,)); l.rotation_euler = (0, 0, a)
    # Emettitore inferiore grande e luminoso
    bpy.ops.mesh.primitive_cylinder_add(vertices=N, radius=0.8, depth=0.04, location=(0, 0, -0.3)); em = bpy.context.object; em.name = 'Emitter'
    bpy.context.collection.objects.unlink(em); link(em, root, (glow,))
    # 4 punte diagonali affilate
    for i in range(4):
        a = i / 4 * 2 * math.pi + math.pi / 4
        sp = link(mesh_from(f'Spike{i}', [(1.5, -0.14, -0.06), (1.5, 0.14, -0.06), (1.5, 0.0, 0.1), (1.5, 0.0, -0.18), (3.15, 0.0, -0.28)],
                            [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (0, 3, 1), (0, 1, 2)]), root, (dark,))
        sp.rotation_euler = (0, 0, a)
    return root

# ================================================================ VEICOLI (low-poly)
def lights(root, w, front, hy, back=None):
    hl = mat('Headlight', (1, 0.98, 0.9), emit=(1, 0.97, 0.85), strength=10); tl = mat('Taillight', hexc(0xFF1020), emit=hexc(0xFF1020), strength=8)
    for s in (-1, 1):
        link(box(f'Head{s}', (s * (w / 2 - 0.28), front, hy), (0.34, 0.05, 0.16)), root, (hl,))
        if back is not None: link(box(f'Tail{s}', (s * (w / 2 - 0.25), back, hy), (0.32, 0.05, 0.14)), root, (tl,))
def wheels(root, pos, r, wdt):
    tire = mat('Tire', hexc(0x111114), rough=0.85); rim = mat('Rim', hexc(0x9AA3B0), metal=0.8, rough=0.35)
    for i, (x, y) in enumerate(pos):
        s = 1 if x > 0 else -1
        link(prism(f'Wheel{i}', (x - s * wdt / 2, y, r), (x + s * wdt / 2, y, r), r, r, 8), root, (tire,))
        link(prism(f'Hub{i}', (x + s * wdt / 2, y, r), (x + s * (wdt / 2 + 0.01), y, r), r * 0.5, r * 0.45, 8), root, (rim,))
def build_car():
    paint = mat('Paint', hexc(0xC0392B), metal=0.5, rough=0.3); glass = mat('Glass', hexc(0x0A1018), metal=0.9, rough=0.08)
    trim = mat('Trim', hexc(0x15161A), rough=0.6)
    root = empty('Car', (0, 0, 0))
    def sec(w, zt, zb): return [(0, zt), (w * 0.9, zt), (w, zt - 0.12), (w, zb + 0.08), (w * 0.9, zb), (0, zb), (-w * 0.9, zb), (-w, zb + 0.08), (-w, zt - 0.12), (-w * 0.9, zt)]
    link(loft('Body', [(-1.92, sec(0.82, 0.78, 0.32)), (-1.5, sec(0.9, 0.9, 0.28)), (1.4, sec(0.9, 0.92, 0.28)), (1.92, sec(0.84, 0.86, 0.34))]), root, (paint,))
    cab = [(-0.75, [(0, 0.9), (0.78, 0.9), (0.7, 0.92), (0, 0.92), (-0.7, 0.92), (-0.78, 0.9)]),
           (-0.25, [(0, 1.42), (0.7, 1.4), (0.62, 1.42), (0, 1.44), (-0.62, 1.42), (-0.7, 1.4)]),
           (0.65, [(0, 1.42), (0.7, 1.4), (0.62, 1.42), (0, 1.44), (-0.62, 1.42), (-0.7, 1.4)]),
           (1.15, [(0, 0.92), (0.78, 0.9), (0.7, 0.92), (0, 0.92), (-0.7, 0.92), (-0.78, 0.9)])]
    c = link(loft('Cabin', cab), root, (glass, paint))
    assign_by(c, 1, lambda cc, p: abs(p.normal.z) > 0.85)  # tetto in tinta
    link(box('BumperF', (0, -1.93, 0.38), (1.7, 0.08, 0.14)), root, (trim,)); link(box('BumperR', (0, 1.93, 0.4), (1.7, 0.08, 0.14)), root, (trim,))
    wheels(root, [(-0.88, -1.2), (0.88, -1.2), (-0.88, 1.2), (0.88, 1.2)], 0.36, 0.28)
    lights(root, 1.8, -1.95, 0.7, 1.95)
    return root
def build_truck():
    cabp = mat('Paint', hexc(0x1E6091), metal=0.5, rough=0.3); box_m = mat('Cargo', hexc(0xDFE6E9), rough=0.55)
    glass = mat('Glass', hexc(0x0A1018), metal=0.9, rough=0.08); trim = mat('Trim', hexc(0x15161A), rough=0.6)
    amber = mat('Amber', hexc(0xFF8C00), emit=hexc(0xFF8C00), strength=6)
    root = empty('Truck', (0, 0, 0))
    def sec(w, zt, zb, ch=0.12): return [(0, zt), (w - ch, zt), (w, zt - ch), (w, zb), (0, zb), (-w, zb), (-w, zt - ch), (-w + ch, zt)]
    link(loft('Cab', [(-4.75, sec(1.12, 2.4, 0.45, 0.25)), (-4.35, sec(1.15, 2.75, 0.45, 0.2)), (-2.7, sec(1.15, 2.75, 0.45, 0.2))]), root, (cabp,))
    link(box('Windshield', (0, -4.62, 2.05), (1.9, 0.08, 0.75)), root, (glass,)).rotation_euler = (math.radians(-12), 0, 0)
    link(box('Grille', (0, -4.77, 1.0), (1.6, 0.05, 0.6)), root, (trim,))
    link(loft('Trailer', [(-2.55, sec(1.2, 4.0, 0.75, 0.08)), (4.75, sec(1.2, 4.0, 0.75, 0.08))]), root, (box_m,))
    link(box('Chassis', (0, 0.2, 0.55), (1.6, 9.2, 0.25)), root, (trim,))
    for i in range(4):
        for s in (-1, 1): link(box(f'Marker{i}{s}', (s * 1.21, -2.0 + i * 2.1, 3.85), (0.03, 0.14, 0.1)), root, (amber,))
    wheels(root, [(-1.05, -3.6), (1.05, -3.6), (-1.05, 1.9), (1.05, 1.9), (-1.05, 3.4), (1.05, 3.4)], 0.5, 0.36)
    lights(root, 2.3, -4.78, 0.9, 4.77)
    return root
def build_tractor():
    paint = mat('Paint', hexc(0x2D8A34), metal=0.3, rough=0.45); glass = mat('Glass', hexc(0x0A1018), metal=0.9, rough=0.08)
    trim = mat('Trim', hexc(0x15161A), rough=0.6); amber = mat('Amber', hexc(0xFF8C00), emit=hexc(0xFF8C00), strength=6)
    yel = mat('Yellow', hexc(0xF4C20D), rough=0.4)
    root = empty('Tractor', (0, 0, 0))
    def sec(w, zt, zb): return [(0, zt), (w - 0.1, zt), (w, zt - 0.1), (w, zb), (-w, zb), (-w, zt - 0.1), (-w + 0.1, zt)]
    link(loft('Hood', [(-1.55, sec(0.45, 1.25, 0.6)), (-1.3, sec(0.52, 1.42, 0.55)), (0.0, sec(0.58, 1.5, 0.55))]), root, (paint,))
    link(box('Exhaust', (0.3, -0.9, 1.85), (0.08, 0.08, 0.8)), root, (trim,))
    link(box('CabFloor', (0, 0.6, 1.0), (1.3, 1.2, 0.5)), root, (paint,))
    link(box('CabGlass', (0, 0.6, 2.0), (1.25, 1.1, 1.3)), root, (glass,))
    link(box('Roof', (0, 0.6, 2.7), (1.45, 1.3, 0.1)), root, (paint,))
    wheels(root, [(-0.95, 0.7), (0.95, 0.7)], 0.8, 0.45); wheels(root, [(-0.75, -1.1), (0.75, -1.1)], 0.42, 0.3)
    for o in root.children:
        if o.name.startswith('Hub'): o.data.materials[0] = yel
    link(ico('Beacon', (0, 0.6, 2.86), (0.13, 0.13, 0.13), 1), root, (amber,))
    lights(root, 1.0, -1.57, 1.05, 1.26)
    return root

# ================================================================ RENDER
def preview(path, setup, cam_loc, tgt, res=(1000, 700)):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = res; sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Punchy'
    w = bpy.data.worlds.new('W'); sc.world = w
    try:
        w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (*hexc(0x070A18), 1); bg.inputs['Strength'].default_value = 0.5
    except Exception: pass
    def light(t, loc, e, col, rot=None, size=1.0):
        d = bpy.data.lights.new(f'{t}{len(bpy.data.lights)}', t); d.energy = e; d.color = col
        if t == 'AREA': d.size = size
        o = bpy.data.objects.new(d.name, d); o.location = loc; bpy.context.collection.objects.link(o)
        if rot: o.rotation_euler = rot
    light('AREA', (5, -6, 7), 700, hexc(0xA8C0FF), (math.radians(45), 0, math.radians(35)), 5)       # luna
    light('AREA', (-5, 4, 2.5), 900, hexc(0xFF2BD6), (math.radians(-70), 0, math.radians(-130)), 3) # rim magenta
    light('POINT', (0, -0.5, 2.2), 260, hexc(0x00FF88))                                              # raggio
    light('SPOT', (6, -12, 1.2), 3000, (1, 0.95, 0.85), (math.radians(88), 0, math.radians(25)))     # fari auto
    road = mat('Road', hexc(0x16181F), rough=0.35)
    bpy.ops.mesh.primitive_plane_add(size=60); bpy.context.object.data.materials.append(road)
    lm = mat('LaneLine', (1, 1, 1), emit=(1, 1, 1), strength=1.5)
    for y in range(-20, 21, 4):
        for x in (-1.5, 1.5): bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, 0.005)); o = bpy.context.object; o.scale = (0.1, 1.6, 1); o.data.materials.append(lm)
    setup()
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); bpy.context.collection.objects.link(cam)
    cam.location = cam_loc; cam.data.lens = 35
    t = bpy.data.objects.new('T', None); t.location = tgt; bpy.context.collection.objects.link(t)
    c = cam.constraints.new('TRACK_TO'); c.target = t; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    sc.camera = cam; sc.render.filepath = path; bpy.ops.render.render(write_still=True)

def beam_cone(top_z):
    bm = mat('Beam', hexc(0x00FF88), emit=hexc(0x00FF88), strength=1.2)
    nodes = bm.node_tree.nodes; b = nodes['Principled BSDF']
    b.inputs['Alpha'].default_value = 0.18
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=1.7, radius2=0.7, depth=top_z, location=(0, 0, top_z / 2), end_fill_type='NOTHING')
    bpy.context.object.data.materials.append(bm)

if __name__ == '__main__' and '--closeup' not in sys.argv:
    for fn, name in ((build_cow, 'cow'), (build_ufo, 'ufo'), (build_car, 'car'), (build_truck, 'truck'), (build_tractor, 'tractor')):
        reset(); r = fn(); export(f'{OUT}/{name}.glb', r)
    reset()
    def setup():
        u = build_ufo(); u.location = (0, 0, 3.6); u.rotation_euler = (math.radians(10), 0, math.radians(20))
        c = build_cow(); c.location = (0, 0.1, 0.9); c.rotation_euler = (math.radians(12), math.radians(-8), math.radians(-40))
        c2 = build_cow('Cow2'); c2.location = (3.4, 2.5, 0); c2.rotation_euler = (0, 0, math.radians(-75))
        car = build_car(); car.location = (-3.0, 3.5, 0); car.rotation_euler = (0, 0, math.radians(180))
        tr = build_truck(); tr.location = (3.2, 11, 0)
        tc = build_tractor(); tc.location = (-3.2, -3.2, 0); tc.rotation_euler = (0, 0, math.radians(170))
        beam_cone(3.25)
        for o in bpy.data.objects:
            p = o
            while p:
                if p.name.startswith('Acc_'): o.hide_render = True; break
                p = p.parent
            if o.type == 'MESH': flat(o)
    preview(f'{OUT}/preview.png', setup, (6.5, -10.5, 4.2), (0, 1.5, 1.9))
    print('DONE')

def ufo_closeup():
    reset()
    def setup():
        u = build_ufo(); u.location = (0, 0, 3.2); u.rotation_euler = (math.radians(14), 0, math.radians(20))
        c = build_cow(); c.location = (0, 0.1, 0.8); c.rotation_euler = (math.radians(12), math.radians(-8), math.radians(-40))
        beam_cone(2.85)
        for o in bpy.data.objects:
            p = o
            while p:
                if p.name.startswith('Acc_'): o.hide_render = True; break
                p = p.parent
            if o.type == 'MESH': flat(o)
    preview(f'{OUT}/closeup.png', setup, (3.2, -7.5, 3.6), (0, 0, 2.2), (900, 900))

if __name__ == '__main__' and '--closeup' in sys.argv:
    ufo_closeup(); print('DONE')
