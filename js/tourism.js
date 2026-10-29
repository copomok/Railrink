import {kstDate,addDays} from './model.js';
import {displayClock,minuteOf} from './railway-time.js';
export function tourismGroups(model){
 const groups=new Map();
 for(const train of model.trains){
  if(!['남도해양','국악와인'].includes(train.grade))continue;
  const stops=model.data.stops(train),first=stops[0],last=stops.at(-1);
  if(!first?.dep||!last?.arr)continue;
  const endpoints=[first.s,last.s].sort((a,b)=>a.localeCompare(b,'ko'));
  const id=JSON.stringify([train.line||'',endpoints]);
  if(!groups.has(train.grade))groups.set(train.grade,new Map());
  const systems=groups.get(train.grade);
  if(!systems.has(id))systems.set(id,{id,line:train.line||'',endpoints,directions:new Map()});
  const system=systems.get(id),dir=train.dir||`${first.s} → ${last.s}`;
  if(!system.directions.has(dir))system.directions.set(dir,[]);
  system.directions.get(dir).push({train,key:model.key(train),from:first.s,to:last.s,dep:first.dep,arr:last.arr});
 }
 return [...groups].map(([grade,systems])=>({grade,systems:[...systems.values()].map(system=>({...system,directions:[...system.directions].sort(([a],[b])=>a.localeCompare(b)).map(([id,trains])=>({id,label:id==='up'?'상행':id==='down'?'하행':id,trains:trains.sort((a,b)=>minuteOf(a.dep)-minuteOf(b.dep)||String(a.train.no).localeCompare(String(b.train.no)))}))}))}));
}
export function tourismView({model,esc,date}){
 const groups=tourismGroups(model);
 return `<section class="tourism-catalog"><label class="tour-date">여행일<input type="date" id="tour-date" min="${kstDate()}" max="${addDays(kstDate(),30)}" value="${esc(date)}"></label>${groups.map(group=>`<details class="tour-grade" data-tour-grade="${esc(group.grade)}"><summary><strong style="color:${esc(model.data.colors[group.grade])}">${esc(group.grade)}</strong><span>${group.systems.length}개 계통</span></summary><div class="tour-systems">${group.systems.map(system=>`<details class="tour-system"><summary><div><b>${system.endpoints.map(esc).join(' ↔ ')}</b><small>${esc(system.line)}</small></div><span>시간표 ⌄</span></summary>${system.directions.map(direction=>`<section class="tour-direction" data-tour-direction="${esc(direction.id)}"><h4>${esc(direction.label)} <span>${esc(direction.trains[0].from)} → ${esc(direction.trains[0].to)}</span></h4><div class="tour-train-list">${direction.trains.map(t=>`<div class="tour-train" data-tour-train="${esc(t.key)}"><strong>${esc(t.train.no)}</strong><span><b>${displayClock(t.dep)} → ${displayClock(t.arr)}</b></span><button data-action="tour" data-value="${esc(t.key)}" aria-label="${esc(group.grade)} ${esc(t.train.no)} 열차 조회">조회</button></div>`).join('')}</div></section>`).join('')}</details>`).join('')}</div></details>`).join('')||'<p>등록된 관광열차가 없습니다.</p>'}</section>`;
}
