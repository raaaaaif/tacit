"""Independent adaptive quadrature and root finding; uses SciPy, not the browser LUT."""
import json,math,pathlib
from scipy.integrate import quad
from scipy.optimize import brentq
ROOT=pathlib.Path(__file__).resolve().parents[1]
def radius(z):return .55+(4.3-.55)*min(z/11,1)
def cross_section(z,h,t):
 r=radius(z)
 if t==0:return math.pi*r*r if z<h else 0
 q=(math.cos(t)*z-h)/(math.sin(t)*r)
 if q<=-1:return math.pi*r*r
 if q>=1:return 0
 return r*r*(math.acos(q)-q*math.sqrt(1-q*q))
def gross(h,t):
 cuts=[0,11,32]
 if t==0 and 0<h<32:cuts.append(h)
 cuts=sorted(cuts)
 return sum(quad(lambda z:cross_section(z,h,t),a,b,epsabs=1e-7,limit=150)[0] for a,b in zip(cuts,cuts[1:]))
def displaced(h,z):
 immersed=max(0,min(46,h-z));k=(3.1-.28)/46
 return math.pi*(.28**2*immersed+.28*k*immersed**2+k*k*immersed**3/3)
results=[]
for case in json.loads((ROOT/'work/numeric-cases.json').read_text()):
 t=math.radians(case['tilt']);target=case['volume'];tipz=case['tip'][2]
 solve=brentq(lambda h:gross(h,t)-displaced(h,tipz)-target,-1,34,xtol=1e-10)
 results.append({**case,'referenceHeight':solve,'heightErrorMm':abs(solve-case['height']),'volumeErrorUL':abs(gross(case['height'],t)-displaced(case['height'],tipz)-target)})
report={'version':1,'method':'SciPy adaptive quadrature + Brent root solve; independent from TypeScript LUT/bisection','n':len(results),'maxHeightErrorMm':max(r['heightErrorMm'] for r in results),'maxVolumeErrorUL':max(r['volumeErrorUL'] for r in results),'cases':results}
report['passed']=report['maxHeightErrorMm']<.02 and report['maxVolumeErrorUL']<.5
(ROOT/'public/data/numerical-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='cases'},indent=2))
if not report['passed']:raise SystemExit(1)
