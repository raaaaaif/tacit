"""Small independent Cycles render set. Geometry is nominal; no real-camera validation is implied."""
import bpy,math,json,pathlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/reference';OUT.mkdir(parents=True,exist_ok=True)
D=json.loads((ROOT/'src/model/dimensions.json').read_text())
def radius(z):return .55+(4.3-.55)*min(1,z/11)
def volume(h,tilt):
    c=math.cos(tilt);s=math.sin(tilt);total=0;n=2048;dz=32/n
    for i in range(n):
        z=(i+.5)*dz;r=radius(z)
        if not tilt:f=1 if z<h else 0
        else:
            q=(c*z-h)/(s*r);f=1 if q<=-1 else 0 if q>=1 else (math.acos(q)-q*math.sqrt(1-q*q))/math.pi
        total+=math.pi*r*r*f*dz
    return total
def level(v,tilt):
    lo=0;hi=32
    for _ in range(35):
        h=(lo+hi)/2
        if volume(h,tilt)<v:lo=h
        else:hi=h
    return (lo+hi)/2

def material(name,color,transmission=0,ior=1.45):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.1;p.inputs['Transmission Weight'].default_value=transmission;p.inputs['IOR'].default_value=ior
    return m
cases=[('high-side',850,0,'side',.75),('low-side',350,0,'side',.75),('tilted-side',400,5,'side',.75),('visible-overhead',850,0,'overhead',.75),('missing-overhead',850,0,'overhead',.015)]
manifest=[]
for name,v,tilt,view,contrast in cases:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'src/assets/tube.glb'))
    angle=math.radians(tilt);rot=Vector((0,angle,0));h=level(v,angle)
    poly=material('Reference polypropylene',(.92,.94,.91),.95,1.49)
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH':o.data.materials.clear();o.data.materials.append(poly)
        # Rotate the entire authored object around the common tube origin.
    root=bpy.data.objects.new('Tube frame',None);bpy.context.collection.objects.link(root)
    for o in list(bpy.context.scene.objects):
        if o!=root and o.parent is None:o.parent=root
    root.rotation_euler[1]=angle
    positions=[];faces=[];n=96;m=24;c=math.cos(angle);s=math.sin(angle)
    for j in range(m+1):
        for i in range(n):
            a=2*math.pi*i/n;z=(h+s*4.3*math.cos(a))/c
            if z<11:z=(h+s*.55*math.cos(a))/(c-s*(4.3-.55)/11*math.cos(a))
            z*=j/m;r=radius(z);positions.append((r*math.cos(a),r*math.sin(a),z))
    for j in range(m):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    faces.append(tuple(reversed(range(n))));faces.append(tuple(m*n+i for i in range(n)))
    mesh=bpy.data.meshes.new('Liquid');mesh.from_pydata(positions,[],faces);mesh.update();liquid=bpy.data.objects.new('Liquid',mesh);bpy.context.collection.objects.link(liquid);liquid.rotation_euler[1]=angle
    fluid=material('Reference liquid',(.90,.95,.92),1,1.36);liquid.data.materials.append(fluid)
    # Absorption produces a path-length cue without semantic color labels.
    nodes=fluid.node_tree.nodes;absorb=nodes.new('ShaderNodeVolumeAbsorption');absorb.inputs['Color'].default_value=(.75,.80,.75,1);absorb.inputs['Density'].default_value=.03;fluid.node_tree.links.new(absorb.outputs['Volume'],nodes.get('Material Output').inputs['Volume'])
    r=radius(3.3)-.325;pellet=(s*3.3,r,c*3.3)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=.65,location=pellet);o=bpy.context.object;o.name='Pellet';o.data.materials.append(material('Pellet contrast',(1-contrast*.6,)*3))
    bpy.ops.object.camera_add(location=(0,-18,14) if view=='side' else (0,0,40));camera=bpy.context.object;target=Vector((0,0,14) if view=='side' else (0,0,0));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=144*(.21 if view=='side' else .16);camera.data.clip_start=.01;camera.data.clip_end=200
    scene=bpy.context.scene;scene.camera=camera
    scene.world.color=(.8,.8,.8);scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.78,.78,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=1
    for loc,power,size in [((-15,-12,30),1500,25),((12,8,35),2000,22)]:
        bpy.ops.object.light_add(type='AREA',location=loc);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size;lamp.rotation_euler=(Vector((0,0,15))-lamp.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.cycles.max_bounces=16;scene.cycles.transmission_bounces=12;scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=112;scene.render.resolution_y=144;scene.render.resolution_percentage=100;scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    manifest.append({'id':name,'volume':v,'tilt':tilt,'view':view,'contrast':contrast,'referenceHeight':h,'file':name+'.png','width':112,'height':144})
(OUT/'manifest.json').write_text(json.dumps({'version':1,'renderer':'Blender '+bpy.app.version_string+' / Cycles CPU / 32 samples','cases':manifest,'scope':'Independent synthetic renderer consistency check. Not real-camera accuracy. Optical properties and lighting are assumed.'},indent=2))
