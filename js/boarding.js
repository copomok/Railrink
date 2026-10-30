import {operationSnapshot,operationPosition} from './operations.js';
import {clockAt,dateAt,minuteOf} from './railway-time.js';

export const STAGES=['BEFORE_BOARDING','ON_BOARD','AFTER_ARRIVAL'];
export const stageNames=['탑승 전','탑승 중','도착 후'];
const valid=n=>typeof n==='number'&&Number.isFinite(n);
export const ticketQuery=t=>({from:t.fromStn,to:t.toStn,date:t.travelDate,pax:t.passengerCount,cls:t.seatClass});
export function ticketTimes(t){
 const departure=Date.parse(t.departure),explicit=Date.parse(t.arrival),a=minuteOf(t.dep),b=minuteOf(t.arr);
 const arrival=Number.isFinite(explicit)?explicit:Number.isFinite(departure)&&a!==null&&b!==null?departure+((b-a+1440)%1440)*60000:NaN;
 return {departure,arrival};
}
// Resolve only from the current local booking store. A remembered ID is not authorization.
export function boardingTickets(tickets,id){
 const ticket=tickets.find(t=>t.id===id&&t.status==='active');
 if(!ticket)return [];
 return (ticket.groupId&&['transfer','mixed'].includes(ticket.groupType)?tickets.filter(t=>t.groupId===ticket.groupId&&t.status==='active'):[ticket])
  .sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));
}
// Optional future verified feed contract. No current upstream simulation is a verified feed.
function verifiedReport(report,t,now){
 return report?.verified===true&&report.trainKey===t.key&&report.serviceDate===(t.serviceDate||t.travelDate)&&
  valid(report.updatedAt)&&report.updatedAt<=now+60000?report:null;
}
export function boardingState(ticket,snapshot,now=Date.now(),{report=null,offline=false}={}){
 now=+now;const saved=ticketTimes(ticket),verified=verifiedReport(report,ticket,now);
 const stale=!!verified&&(offline||now-verified.updatedAt>5*60000),fresh=stale?null:verified;
 const nodes=(snapshot?.nodes||[]).map(n=>{
  const update=verified?.stops?.find(s=>s.station===n.s);
  const arrTime=valid(update?.arrival)?update.arrival:n.arrTime,depTime=valid(update?.departure)?update.departure:n.depTime;
  return {...n,arrTime,depTime,platform:update?.platform??n.platform,
   arrivalDelay:valid(arrTime)&&valid(n.plannedArrival)?Math.max(0,Math.round((arrTime-n.plannedArrival)/60000)):Math.max(0,n.arrivalDelay||0),
   delay:valid(depTime)&&valid(n.plannedDeparture)?Math.max(0,Math.round((depTime-n.plannedDeparture)/60000)):Math.max(0,n.delay||0)};
 });
 const stops=nodes.filter(n=>n.stop&&n.index>=snapshot.fromIndex&&n.index<=snapshot.toIndex);
 const origin=stops[0],destination=stops.at(-1);
 const departure=origin?.depTime??snapshot?.departure??saved.departure,arrival=destination?.arrTime??snapshot?.arrival??saved.arrival;
 const hasTime=valid(departure)&&valid(arrival)&&arrival>departure;
 const cancelled=ticket.status!=='active'||verified?.status==='cancelled';
 // A verified arrival is a historical fact, even after its report becomes stale/offline.
 const arrived=!!verified&&verified.status==='arrived'&&verified.arrivalStation===ticket.toStn;
 const stage=arrived||hasTime&&now>=arrival?'AFTER_ARRIVAL':fresh?.status==='running'||hasTime&&now>=departure?'ON_BOARD':'BEFORE_BOARDING';
 const untilDeparture=hasTime?Math.ceil((departure-now)/60000):null,untilArrival=hasTime?Math.ceil((arrival-now)/60000):null;
 const departureDelay=hasTime?Math.max(0,Math.round((departure-saved.departure)/60000)):0;
 const arrivalDelay=hasTime?Math.max(0,Math.round((arrival-saved.arrival)/60000)):0;
 const delay=Math.max(departureDelay,arrivalDelay);
 const phase=cancelled?'운휴·취소':!hasTime?'운행 정보 확인 불가':arrived?'도착 완료':stage==='AFTER_ARRIVAL'?'도착 확인 중':stage==='ON_BOARD'?'운행 안내':delay?'출발 지연 예상':untilDeparture<=10?'출발 준비':'출발 예정';
 const position=hasTime&&stage==='ON_BOARD'?operationPosition({trainPhase:'running',now,nodes:stops},stops):null;
 const progress=cancelled||!hasTime?0:arrived?100:now<departure?0:now>=arrival?100:position&&stops.length>1?(position.index+position.fraction)/(stops.length-1)*100:0;
 const current=position?stops[position.index]:null,next=cancelled?null:stops.find(n=>(n.arrTime??n.depTime)>now&&n!==origin);
 const positionVerified=!!fresh&&typeof fresh.positionText==='string'&&!!fresh.positionText.trim();
 const location=positionVerified?fresh.positionText:!current?'위치 확인 중':position.index===position.nextIndex?`${current.s} 정차 예상`:`${current.s} → ${stops[position.nextIndex].s}`;
 const confidence=verified?(stale?'최근 확인 정보 · 갱신 필요':'실시간 확인'):snapshot?'운행 정보':'운행 정보 확인 불가';
 return {ticket,stage,phase,departure,arrival,plannedDeparture:saved.departure,plannedArrival:saved.arrival,departureDelay,arrivalDelay,delay,delayConfirmed:!!verified,hasTime,untilDeparture,untilArrival,stops,next,position,progress:Math.min(100,Math.max(0,progress)),location,positionVerified,platform:origin?.platform??null,confidence,offline,stale,arrived,cancelled,updatedAt:verified?.updatedAt??null,calculatedAt:now,error:snapshot?.error||'',verified:!!fresh};
}

export function transferGuidance(legs,index,now=Date.now()){
 const current=legs[index],next=legs[index+1];if(!next)return null;
 const sameStation=current.ticket.toStn===next.ticket.fromStn;
 const wait=current.hasTime&&next.hasTime?Math.floor((next.departure-current.arrival)/60000):null;
 const remaining=current.hasTime&&next.hasTime?Math.ceil((next.departure-Math.max(+now,current.arrival))/60000):null;
 return {next,station:current.ticket.toStn,wait,remaining,sameStation,risk:wait!==null&&(wait<10||remaining<=5),message:!sameStation?'역간 이동시간 확인 필요':wait===null?'환승 시간 확인 불가':wait<0?'예상 도착이 다음 열차 출발보다 늦습니다.':remaining<=5?'환승 여유가 부족할 수 있습니다.':'승강장 이동시간을 확인해 주세요.'};
}
export function activeLegIndex(legs,now=Date.now()){
 const running=legs.findIndex(l=>!l.cancelled&&l.hasTime&&l.departure<=+now&&l.arrival>+now);
 if(running>=0)return running;
 const next=legs.findIndex(l=>!l.cancelled&&l.hasTime&&l.departure>+now);
 return next>=0?next:Math.max(0,legs.length-1);
}
// Canonical data is already loaded/cached by the application. No extra network poller.
export function createBoardingService(model){
 const cache=new Map(),seatCache=new Map();
 function leg(ticket,now,offline){
  const train=model.byKey.get(ticket.key);let snapshot=null;
  if(train){
   const previous=cache.get(ticket.id);
   try{
    // Completed runs do not keep querying the simulation. Active runs refresh once/minute.
    const reuse=previous&&(previous.arrival<=+now||Math.floor(previous.now/60000)===Math.floor(+now/60000));
    snapshot=reuse?previous:operationSnapshot(model,train,ticketQuery(ticket),new Date(now));
    snapshot={...snapshot,nodes:snapshot.nodes.map(n=>({...n,platform:model.data.platform?.(train.no,n.s)??null}))};
    cache.set(ticket.id,snapshot);
   }catch{snapshot=previous?{...previous,error:'시간표 갱신 실패 · 마지막 시간표로 계산합니다.'}:null;}
  }
  return boardingState(ticket,snapshot,now,{offline});
 }
 return {
  seatDescription(ticket){
   if(!ticket.seats?.length)return '지정 좌석 없음';
   const key=JSON.stringify([ticket.key,ticket.seatClass,ticket.seats]);
   if(!seatCache.has(key)){
    let seats=[];try{const train=model.byKey.get(ticket.key);if(train)seats=model.seats(train,ticketQuery(ticket)).flatMap(c=>c.seats);}catch{}
    seatCache.set(key,ticket.seats.join(' · '));
   }
   return seatCache.get(key);
  },
  journey(id,now=Date.now(),offline=false){return boardingTickets(model.read().tickets,id).map(t=>leg(t,+now,offline));},
  upcoming(now=Date.now(),offline=false){
   const seen=new Set(),journeys=[];
   for(const t of model.read().tickets){
    if(t.status!=='active')continue;
    const key=['transfer','mixed'].includes(t.groupType)?t.groupId||t.id:t.id;if(seen.has(key))continue;seen.add(key);
    const legs=this.journey(t.id,now,offline),index=activeLegIndex(legs,now),state=legs[index];
    if(!state||state.cancelled||!state.hasTime||legs.at(-1).arrival<=+now)continue;
    journeys.push({ticket:state.ticket,state,legs,index});
   }
   return journeys.sort((a,b)=>Number(b.state.stage==='ON_BOARD')-Number(a.state.stage==='ON_BOARD')||a.state.departure-b.state.departure);
  }
 };
}

export const timeLabel=value=>valid(value)?clockAt(value):'—';
export function remainingLabel(minutes){if(minutes===null)return '시간 확인 중';return `${Math.floor(Math.max(0,minutes)/60)?Math.floor(minutes/60)+'시간 ':''}${Math.max(0,minutes)%60}분`;}
export function arrivalNotice(s){
 if(s.stage!=='ON_BOARD'||s.untilArrival>30||s.cancelled)return '';
 return `${s.ticket.toStn} 도착까지 약 ${remainingLabel(s.untilArrival)}${s.untilArrival<=10?' · 하차를 준비해 주세요.':''}`;
}
export function safeJourneyText(s){return `${s.ticket.grade} ${s.ticket.trainNo}\n${dateAt(s.departure)} ${s.ticket.fromStn} ${timeLabel(s.departure)} → ${s.ticket.toStn} ${timeLabel(s.arrival)}`;}
export function calendarFile(s){
 if(!s.hasTime)throw Error('일정 시각을 확인할 수 없습니다.');
 const stamp=n=>new Date(n).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const escape=v=>String(v).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,'\\$&');
 // Random calendar UID, never the reservation ID or QR payload.
 const uid=globalThis.crypto.randomUUID();
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RailLink//Journey//KO','BEGIN:VEVENT',`UID:${uid}@raillink`,`DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(s.departure)}`,`DTEND:${stamp(s.arrival)}`,`SUMMARY:${escape(s.ticket.grade+' '+s.ticket.trainNo+' · '+s.ticket.fromStn+' → '+s.ticket.toStn)}`,'END:VEVENT','END:VCALENDAR'];
 // RFC5545: fold UTF-8 lines at 75 octets without cutting a code point.
 return lines.map(line=>{let result='',length=0;for(const c of line){const size=new TextEncoder().encode(c).length;if(length+size>75){result+='\r\n ';length=1;}result+=c;length+=size;}return result;}).join('\r\n')+'\r\n';
}
