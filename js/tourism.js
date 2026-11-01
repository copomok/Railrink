import {kstDate,addDays} from './model.js';
import {minuteOf} from './railway-time.js';
import {tourProducts,resolveProductRoute,tourDuration} from './tour-products.js';
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
const productIcons={
 train:'<path d="M7 3h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-2 7h14M8 14h.01M16 14h.01M8 18l-3 4m11-4 3 4M9 6h6"/>',
 place:'<path d="M12 22S4 13 4 9a8 8 0 1 1 16 0c0 4-8 13-8 13ZM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>',
 meal:'<path d="M7 3v7m-3-7v4a3 3 0 0 0 6 0V3M7 10v11m7-9V7a4 4 0 0 1 4-4v18"/>',
 history:'<path d="M3 9h18M5 9v10m4-10v10m6-10v10m4-10v10M3 19h18M12 3l9 5H3Z"/>',
 coffee:'<path d="M4 7h13v8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Zm13 2h2a3 3 0 0 1 0 6h-2M7 3v2m4-3v3m4-2v2"/>',
 food:'<path d="M7 3v7m-3-7v4a3 3 0 0 0 6 0V3M7 10v11m7-9V7a4 4 0 0 1 4-4v18"/>',
 city:'<path d="M4 21V8l7-4v17m0-11 9-4v15M7 11h1m-1 4h1m6-2h1m2 0h1m-4 4h1m2 0h1"/>',
 sun:'<path d="M12 4V2m0 20v-2m8-8h2M2 12h2m14-6 1.5-1.5M4.5 19.5 6 18m12 0 1.5 1.5M4.5 4.5 6 6m1 9a5 5 0 0 1 10 0M3 19h18"/>',
 route:'<path d="M6 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm16 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM4 6v5a3 3 0 0 0 3 3h10a3 3 0 0 1 3 3v1m0-12V4a2 2 0 1 0-4 0v2a2 2 0 1 0 4 0Z"/>'
};
const productIcon=kind=>`<svg viewBox="0 0 24 24" aria-hidden="true">${productIcons[kind]||productIcons.route}</svg>`;
export function tourismView({model,esc,filter='all'}){
 const tourist= tourismGroups(model),showTrains=filter!=='themes',showThemes=filter!=='trains';
 const filters=[['all',`전체 ${tourist.length+tourProducts.length}`],['trains',`관광열차 ${tourist.length}`],['themes',`지역·테마 ${tourProducts.length}`]];
 return `<div class="tour-filter" role="group" aria-label="관광상품 분류">${filters.map(([id,label])=>`<button data-action="tour-filter" data-value="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div>${showTrains?`<section class="tour-list-section"><h3>관광열차</h3><div class="tour-cards">${tourist.map(group=>`<button class="tour-product-card" data-action="tour-grade" data-value="${esc(group.grade)}" style="--tour-color:${esc(model.data.colors[group.grade])}"><span class="tour-product-icon">${railIcon}</span><span class="tour-card-copy"><strong>${esc(group.grade)}</strong><small>${group.systems.length}개 운행 계통 · 계통 선택</small></span><span class="tour-card-arrow" aria-hidden="true">›</span></button>`).join('')||'<p>등록된 관광열차가 없습니다.</p>'}</div></section>`:''}${showThemes?`<section class="tour-list-section"><h3>지역·테마 여행 <small>${tourProducts.length}개</small></h3><div class="tour-cards">${tourProducts.map(product=>`<button class="tour-product-card" data-action="tour-product" data-value="${product.id}"><span class="tour-product-icon">${productIcon(product.icon)}</span><span class="tour-card-copy"><strong>${esc(product.name)}</strong><small>${esc(product.category)} · ${product.durations.map(d=>d.label).join('/')}</small></span><span class="tour-card-arrow" aria-hidden="true">›</span></button>`).join('')}</div></section>`:''}`;
}
export function tourSystemsView({model,esc,grade,date}){
 const group=tourismGroups(model).find(g=>g.grade===grade);
 if(!group)return tourismView({model,esc});
 return `<section class="tour-route-page"><div class="page-head"><h2>${esc(grade)}</h2><p>이용할 계통을 선택해 열차를 조회하세요.</p></div><label class="tour-date">여행일<input type="date" id="tour-date" min="${kstDate()}" max="${addDays(kstDate(),30)}" value="${esc(date)}"></label><div class="tour-cards">${group.systems.map(system=>{const direction=system.directions.find(d=>d.id==='down')||system.directions[0],first=direction.trains[0];return `<button class="tour-system-card" data-action="tour-system" data-value="${esc(system.id)}"><span class="tour-card-copy"><strong>${esc(first.from)} ↔ ${esc(first.to)}</strong><small>${esc(system.line)}</small><span class="tour-card-note">상행·하행 열차 조회</span></span><span class="tour-card-arrow" aria-hidden="true">›</span></button>`;}).join('')}</div></section>`;
}
export function tourDirectionView({system,q,esc}){
 return `<section class="tour-result-context"><div><strong>${esc(q.tourGrade)}</strong><button data-action="tour-back">계통 변경 ›</button></div><div class="tour-direction-tabs" role="group" aria-label="관광열차 운행 방향">${system.directions.map(d=>{const t=d.trains[0];return `<button data-tour-direction="${esc(d.id)}" aria-pressed="${q.from===t.from&&q.to===t.to}"><b>${esc(d.label)}</b><span>${esc(t.from)} → ${esc(t.to)}</span></button>`;}).join('')}</div></section>`;
}

export function tourProductDetailView({product,model,esc}){
 const route=resolveProductRoute(product,model),duration=product.durations.map(d=>d.label).join(' · '),returned=product.returns[product.defaultDuration];
 const segmentStations=product.segments?.flatMap(segment=>[segment.from,segment.to])||[];
 const unavailable=product.segments?segmentStations.filter((name,index)=>!model.stations.includes(name)&&segmentStations.indexOf(name)===index):route.available?[]:product.fromCandidates.concat(product.toCandidates);
 const available=!unavailable.length;
 return `<section class="tour-detail-page"><header class="tour-detail-head"><small>지역 테마여행 · ${esc(product.category)}</small><h2>${esc(product.name)}</h2><p>${esc(product.summary)}</p><div class="tour-hero-icon">${productIcon(product.icon)}${productIcon(product.id==='tour-sunrise'?'sun':'route')}</div></header><div class="tour-chips">${product.durations.map(d=>`<span>${esc(d.label)}</span>`).join('')}<span>자유여행</span><span>열차표 별도</span></div><section class="tour-info-card"><h3>여행 핵심 정보</h3><dl><div><dt>여행 지역</dt><dd>${product.attractions.slice(0,3).map(esc).join(' · ')}</dd></div><div><dt>대표 열차 검색 구간</dt><dd>${esc(product.routeLabel)}</dd></div><div><dt>출발 추천 시간대</dt><dd>${esc(product.outbound.start)}~${esc(product.outbound.end)} · 복귀 ${esc(returned.start)}~${esc(returned.end)}</dd></div><div><dt>여행 기간</dt><dd>${esc(duration)}</dd></div></dl></section><section class="tour-description-card"><h3>어떤 여행인가요?</h3><p>${esc(product.description)}</p><div class="tour-attractions">${product.attractions.map(place=>`<span>${esc(place)}</span>`).join('')}</div></section>${product.notes.map(note=>`<p class="tour-note">${esc(note)}</p>`).join('')}${available?'':`<div class="tour-unavailable" role="status"><b>현재 조회할 수 없는 구간이 있습니다</b><p>${unavailable.map(esc).join(', ')} 역이 열차 DB에 등록되면 일정을 조회할 수 있습니다.</p></div>`}<button class="primary tour-sticky-action" data-action="tour-plan" data-value="${product.id}" ${available?'':'disabled'}>추천 일정 확인하기 <span aria-hidden="true">→</span></button></section>`;
}

export function tourItineraryView({product,model,esc,date,durationId}){
 const route=resolveProductRoute(product,model),duration=tourDuration(product,durationId),schedule=product.schedules[duration.id],returned=product.returns[duration.id];
 const isLoop=Boolean(product.segments),maxDate=addDays(kstDate(),duration.days?30-duration.days:30);
 const from=route.from||product.fromCandidates[0],to=route.to||product.toCandidates[0];
 return `<section class="tour-plan-page"><header class="page-head"><small>${esc(product.name)}</small><h2>추천 여행 일정</h2><p>여행 취향과 열차 운행에 맞춰 조건을 바꿀 수 있어요.</p></header>${product.durations.length>1?`<div class="tour-duration-tabs" role="group" aria-label="여행 기간">${product.durations.map(d=>`<button data-action="tour-duration" data-value="${d.id}" aria-pressed="${duration.id===d.id}">${esc(d.label)} 여행</button>`).join('')}</div>`:''}<form id="tour-plan-form"><input type="hidden" name="durationId" value="${duration.id}"><section class="tour-plan-summary"><label>여행 날짜<input type="date" name="date" min="${kstDate()}" max="${maxDate}" value="${esc(date)}" required></label><div class="tour-route-fields"><label>${isLoop?'첫 출발역':'출발역'}<input name="from" list="tour-stations" value="${esc(from)}" required></label><span aria-hidden="true">→</span><label>${isLoop?'첫 여행지 인근역':'여행지 인근역'}<input name="to" list="tour-stations" value="${esc(to)}" required></label></div><datalist id="tour-stations">${model.stations.map(station=>`<option value="${esc(station)}"></option>`).join('')}</datalist></section><section class="tour-schedule"><h3>${isLoop?'구간별 일정':'하루 일정'}</h3>${schedule.map(item=>`<article><span class="tour-step-icon">${productIcon(item.kind||'route')}</span><div><b>${esc(item.title)}</b><p>${esc(item.description)}</p></div><time>${esc(item.time)}</time></article>`).join('')}</section><section class="tour-condition-card"><h3>열차 조회 조건</h3><div class="form-row"><label>인원<select name="pax">${[1,2,3,4,5,6].map(n=>`<option value="${n}">${n}명</option>`).join('')}</select></label><label>좌석 등급<select name="cls">${Object.entries(model.data.classes).map(([id,value])=>`<option value="${id}">${esc(value.label)}</option>`).join('')}</select></label></div>${isLoop?`<p class="tour-segment-summary">${product.segments.map((segment,index)=>`${index+1}. ${esc(segment.from)} → ${esc(segment.to)} · ${esc(segment.start)}~${esc(segment.end)}`).join('<br>')}</p><p>첫 구간은 위에서 수정하고, 다음 구간은 각 조회 화면의 조건 변경에서 조정할 수 있습니다.</p>`:`<div class="tour-window-grid"><label>가는 편 시작<input type="time" name="outStart" value="${product.outbound.start}" required></label><label>가는 편 종료<input type="time" name="outEnd" value="${product.outbound.end}" required></label><label>오는 편 시작<input type="time" name="returnStart" value="${returned.start}" required></label><label>오는 편 종료<input type="time" name="returnEnd" value="${returned.end}" required></label></div>`}<label class="tour-transfer-toggle"><span><b>직통·환승 함께 조회</b><small>실제 운행편이 있는 경로만 표시합니다.</small></span><input type="checkbox" name="includeTransfer" checked></label><p>추천 시간대는 검색 조건이며 열차 시각과 운임은 조회 결과에서 확인합니다.</p></section><button class="primary tour-sticky-action" type="submit">이 일정으로 열차 조회 <span aria-hidden="true">→</span></button></form></section>`;
}
