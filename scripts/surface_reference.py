import os
"""Generate and solve closed capillary-surface meshes with Surface Evolver 2.70.

The liquid-air surface has unit tension. Wetted-wall tension is -cos(theta).
Coordinates are mm; gravity is rho*g/gamma * 1e-6 after dividing energy by gamma.
The mesh is closed, so body volume and gravitational energy include the cone.
Two independently generated mesh densities provide an empirical discretization check.
This reference omits an immersed tip and contact-angle hysteresis.
"""
import argparse, json, math, pathlib, subprocess, re, shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
D=json.loads((ROOT/'src/model/dimensions.json').read_text())
WORK=ROOT/'work/surface-reference'; WORK.mkdir(parents=True,exist_ok=True)

def radius(z):
    t=D['tube'];return t['innerBaseRadius']+(t['innerRadius']-t['innerBaseRadius'])*min(z/t['coneHeight'],1)
def volume(h):
    a=.55;k=(4.3-.55)/11;z=min(h,11)
    return math.pi*(a*a*z+a*k*z*z+k*k*z**3/3+max(0,h-11)*4.3**2)
def height(v):
    lo=0;hi=32
    for _ in range(60):
        m=(lo+hi)/2
        if volume(m)<v:lo=m
        else:hi=m
    return (lo+hi)/2
def build(v,tilt,contact,n):
    c=math.cos(math.radians(tilt));s=math.sin(math.radians(tilt));h=height(v)
    vertices=[];triangles=[];surface=set();wall=set();fixed=set()
    def vertex(x,y,z,surf=False,onwall=False,fix=False):
        idx=len(vertices)+1;vertices.append((c*x+s*z,y,-s*x+c*z))
        if surf:surface.add(idx)
        if onwall:wall.add(idx)
        if fix:fixed.add(idx)
        return idx
    center=vertex(0,0,h,True)
    rings=[]
    # Horizontal in world coordinates, with a contact ring on the tube wall.
    radial=n//12
    for k in range(1,radial+1):
        ring=[]
        for j in range(n):
            a=2*math.pi*j/n
            z=(h+s*4.3*math.cos(a))/c
            if z<11:z=(h+s*.55*math.cos(a))/(c-s*(4.3-.55)/11*math.cos(a))
            r=radius(z)*k/radial
            zz=(h+s*r*math.cos(a))/c
            ring.append(vertex(r*math.cos(a),r*math.sin(a),zz,True,k==radial))
        rings.append(ring)
    for j in range(n):triangles.append((center,rings[0][j],rings[0][(j+1)%n],False))
    for k in range(radial-1):
        for j in range(n):
            a,b=rings[k][j],rings[k][(j+1)%n];u,w=rings[k+1][j],rings[k+1][(j+1)%n]
            triangles.extend([(a,u,w,False),(a,w,b,False)])
    bottom=[]
    for j in range(n):
        a=2*math.pi*j/n;bottom.append(vertex(.55*math.cos(a),.55*math.sin(a),0,onwall=True,fix=True))
    wallrings=[bottom]
    if min((c*z+s*x) for x,y,z in [vertices[i-1] for i in rings[-1]])>11:
        wallrings.append([vertex(4.3*math.cos(2*math.pi*j/n),4.3*math.sin(2*math.pi*j/n),11,onwall=True,fix=True) for j in range(n)])
    wallrings.append(rings[-1])
    for k in range(len(wallrings)-1):
        for j in range(n):
            a,b=wallrings[k][j],wallrings[k][(j+1)%n];u,w=wallrings[k+1][j],wallrings[k+1][(j+1)%n]
            triangles.extend([(a,b,w,True),(a,w,u,True)])
    base=vertex(0,0,0,fix=True)
    for j in range(n):triangles.append((base,bottom[(j+1)%n],bottom[j],True))
    # Oriented edges shared by adjacent triangles.
    edges=[];edgeids={};faces=[]
    for a,b,c0,iswall in triangles:
        ids=[]
        for p,q in [(a,b),(b,c0),(c0,a)]:
            key=(min(p,q),max(p,q))
            if key not in edgeids:edgeids[key]=len(edges)+1;edges.append(key)
            ids.append(edgeids[key]*(1 if p<q else -1))
        faces.append((ids,iswall,a in fixed and b in fixed and c0 in fixed))
    g=D['fluid']['density']*D['fluid']['gravity']/D['fluid']['surfaceTension']*1e-6
    localz=f'({c:.12g}*z+{s:.12g}*x)';localx=f'({c:.12g}*x-{s:.12g}*z)'
    rad=f'({localz}<11 ? .55+(4.3-.55)*{localz}/11 : 4.3)'
    out=[f'// TACIT v={v} uL tilt={tilt} contact={contact} n={n}',f'gravity_constant {g:.12g}','define vertex attribute surface integer','define vertex attribute anchor_x real','define vertex attribute anchor_y real','define vertex attribute az_x real','define vertex attribute az_y real',f'parameter wall_tension = {-math.cos(math.radians(contact)):.12g}','constraint 1',f'formula: {localx}^2+y^2-({rad})^2=0','constraint 2',f'formula: az_y*{localx}-az_x*y=0','constraint 3','formula: x-anchor_x=0','constraint 4','formula: y-anchor_y=0','vertices']
    for i,p in enumerate(vertices,1):
        lx=c*p[0]-s*p[2]; rr=math.hypot(lx,p[1]) or 1
        constraints=' constraints 1 2' if i in wall else ' constraints 3 4' if i in surface else ''
        out.append(f'{i} '+' '.join(f'{x:.12g}' for x in p)+(' fixed' if i in fixed else '')+constraints+f' surface {1 if i in surface else 0} anchor_x {p[0]:.12g} anchor_y {p[1]:.12g} az_x {lx/rr:.12g} az_y {p[1]/rr:.12g}')
    out.append('edges')
    for i,(a,b) in enumerate(edges,1):out.append(f'{i} {a} {b}'+(' fixed' if a in fixed and b in fixed else '')+(' constraint 1' if a in wall and b in wall else ''))
    out.append('faces')
    for i,(ids,iswall,fix) in enumerate(faces,1):out.append(f'{i} '+' '.join(map(str,ids))+(' tension wall_tension' if iswall else ' tension 1')+(' fixed' if fix else ''))
    out.extend(['bodies','1 '+' '.join(str(i) for i in range(1,len(faces)+1))+f' volume {v} density 1','read'])
    return '\n'.join(out)+'\n'

def solve(binary,v,tilt,contact,n):
    file=WORK/f'v{v}-t{tilt}-a{contact}-n{n}.fe';file.write_text(build(v,tilt,contact,n))
    commands='scale_limit := 0.2\ng 600\nhessian_seek 10\nprintf "TACIT %.12g %.12g %.12g %.12g\\n",body[1].volume,min(vertex where surface == 1,z),max(vertex where surface == 1,z),total_energy\ng 300\nhessian_seek 10\nprintf "TACIT %.12g %.12g %.12g %.12g\\n",body[1].volume,min(vertex where surface == 1,z),max(vertex where surface == 1,z),total_energy\nq\nq\n'
    proc=subprocess.run([binary,'-x',str(file)],input=commands,text=True,capture_output=True,timeout=90)
    (file.with_suffix('.log')).write_text(proc.stdout+'\n'+proc.stderr)
    lines=re.findall(r'TACIT ([\d.eE+\-]+) ([\d.eE+\-]+) ([\d.eE+\-]+) ([\d.eE+\-]+)',proc.stdout)
    if len(lines)<2:raise RuntimeError(f'Evolver did not produce metrics: {file.name}\n'+proc.stdout[-3500:]+proc.stderr[-1000:])
    a,b=[list(map(float,line)) for line in lines[-2:]]
    return {'tilt':tilt,'volume':v,'contactAngle':contact,'minZ':b[1],'maxZ':b[2],'volumeError':abs(b[0]-v),'energyDrift':abs(b[3]-a[3])/max(1,abs(b[3])),'iterationDriftMm':max(abs(b[1]-a[1]),abs(b[2]-a[2])),'mesh':n,'flatHeight':height(v)}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--binary',default=shutil.which('evolver') or shutil.which('evolver-nox'));parser.add_argument('--smoke',action='store_true');args=parser.parse_args()
    if not args.binary:raise SystemExit('Install evolver-nox on Linux to run this reference.')
    cases=[]
    combinations=[(850,0,70)] if args.smoke else [(v,t,a) for v in [100,200,400,850,950] for t in [0,5,10] for a in [40,70,100]]
    for v,t,a in combinations:
        pair=[solve(args.binary,v,t,a,n) for n in [48,96]]
        fine=pair[1];fine['meshDifferenceMm']=max(abs(pair[0]['minZ']-fine['minZ']),abs(pair[0]['maxZ']-fine['maxZ']))
        fine['converged']=0<fine['minZ']<fine['maxZ']<33 and fine['volumeError']<.01 and fine['energyDrift']<1e-4 and fine['iterationDriftMm']<.1 and fine['meshDifferenceMm']<.25
        cases.append(fine);print(json.dumps(fine),flush=True)
    result={'version':1,'status':'verified' if all(c['converged'] for c in cases) and not args.smoke else 'incomplete','source':'Surface Evolver 2.70 / closed free-surface and wetted-wall mesh','cases':cases,'maxErrorMm':max(c['meshDifferenceMm'] for c in cases),'limitations':['Equilibrium reference only; no flow or adhesion.','No immersed tip in reference meshes; tip displacement handled by the interactive kernel.','Contact angles are assumed, not measured.','Mesh and iteration convergence are numerical checks, not empirical validation.']}
    result['supportedTilts']=[t for t in [0,5,10] if not args.smoke and all(c['converged'] for c in cases if c['tilt']==t)]
    result['maxConvergedMeshErrorMm']=max((c['meshDifferenceMm'] for c in cases if c['converged']),default=None)
    result['sourceRun']=os.environ.get('GITHUB_SERVER_URL','https://github.com')+'/'+os.environ.get('GITHUB_REPOSITORY','raaaaaif/tacit')+'/actions/runs/'+os.environ.get('GITHUB_RUN_ID','local')
    (ROOT/'public/data').mkdir(parents=True,exist_ok=True)
    (ROOT/'public/data/surface-reference.json').write_text(json.dumps(result,indent=2)+'\n')
if __name__=='__main__':main()
