import {createBoardingService,activeLegIndex,STAGES,ticketQuery,safeJourneyText,calendarFile} from './boarding.js';
import {boardingView} from './boarding-view.js';

export function createBoardingController({model,main,esc,icon,go,notify,ticket,operation,receipt,rebook,alerts,history}){
 const service=createBoardingService(model),key='raillink.boarding.selected';
 let selected='',preview=null,manualLeg=null,origin='tickets';
 try{selected=sessionStorage.getItem(key)||'';}catch{}
 if(!selected)try{selected=localStorage.getItem(key)||'';}catch{}
 const resolve=()=>{
  const legs=service.journey(selected,Date.now(),!navigator.onLine);
  const index=manualLeg===null?activeLegIndex(legs):Math.min(manualLeg,Math.max(0,legs.length-1));
  return {legs,index,state:legs[index]};
 };
 function render(){
  const {legs,index}=resolve();
  if(!legs.length){main.innerHTML='<div class="empty"><h2>이용 가능한 승차권을 확인해 주세요</h2><p>취소·변경·삭제된 예약은 탑승 안내를 열 수 없습니다.</p><a href="#tickets">내 승차권으로</a></div>';return;}
  // Keep focus and scroll while updating the minute-based display.
  const focused=main.contains(document.activeElement)?document.activeElement:null;
  const selector=focused?.dataset.boardingStage?`[data-boarding-stage="${focused.dataset.boardingStage}"]`:focused?.dataset.boardingAction?`[data-boarding-action="${focused.dataset.boardingAction}"]`:focused?.dataset.boardingLeg?`[data-boarding-leg="${focused.dataset.boardingLeg}"]`:focused?.id==="boarding-panel"?'#boarding-panel':null;
  main.innerHTML=boardingView({legs,index,preview,manualLeg,model,esc,icon,seatDescription:service.seatDescription(legs[index].ticket),shareSupported:legs[index].hasTime&&(!!navigator.share||!!navigator.clipboard?.writeText)});
  if(selector)main.querySelector(selector)?.focus({preventScroll:true});
 }
 function open(id){
  if(!service.journey(id).length){notify('이 브라우저에 저장된 유효한 승차권을 선택하세요.');return;}
  selected=id;preview=null;
  const legs=service.journey(id);const chosen=legs.findIndex(l=>l.ticket.id===id),active=activeLegIndex(legs);
  manualLeg=chosen===active?null:chosen;
  origin=['home','search','tickets'].includes(location.hash.slice(1))?location.hash.slice(1):'tickets';
  try{sessionStorage.setItem(key,id);}catch{}
  try{localStorage.setItem(key,id);}catch{}
  go('boarding');
 }
 main.addEventListener('keydown',e=>{
  const tab=e.target.closest('[data-boarding-stage]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const current=STAGES.indexOf(tab.dataset.boardingStage),next=e.key==='Home'?0:e.key==='End'?2:(current+(e.key==='ArrowRight'?1:2))%3;
  preview=STAGES[next];render();main.querySelector(`[data-boarding-stage="${preview}"]`)?.focus();
 });
 main.addEventListener('click',async e=>{
  const control=e.target.closest('[data-boarding-stage],[data-boarding-leg],[data-boarding-action]');if(!control||control.disabled)return;
  try{
   if(control.dataset.boardingStage){preview=control.dataset.boardingStage==='auto'?null:control.dataset.boardingStage;render();return;}
   if(control.dataset.boardingLeg){manualLeg=control.dataset.boardingLeg==='auto'?null:+control.dataset.boardingLeg;preview=null;render();return;}
   const {state}=resolve();if(!state){render();return;}
   const t=state.ticket,train=model.byKey.get(t.key);
   switch(control.dataset.boardingAction){
    case 'refresh':render();break;
    case 'ticket':ticket(t.id);break;
    case 'operation':if(train)operation(train,ticketQuery(t));break;
    case 'receipt':receipt(t.id);break;
    case 'history':history();break;
    case 'rebook':rebook(t);break;
    case 'alerts':alerts();break;
    case 'share':{
     const text=safeJourneyText(state);
     if(navigator.share)await navigator.share({title:'열차 여정',text});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);notify('예약번호·좌석·QR을 제외한 여정을 복사했습니다.');}
     break;
    }
    case 'calendar':{
     const url=URL.createObjectURL(new Blob([calendarFile(state)],{type:'text/calendar;charset=utf-8'}));
     const a=document.createElement('a');a.href=url;a.download='rail-journey.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('일정 파일을 내려받았습니다. 일정 앱에서 추가하세요.');break;
    }
   }
  }catch(error){if(error.name!=='AbortError')notify(error.message||'탑승 안내를 열지 못했습니다.');}
 });
 const refresh=()=>{if(location.hash==='#boarding'&&document.visibilityState==='visible'&&!document.querySelector('dialog[open]'))render();};
 document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);window.addEventListener('pageshow',refresh);
 async function consumeNotification(fallback){
  const pending=await new Promise(resolve=>{
   const request=indexedDB.open('raillink-bookings',1);request.onerror=()=>resolve(null);
   request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('state')){db.close();resolve(null);return;}
    const transaction=db.transaction('state','readwrite'),store=transaction.objectStore('state'),read=store.get('raillink.boarding.pending');let value=null;
    read.onsuccess=()=>{value=read.result;store.delete('raillink.boarding.pending');};
    transaction.oncomplete=()=>{db.close();resolve(value);};transaction.onabort=()=>{db.close();resolve(null);};
   };
  });
  const id=pending&&Date.now()-pending.at>=0&&Date.now()-pending.at<5*60000?pending.id:fallback;
  if(typeof id==='string')open(id);
 }
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='open-boarding')consumeNotification(e.data.id).catch(()=>{});});
 consumeNotification().catch(()=>{});
 return {open,render,refresh,service,get origin(){return origin;}};
}
