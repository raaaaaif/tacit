import fs from 'node:fs';
import {liquidHeight} from '../src/model/geometry';
import {stream} from '../src/model/math';
const r=stream(4579,'independent-volume');const cases=[];
for(const tilt of [0,5,10] as const)for(let i=0;i<32;i++){const volume=100+r()*850,tip:[number,number,number]=[0,0,liquidHeight(volume,tilt)-2-r()*2];cases.push({tilt,volume,tip,height:liquidHeight(volume,tilt,tip)});}
fs.writeFileSync('work/numeric-cases.json',JSON.stringify(cases));
