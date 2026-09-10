import type {RunTrace} from './types';
export function validateTrace(value:unknown):RunTrace {
 const t=value as RunTrace;
 if(!t||typeof t!=='object'||t.version!==1||typeof t.modelVersion!=='string'||!t.scenario||!['known','shifted','missing'].includes(t.scenario.id)||!t.policy||!['nominal','estimate','belief','oracle'].includes(t.policy.controller)||!t.initial||!t.result||!Array.isArray(t.events)||t.events.length===0||t.events.length>1000)throw Error('This file is not a supported TACIT v1 trace.');
 let visited=0;function finite(x:unknown,depth=0){if(++visited>200000||depth>15)throw Error('Trace structure exceeds the supported size.');if(typeof x==='number'&&!Number.isFinite(x))throw Error('Trace contains a non-finite number.');if(Array.isArray(x))x.forEach(v=>finite(v,depth+1));else if(x&&typeof x==='object')Object.values(x).forEach(v=>finite(v,depth+1));}finite(t);
 if(![0,5,10].includes(t.scenario.fixture?.tilt)||!Array.isArray(t.initial.pose)||t.initial.pose.length!==3||t.result.seconds<0||t.result.seconds>86400)throw Error('Unsupported trace geometry or duration.');
 let last=-1;for(const e of t.events){if(typeof e.t!=='number'||e.t<last||e.t>t.result.seconds||e.duration<0||!Array.isArray(e.tip)||e.tip.length!==3||e.tip.some(v=>typeof v!=='number'||Math.abs(v)>1000)||!['move','observe','aspirate','stop'].includes(e.action?.kind)||!Array.isArray(e.belief?.volume)||e.belief.volume.length!==2||!Array.isArray(e.belief.poseX)||!Array.isArray(e.violations)||typeof e.reason!=='string'||typeof e.volume!=='number'||e.volume<0||e.volume>2000)throw Error('Invalid event in the imported trace.');last=e.t;}
 return {...t,provenance:{...t.provenance,kind:'recorded'}};
}
