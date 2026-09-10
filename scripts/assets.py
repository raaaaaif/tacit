"""Author TACIT's original labware and workcell meshes. Run with Blender --background --python.
All coordinates are nominal millimetres. The workbench consumes glTF units as millimetres.
Generated meshes are presentation assets. Collision geometry lives in the shared dimension model.
"""
import bpy, bmesh, math, json, pathlib
from mathutils import Vector
ROOT = pathlib.Path(__file__).resolve().parents[1]
D = json.loads((ROOT/'src/model/dimensions.json').read_text())
OUT = ROOT/'src/assets'; OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name, color, metallic=0, rough=.4, transmission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metallic;p.inputs['Roughness'].default_value=rough
    p.inputs['Transmission Weight'].default_value=transmission
    return m
poly=mat('Polypropylene · satin',(0.72,.77,.73),rough=.26,transmission=.35)
slate=mat('Ceramic graphite',(.075,.095,.084),rough=.36)
aluminum=mat('Satin anodized aluminum',(.38,.43,.40),metallic=.78,rough=.28)
black=mat('Elastomer',(.025,.033,.029),rough=.7)
amber=mat('Amber anodized index',(.68,.36,.10),metallic=.5,rough=.3)
warm=mat('Warm enamel',(.76,.78,.72),metallic=.15,rough=.36)
def bevel(obj, amount=.3, segments=3):
    mod=obj.modifiers.new('Machined edge radius','BEVEL');mod.width=amount;mod.segments=segments
    mod=obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
def cube(name,loc,scale,material,be=.3):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if be:bevel(o,be)
    return o
def cyl(name,loc,r,depth,material):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(material);bevel(o,.10,2)
    for p in o.data.polygons:p.use_smooth=True
    return o
def lathe(name,profile,material,start=0,end=2*math.pi,n=96):
    verts=[];faces=[]
    for z,r in profile:
        for j in range(n+1):
            a=start+(end-start)*j/n;verts.append((r*math.cos(a),r*math.sin(a),z))
    for i in range(len(profile)-1):
        for j in range(n):
            a=i*(n+1)+j;faces.append((a,a+1,a+n+2,a+n+1))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(material)
    for p in me.polygons:p.use_smooth=True
    return o
def export(name,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
def group_objects(before):return [o for o in bpy.context.scene.objects if o.name not in before]
# Tube, modeled as two real wall sections for a clean explanatory cutaway.
T=D['tube'];profile=[(-.65,.0),(-.65,.65),(0,1.20),(11,5.05),(31.3,5.05),(31.7,5.45),(32.0,5.7),(33.1,5.7),(33.1,4.3),(11,4.3),(0,.55),(0,0)]
before=set(o.name for o in bpy.context.scene.objects)
lathe('tube_back',profile,poly,0,math.pi,64);lathe('tube_front',profile,poly,math.pi,2*math.pi,64)
hinge=cube('Cap hinge',(0,6.1,32.55),(3.7,4.2,.65),poly,.25)
cyl('Open cap',(0,11.6,32.55),5.7,1.15,poly)
lathe('Cap sealing rim',[(31.98,4.3),(31.45,4.3),(31.45,4.7),(31.98,4.7)],poly).location.y=11.6
for z in [14,18,22,26,30]:
    o=cube('Molded graduation',(0,-5.045,z),(2.3,.075,.12),warm,.03)
export('tube',group_objects(before))
# Fine tapered disposable tip and collet.
before=set(o.name for o in bpy.context.scene.objects)
tip=D['tip'];lathe('tip',[(0,.28),(46,3.1),(46.3,3.7),(65,3.7),(65,3.45),(46.3,3.45),(46,2.87),(.35,.12),(0,.12),(0,.28)],poly)
cyl('Pipette collet',(0,0,67.6),4.1,5.2,aluminum)
cyl('Pipette head',(0,0,75),5.3,10,warm)
lathe('Collet accent',[(70,5.35),(70.4,5.35)],amber)
export('tip',group_objects(before))
# The exact same watertight solid as the STL/3MF exports. Small bevels are visual only.
for source in sorted((ROOT/'work/fixture-meshes').glob('holder-*.json')):
    data=json.loads(source.read_text());stride=data['stride'];v=data['vertices'];tri=data['triangles']
    mesh=bpy.data.meshes.new(source.stem)
    mesh.from_pydata([v[i:i+3] for i in range(0,len(v),stride)],[],[tri[i:i+3] for i in range(0,len(tri),3)])
    mesh.update();obj=bpy.data.objects.new(source.stem,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(slate)
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
    bmesh.ops.dissolve_limit(bm,angle_limit=.005,verts=list(bm.verts),edges=list(bm.edges),use_dissolve_boundaries=False)
    bm.to_mesh(mesh);bm.free();mesh.update()
    bevel(obj,.45,4)
    obj.modifiers['Machined edge radius'].use_clamp_overlap=True
    details=[obj]
    for side in [-1,1]:
        for y in [-9,9]:details.append(cyl('Mount fastener',(side*13,y,-.95),1.05,.25,aluminum))
    details.append(cube('Index tab',(0,-13,-.85),(6,1.4,.4),amber,.18))
    export(source.stem,details)
# Restrained instrument platform and an actual linear stage.
before=set(o.name for o in bpy.context.scene.objects)
cube('Instrument plinth',(0,1,-6.0),(72,66,5.5),warm,2)
cube('Isolation layer',(0,1,-9.0),(69,63,1.2),black,.6)
for x in [-26,26]:
    for y in [-23,25]:cyl('Isolation foot',(x,y,-10),4.0,2,black)
cube('Stage spine',(22,24,74),(11,10,160),aluminum,1.3)
cube('Stage guide dark inset',(22,18.7,76),(5,.8,144),black,.25)
for x in [19,25]:cyl('Linear rail',(x,18.0,76),.75,146,aluminum)
for z in [6,147]:
    o=cyl('Rail fastener',(22,18.1,z),1.2,.35,black);o.rotation_euler[0]=math.pi/2
cube('Calibration tile',(-23,-18,-3.1),(10,10,.18),slate,.3)
for i in range(3):
    for j in range(3):
        if(i+j)%2==0:cube('Calibration fiducial',(-26+i*3,-21+j*3,-2.99),(2.5,2.5,.03),warm,0)
export('workcell',group_objects(before))
# Authoring scene retained as a reproducible source script; no bulky .blend required.
print('TACIT assets exported:', ', '.join(p.name for p in OUT.glob('*.glb')))
