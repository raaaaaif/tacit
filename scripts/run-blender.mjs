import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const mac='/Applications/Blender.app/Contents/MacOS/Blender';
const binary=process.env.TACIT_BLENDER || (existsSync(mac)?mac:'blender');
const result=spawnSync(binary,['--background','--threads','2','--python','scripts/assets.py'],{stdio:'inherit'});
if(result.error){console.error('Blender could not start. Set TACIT_BLENDER to your Blender executable.');process.exit(1);}
process.exit(result.status??1);
