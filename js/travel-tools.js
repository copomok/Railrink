import {addDays,kstDate} from './model.js';
export async function previewPass(model,config){
 if(typeof navigator!=='undefined'&&!navigator.onLine)throw Error('오프라인에서는 새 반복 일정을 조회할 수 없습니다.');
 model.validateQuery({...config,date:config.start});
 if(!config.name.trim()||!config.alias.trim())throw Error('정기 일정 이름과 승객 별칭을 입력하세요.');
 if(!config.weekdays.length)throw Error('반복 요일을 선택하세요.');
 const entries=[],tickets=model.read().tickets;
 for(let i=0;i<28;i++){
  const date=addDays(config.start,i);if(date>addDays(kstDate(),30))break;
  if(!config.weekdays.includes(new Date(date+'T12:00:00+09:00').getUTCDay()))continue;
  const q={...config,date,grade:'all',sort:'departure'},r=model.search(q).find(r=>r.key===config.trainKey);
  let reason='',draft=null;
  if(!r)reason='이 날짜에 출발 가능한 열차 없음';
  else if(tickets.some(t=>t.status==='active'&&Date.parse(t.departure)<+model.departure(r.seg,date)+r.duration*60000&&+model.departure(r.seg,date)<Date.parse(t.arrival||new Date(Date.parse(t.departure)+model.data.duration(t.dep,t.arr)*60000).toISOString())))reason='기존 일정과 중복 또는 충돌';
  else try{const state=model.availability(r.train,q);if(!state.eligible||state.available<+q.pax)throw Error('좌석 부족 또는 판매 전');const assignment=q.cls==='standing'?{seats:[],split:false}:model.autoAssign(r.train,q);if(assignment.split)throw Error('일행 인접 좌석 부족');draft={key:r.key,q,seats:assignment.seats,names:Array(+q.pax).fill(config.alias),discount:'none',discounts:Array(+q.pax).fill('none')};}catch(error){reason=error.message;}
  entries.push({date,draft,reason});await new Promise(resolve=>setTimeout(resolve,0));
 }
 return entries;
}
export function travelBoard(tickets,model,esc){
 const sorted=tickets.filter(t=>t.status==='active').sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));let day='';
 return `<section class="travel-board"><h2>내 여행 일정</h2>${sorted.length?sorted.map(t=>{const header=t.travelDate!==day?`<h3>${esc(t.travelDate)}${day?' · 다음 여행일':''}</h3>`:'';day=t.travelDate;const platform=model.data.platform(t.trainNo,t.fromStn);return `${header}<article><b>${esc(t.dep)} ${esc(t.fromStn)} 출발</b><p>${esc(t.grade)} ${esc(t.trainNo)} · ${t.seats.map(esc).join(', ')||'입석'}</p><p>${esc(t.arr)} ${esc(t.toStn)} 도착 · ${platform==null?'승강장 미등록':esc(platform)+'번 승강장'}</p><button data-action="qr" data-value="${esc(t.id)}">시제품 승차권</button></article>`;}).join(''):'<p class="empty">예정된 여행이 없습니다.</p>'}</section>`;
}
