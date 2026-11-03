let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{installPrompt=null;});
export async function installApp(showDialog){
 if(matchMedia('(display-mode: standalone)').matches||navigator.standalone){showDialog('레일링크 앱','<p>설치된 레일링크 앱을 이용 중입니다.</p>');return;}
 if(installPrompt){const prompt=installPrompt;await prompt.prompt();await prompt.userChoice;installPrompt=null;return;}
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 showDialog('레일링크 앱 설치',ios?'<p>Safari의 공유 버튼을 누른 뒤 <b>홈 화면에 추가</b>를 선택해 주세요.</p>':'<p>브라우저 메뉴에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택해 주세요.</p>');
}
export function initPWA(notify){
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 const controlled=Boolean(navigator.serviceWorker.controller);let refreshing=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled&&!refreshing){refreshing=true;location.reload();}});
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async registration=>{
  const activate=()=>registration.waiting?.postMessage({type:'activate-update'});
  activate();registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',activate));
  const ready=await navigator.serviceWorker.ready;
  const urls=new Set([...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(e=>e.src||e.href));for(const url of window.RailSourceURLs||[])urls.add(url);urls.add(new URL('/NIMBYRAILTABLE/index.html',location.href).href);
  ready.active?.postMessage({type:'cache-sources',urls:[...urls]});
 }).catch(()=>notify('앱 설치 준비를 완료하지 못했습니다. 온라인에서 다시 열어 주세요.'));
 window.addEventListener('offline',()=>notify('오프라인 · 저장된 승차권을 확인할 수 있습니다.'));
}
