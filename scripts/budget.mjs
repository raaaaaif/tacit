import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(p);}}
walk('dist');
let compressed=0,raw=0;
for(const f of files){const b=fs.readFileSync(f);raw+=b.length;compressed+=/\.(woff2?|png|jpg|zip|3mf)$/.test(f)?b.length:gzipSync(b).length;}
const result={scope:'Conservative whole-site sum, including lazy CAD module and all holder variants',rawBytes:raw,gzipBytes:compressed,initialBudgetBytes:2500000,totalBudgetBytes:12000000,passed:compressed<=2500000&&raw<=12000000};
console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=1;
