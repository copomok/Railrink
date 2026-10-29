import {kstDate,addDays} from './model.js';
import {minuteOf} from './railway-time.js';
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
const railIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-2 7h14M8 14h.01M16 14h.01M8 18l-3 4m11-4 3 4M9 6h6"/></svg>';
export function tourismView({model,esc}){
 return `<div class="tour-cards">${tourismGroups(model).map(group=>`<button class="tour-product-card" data-action="tour-grade" data-value="${esc(group.grade)}" style="--tour-color:${esc(model.data.colors[group.grade])}"><span class="tour-product-icon">${railIcon}</span><span class="tour-card-copy"><strong>${esc(group.grade)}</strong><small>${group.systems.length}개 운행 계통 · 계통 선택</small></span><span class="tour-card-arrow" aria-hidden="true">›</span></button>`).join('')||'<p>등록된 관광열차가 없습니다.</p>'}</div>`;
}
export function tourSystemsView({model,esc,grade,date}){
 const group=tourismGroups(model).find(g=>g.grade===grade);
 if(!group)return tourismView({model,esc});
 return `<section class="tour-route-page"><div class="page-head"><h2>${esc(grade)}</h2><p>이용할 계통을 선택해 열차를 조회하세요.</p></div><label class="tour-date">여행일<input type="date" id="tour-date" min="${kstDate()}" max="${addDays(kstDate(),30)}" value="${esc(date)}"></label><div class="tour-cards">${group.systems.map(system=>{const direction=system.directions.find(d=>d.id==='down')||system.directions[0],first=direction.trains[0];return `<button class="tour-system-card" data-action="tour-system" data-value="${esc(system.id)}"><span class="tour-card-copy"><strong>${esc(first.from)} ↔ ${esc(first.to)}</strong><small>${esc(system.line)}</small><span class="tour-card-note">상행·하행 열차 조회</span></span><span class="tour-card-arrow" aria-hidden="true">›</span></button>`;}).join('')}</div></section>`;
}
export function tourDirectionView({system,q,esc}){
 return `<section class="tour-result-context"><div><strong>${esc(q.tourGrade)}</strong><button data-action="tour-back">계통 변경 ›</button></div><div class="tour-direction-tabs" role="group" aria-label="관광열차 운행 방향">${system.directions.map(d=>{const t=d.trains[0];return `<button data-tour-direction="${esc(d.id)}" aria-pressed="${q.from===t.from&&q.to===t.to}"><b>${esc(d.label)}</b><span>${esc(t.from)} → ${esc(t.to)}</span></button>`;}).join('')}</div></section>`;
}
