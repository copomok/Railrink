// An already-open PWA may receive new modules while still holding the old HTML.
// Load the styles for this module release before displaying its new components.
export async function ensureProductStyles(){
 const version=new URL(import.meta.url).searchParams.get('v');
 const files=['app','mobile','home','product','operations','booking','ticketing','tourism','boarding'];
 await Promise.all(files.map(file=>{
  const url=new URL('../css/'+file+'.css',import.meta.url);if(version)url.searchParams.set('v',version);
  if([...document.querySelectorAll('link[rel=stylesheet]')].some(link=>link.href===url.href&&link.sheet))return;
  return new Promise((resolve,reject)=>{
   const link=document.createElement('link');link.rel='stylesheet';link.href=url.href;
   link.onload=resolve;link.onerror=()=>reject(Error('화면 스타일을 불러오지 못했습니다. 온라인에서 앱을 다시 열어 주세요.'));document.head.append(link);
  });
 }));
}
