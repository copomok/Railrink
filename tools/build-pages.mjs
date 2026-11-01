import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {appRoot,sourceRoot,tokenSource,operationStyleSource,railDataSource,ticketExcludedFiles} from './source.mjs';
const standalone=process.argv.includes('--standalone');
const output=standalone?path.join(appRoot,'dist'):path.join(sourceRoot,'raillink');
const sharedRoot=standalone?'/NIMBYRAILTABLE/':'../';
const hash=createHash('sha256');
for(const dir of ['js','css','assets'])for(const name of (await fs.readdir(path.join(appRoot,dir))).sort()){hash.update(dir+'/'+name);hash.update(await fs.readFile(path.join(appRoot,dir,name)));}
for(const file of ['index.html','sw.js','tools/build-pages.mjs','tools/source.mjs'])hash.update(await fs.readFile(path.join(appRoot,file)));
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
await fs.writeFile(path.join(output,'boot.js'),`// Download shared sources together, then execute them in their canonical order.
try {
  window.NIMBI_DISABLE_WEATHER=true;
  const loading=document.querySelector('.loading');
  const progress=text=>{if(loading)loading.textContent=text;};
  const root=new URL(${JSON.stringify(sharedRoot)},location.href);
  const response=await fetch(new URL('index.html',root),{cache:'default'});
  if(!response.ok)throw new Error('공통 데이터 목록을 불러올 수 없습니다.');
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');
  const features=new Set(['nimbi_demand.js','nimbi_booking_dynamics.js','nimbi_inventory.js','nimbi_delay.js','nimbi_congestion.js']);
  const excluded=new Set(${JSON.stringify(ticketExcludedFiles)});
  const sources=[...doc.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')).filter(src=>{const file=src.split('?')[0];return (file.startsWith('data/')||file.startsWith('js/core/')||file.startsWith('js/shared/')||features.has(file.split('/').pop()))&&!excluded.has(file);});
  if(!sources.some(s=>s.includes('nimbi_rail_domain.js')))throw new Error('공통 모듈이 아직 배포되지 않았습니다.');
  const urls=sources.map(src=>{const url=new URL(src,root);if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))throw new Error('잘못된 데이터 경로');return url;});
  window.RailSourceURLs=Object.freeze(urls.map(url=>url.href));
  let received=0;progress('공통 철도 데이터를 내려받는 중입니다…');
  const payloads=await Promise.all(urls.map(async url=>{
    const source=await fetch(url,{cache:'force-cache'});if(!source.ok)throw new Error('공통 데이터를 불러오지 못했습니다.');
    const text=await source.text();received++;progress('공통 철도 데이터 '+received+'/'+urls.length);return {url,text};
  }));
  progress('열차 정보를 준비하는 중입니다…');
  for(const payload of payloads){
    const blob=URL.createObjectURL(new Blob([payload.text+'\\n//# sourceURL='+payload.url.href],{type:'text/javascript'}));
    try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=blob;script.onload=()=>{script.remove();resolve();};script.onerror=()=>{script.remove();reject(new Error('공통 데이터 실행에 실패했습니다.'));};document.body.append(script);});}
    finally{URL.revokeObjectURL(blob);}
  }
  ${railDataSource()}
  if(!window.RailData?.trains?.length)throw new Error('공통 열차 데이터를 준비하지 못했습니다.');
  await import('./js/app.js?v=${version}');
} catch(error){document.getElementById('main').textContent=error.message+' 새로고침하여 다시 시도하세요.';}
`);
console.log(`Built RailLink into ${output}; shared railway sources: ${sharedRoot}`);
