import fs from 'node:fs';
import {extractFeatures,calibration} from '../src/model/optics';
const manifest=JSON.parse(fs.readFileSync('public/reference/manifest.json','utf8'));
const cases=manifest.cases.map((c:any)=>{const rgba=new Uint8ClampedArray(fs.readFileSync(`work/${c.id}.rgba`));const features=extractFeatures({version:1,id:c.id,t:0,calibration:calibration(c.view),pixels:rgba,valid:new Uint8Array(112*144).fill(1),exposureGroup:c.id});return {...c,features,levelErrorMm:features.level===null?null:features.level-c.referenceHeight};});
const report={...manifest,cases,scope:'Independent renderer consistency audit. Missed or biased detections are retained. This does not validate real-camera performance.'};
fs.writeFileSync('public/reference/audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(cases.map((c:any)=>({id:c.id,level:c.features.level,error:c.levelErrorMm,pellet:c.features.pelletAngle})),null,2));
