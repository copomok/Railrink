import {transferGuidance} from './boarding.js';

// Events contain a local ID for navigation only; never a QR or passenger payload.
export function boardingEvents(legs,now=Date.now(),previous=new Map()){
 const events=[];
 legs.forEach((s,index)=>{
  const t=s.ticket,base={id:t.id,title:`${t.grade} ${t.trainNo}`,body:''};
  const add=(kind,body,version='')=>events.push({...base,key:`${t.id}:${kind}:${version}`,body});
  if(s.cancelled){add('cancel','운휴·취소 정보를 확인하세요.');return;}
  if(!s.hasTime)return;
  if(s.untilDeparture>0&&s.untilDeparture<=60){const threshold=s.untilDeparture<=10?10:s.untilDeparture<=30?30:60;add('departure-'+threshold,`출발까지 약 ${s.untilDeparture}분 · 승차권과 탑승 정보를 확인하세요.`,s.departure);}
  if(s.stage==='ON_BOARD'&&s.untilArrival>0&&s.untilArrival<=30){const threshold=s.untilArrival<=5?5:s.untilArrival<=10?10:30;add('arrival-'+threshold,`목적지 도착까지 약 ${s.untilArrival}분 · 하차를 준비하세요.`,s.arrival);}
  const old=previous.get(t.id);
  if(old&&s.stage!=='AFTER_ARRIVAL'){
   if(old.departure!==s.departure)add('changed-time','출발 예정 시각이 변경되었습니다.',s.departure);
   if(s.platform!=null&&old.platform!==s.platform)add('platform',`승강장 정보가 ${s.platform}번으로 변경되었습니다.`,s.platform);
   if(s.delay>0&&old.delay!==s.delay)add('delay',`예상 지연 ${s.delay}분 · 운행 정보를 확인하세요.`,s.delay);
  }
  const transfer=transferGuidance(legs,index,now);
  if(transfer?.risk&&s.untilArrival<=30&&transfer.next.departure>+now)add('transfer','환승 여유가 부족할 수 있습니다. 다음 열차를 확인하세요.',`${s.arrival}:${transfer.next.departure}`);
  previous.set(t.id,{departure:s.departure,platform:s.platform,delay:s.delay});
 });
 return events;
}
export function createBoardingAlerts({service,model,notify,open,storage=globalThis.localStorage}){
 const key='raillink.boarding.alerts',previous=new Map();let seen=[];
 try{const saved=JSON.parse(storage.getItem(key)||'[]');if(Array.isArray(saved))seen=saved.filter(s=>typeof s==='string').slice(-250);}catch{}
 async function check(){
  if(document.visibilityState!=='visible'||!model.read().notifications)return;
  const journeys=service.upcoming(Date.now(),!navigator.onLine),events=journeys.flatMap(j=>boardingEvents(j.legs,Date.now(),previous));
  for(const event of events){
   if(seen.includes(event.key))continue;seen.push(event.key);seen=seen.slice(-250);
   try{storage.setItem(key,JSON.stringify(seen));}catch{}
   const body=`${event.title} · ${event.body}`;notify(body);
   try{
    if(storage.getItem('raillink.systemAlerts')!=='1'||!('Notification' in window)||Notification.permission!=='granted')continue;
    const registration=await navigator.serviceWorker?.getRegistration();
    if(registration?.active)await registration.showNotification('레일링크 탑승 안내',{body,tag:event.key,data:{boardingId:event.id}});
    else{const notification=new Notification('레일링크 탑승 안내',{body,tag:event.key});notification.onclick=()=>{window.focus();notification.close();open(event.id);};}
   }catch{/* The in-app message remains available if the platform rejects notifications. */}
  }
 }
 return {check};
}
