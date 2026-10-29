import fs from 'node:fs/promises';
import path from 'node:path';
import {appRoot,sourceRoot,tokenSource,railDataSource} from './source.mjs';
const standalone=process.argv.includes('--standalone');
const output=standalone?path.join(appRoot,'dist'):path.join(sourceRoot,'raillink');
const sharedRoot=standalone?'/NIMBYRAILTABLE/':'../';
await fs.mkdir(output,{recursive:true});
for(const dir of ['js','css']) await fs.cp(path.join(appRoot,dir),path.join(output,dir),{recursive:true});
await fs.writeFile(path.join(output,'tokens.css'),tokenSource());
for(const file of ['manifest.webmanifest','icon.svg'])await fs.copyFile(path.join(appRoot,file),path.join(output,file));
const shell=[...(await fs.readdir(path.join(appRoot,'js'))).map(f=>'./js/'+f),...(await fs.readdir(path.join(appRoot,'css'))).map(f=>'./css/'+f),'./tokens.css','./boot.js','./manifest.webmanifest','./icon.svg'];
await fs.writeFile(path.join(output,'sw.js'),(await fs.readFile(path.join(appRoot,'sw.js'),'utf8')).replace('/* APP_ASSETS */',shell.map(s=>JSON.stringify(s)).join(',')));
let html=await fs.readFile(path.join(appRoot,'index.html'),'utf8');
html=html.replace('href="/shared/tokens.css"','href="./tokens.css"').replace('href="/css/app.css"','href="./css/app.css"').replace('href="/NIMBYRAILTABLE/"',`href="${sharedRoot}"`);
html=html.replace(/<script src="\/shared\/runtime\.js"[\s\S]*?<\/script>\s*<script type="module" src="\/js\/app.js"><\/script>/, '<script type="module" src="./boot.js"></script>');
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
  await import('./js/app.js');
} catch(error){document.getElementById('main').textContent=error.message+' 새로고침하여 다시 시도하세요.';}
`);
console.log(`Built RailLink into ${output}; shared railway sources: ${sharedRoot}`);
