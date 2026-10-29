import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {appRoot,sourceRoot,tokenSource,operationStyleSource,railDataSource} from './source.mjs';
const standalone=process.argv.includes('--standalone');
const output=standalone?path.join(appRoot,'dist'):path.join(sourceRoot,'raillink');
const sharedRoot=standalone?'/NIMBYRAILTABLE/':'../';
const hash=createHash('sha256');
for(const dir of ['js','css','assets'])for(const name of (await fs.readdir(path.join(appRoot,dir))).sort()){hash.update(dir+'/'+name);hash.update(await fs.readFile(path.join(appRoot,dir,name)));}
for(const file of ['index.html','sw.js','tools/build-pages.mjs'])hash.update(await fs.readFile(path.join(appRoot,file)));
hash.update(tokenSource());hash.update(operationStyleSource());
const version=hash.digest('hex').slice(0,12),versioned=url=>url+'?v='+version;
await fs.mkdir(output,{recursive:true});
for(const dir of ['js','css','assets']) await fs.cp(path.join(appRoot,dir),path.join(output,dir),{recursive:true});
// Every relative module import and stylesheet belongs to the same release.
for(const file of await fs.readdir(path.join(output,'js'))){
 if(!file.endsWith('.js'))continue;
 const filename=path.join(output,'js',file),source=await fs.readFile(filename,'utf8');
 await fs.writeFile(filename,source.replace(/((?:from\s*|import\s*\()\s*['"])(\.\/[^'"]+\.js)(['"])/g,(_,prefix,url,quote)=>prefix+versioned(url)+quote));
}
await fs.writeFile(path.join(output,'tokens.css'),tokenSource());
await fs.writeFile(path.join(output,'operations-source.css'),operationStyleSource());
for(const file of ['manifest.webmanifest','icon.svg'])await fs.copyFile(path.join(appRoot,file),path.join(output,file));
const shell=[...(await fs.readdir(path.join(appRoot,'js'))).map(f=>'./js/'+f),...(await fs.readdir(path.join(appRoot,'css'))).map(f=>'./css/'+f),...(await fs.readdir(path.join(appRoot,'assets'))).map(f=>'./assets/'+f),'./tokens.css','./operations-source.css','./boot.js','./manifest.webmanifest','./icon.svg'];
await fs.writeFile(path.join(output,'sw.js'),(await fs.readFile(path.join(appRoot,'sw.js'),'utf8')).replace(/const CACHE='[^']+';/,`const CACHE='raillink-${version}';`).replace('/* APP_ASSETS */',shell.map(s=>JSON.stringify(/\.(js|css)$/.test(s)?versioned(s):s)).join(',')));
let html=await fs.readFile(path.join(appRoot,'index.html'),'utf8');
html=html.replace('href="/shared/tokens.css"','href="./tokens.css"').replace('href="/shared/operations.css"','href="./operations-source.css"').replace('href="/css/app.css"','href="./css/app.css"').replace('href="/NIMBYRAILTABLE/"',`href="${sharedRoot}"`);
html=html.replace(/<script src="\/shared\/runtime\.js"[\s\S]*?<\/script>\s*<script type="module" src="\/js\/app.js"><\/script>/, '<script type="module" src="./boot.js"></script>');
html=html.replace(/(href=")([^"]+\.css)(")/g,(_,a,url,b)=>a+versioned(url)+b).replace('src="./boot.js"',`src="${versioned('./boot.js')}"`);
await fs.writeFile(path.join(output,'index.html'),html);
await fs.writeFile(path.join(output,'boot.js'),`// Load the same source scripts as the original app, in its declared order.
try {
  window.NIMBI_DISABLE_WEATHER=true;
  const root=new URL(${JSON.stringify(sharedRoot)},location.href);
  const response=await fetch(new URL('index.html',root),{cache:'no-cache'});
  if(!response.ok)throw new Error('공통 데이터 목록을 불러올 수 없습니다.');
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');
  const features=new Set(['nimbi_demand.js','nimbi_booking_dynamics.js','nimbi_inventory.js','nimbi_delay.js','nimbi_congestion.js']);
  const sources=[...doc.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')).filter(src=>src.startsWith('data/')||src.startsWith('js/core/')||src.startsWith('js/shared/')||features.has(src.split('/').pop().split('?')[0]));
  if(!sources.some(s=>s.includes('nimbi_rail_domain.js')))throw new Error('공통 모듈이 아직 배포되지 않았습니다.');
  for(const src of sources){
    const url=new URL(src,root);
    if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))throw new Error('잘못된 데이터 경로');
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url.href;s.onload=resolve;s.onerror=()=>reject(new Error('데이터 로딩 실패'));document.body.append(s);});
  }
  ${railDataSource()}
  await import('./js/app.js?v=${version}');
} catch(error){document.getElementById('main').textContent=error.message+' 새로고침하여 다시 시도하세요.';}
`);
console.log(`Built RailLink into ${output}; shared railway sources: ${sharedRoot}`);
