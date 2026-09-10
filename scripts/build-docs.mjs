import fs from 'node:fs';
const source=fs.readFileSync('docs/methods.md','utf8');
const version=fs.readFileSync('src/model/geometry.ts','utf8').match(/MODEL_VERSION = "([^"]+)"/)[1];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const inline=s=>escape(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g,'<a href="$2">$1</a>');
const blocks=source.trim().split(/\n\s*\n/).map(b=>{
 const heading=b.match(/^(#{1,3}) (.+)$/);if(heading)return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
 if(b.startsWith('- '))return '<ul>'+b.split('\n').map(l=>`<li>${inline(l.replace(/^- /,''))}</li>`).join('')+'</ul>';
 return '<p>'+inline(b.replaceAll('\n',' '))+'</p>';
}).join('\n');
fs.mkdirSync('public/docs',{recursive:true});
fs.writeFileSync('public/docs/methods.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TACIT — Model & evidence</title><style>*{box-sizing:border-box}body{margin:0;background:#eeede6;color:#27352e;font:16px/1.75 system-ui,sans-serif}main{max-width:820px;margin:60px auto;padding:0 28px 80px}nav{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #ced3c7;padding-bottom:20px;margin-bottom:55px;font-size:13px}a{color:#365f47;text-underline-offset:3px}h1{font-size:38px;line-height:1.15;letter-spacing:-1.4px;margin-bottom:35px}h2{font-size:23px;margin-top:48px;font-weight:550;letter-spacing:-.4px}p{margin:20px 0}li{margin:12px 0}code{font-size:13px;overflow-wrap:anywhere}strong{font-weight:600}@media(max-width:600px){main{margin-top:28px}h1{font-size:30px}}</style><main><nav><a href="/">← TACIT workbench</a><span>Model & evidence / ${version}</span></nav>${blocks}</main></html>`);
