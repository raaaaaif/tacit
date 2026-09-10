import type {ScenarioSpec,ScenarioId,ControllerId,PolicySpec,WorldState} from './types';
import {defaultFixture,innerRadius} from './geometry';
import {normal,stream} from './math';
export const SCENARIOS:{id:ScenarioId;name:string;subtitle:string;description:string;number:string}[]=[
 {id:'known',number:'01',name:'Known setup',subtitle:'A familiar procedure',description:'The tube is seated, its orientation history is intact, and both cameras are available. Establish a reference run.'},
 {id:'shifted',number:'02',name:'Changed setup',subtitle:'Small changes. Real consequences.',description:'A displaced tube and weaker contrast challenge the nominal path. Use observation to adapt the action.'},
 {id:'missing',number:'03',name:'Missing context',subtitle:'When looking is not enough',description:'The pellet is effectively invisible and the centrifugation orientation record is missing. Explore what a new view can—and cannot—resolve.'}
];
export const CONTROLLERS:{id:ControllerId;label:string;short:string;description:string}[]=[
 {id:'nominal',label:'Fixed procedure',short:'Fixed',description:'A nominal trajectory, without camera feedback.'},
 {id:'estimate',label:'Point estimate',short:'Estimate',description:'Uses one best estimate from camera evidence.'},
 {id:'belief',label:'Belief-aware',short:'Belief',description:'Maintains uncertainty and chooses when to look or stop.'},
 {id:'oracle',label:'Hidden-state reference',short:'Reference',description:'Receives simulation truth. An explanatory upper reference, not an observed controller.'}
];
export function scenario(id:ScenarioId,seed=1847):ScenarioSpec{return{version:1,id,seed,volume:850,fixture:{...defaultFixture,indexed:id!=='missing',seatingSigma:id==='shifted'?.55:.15},historyKnown:id!=='missing',contrast:id==='missing'?.015:id==='shifted'?.3:.75,poseSigma:id==='shifted'?.7:.15,pumpSigma:.018,cameraBias:.12};}
export function policy(controller:ControllerId):PolicySpec{return{version:1,controller,chunk:120,margin:1.8,surfaceDepth:3.6,observeEvery:2,residualTarget:85};}
export function worldFromScenario(s:ScenarioSpec):WorldState{const r=stream(s.seed,'world');const pose:[number,number,number]=[normal(r)*s.poseSigma+(s.id==='shifted'?1.15:0),normal(r)*s.poseSigma,0];const angle=s.historyKnown?Math.PI/2+normal(r)*.18:r()*Math.PI*2;return{volume:s.volume+normal(r)*18,initialVolume:s.volume+0,pose,tilt:s.fixture.tilt,pelletAngle:angle,pelletZ:3.3+normal(r)*.15,pelletRadius:.65,contrast:s.contrast,fixture:s.fixture};}
