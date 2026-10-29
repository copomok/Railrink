import {createModel, kstDate, addDays, STORE_KEY} from './model.js';
const $ = s => document.querySelector(s);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
const icon = (name) => ({search:'⌕',ticket:'▤',travel:'◇',my:'○'}[name] || '→');
let model, q, results=[], draft=null, selectedCar=0, changing=null, lastTicket=null, visibleCount=12, dialogFocus=null, toastTimer;
const main=$('#main'), dialog=$('#dialog');
function notify(text) {$('#message').textContent=text;$('#message').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#message').hidden=true,4500);}
function fail(error) {notify(error.message || '작업을 완료하지 못했습니다. 다시 시도하세요.');}
function go(route) {if(location.hash===`#${route}`)render();else location.hash=route;}
const notice = '<p class="notice"><strong>게임 데이터 기반 시제품</strong> 실제 결제·발권은 이루어지지 않습니다. 요금·잔여석·지연은 NIMBY Rail의 추정값입니다.</p>';
const heading = (k,title,sub='') => `<div class="page-head"><span class="eyebrow">${k}</span><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>`;
const grade = t => `<span class="grade" style="--grade:${esc(model.data.colors[t.grade]||'#55616d')}">${esc(model.data.grades[t.grade]||t.grade)}</span><span class="train-no">${esc(t.no)}</span>`;
const routeSummary = (t,query) => {const s=model.segment(t,query.from,query.to);return `<div class="journey-line"><div><strong>${esc(s.dep)}</strong><span>${esc(query.from)}</span></div><div class="journey-mid"><small>${model.data.duration(s.dep,s.arr)}분</small><i></i><small>직통${s.arr<s.dep?' · 다음 날 도착':''}</small></div><div><strong>${esc(s.arr)}</strong><span>${esc(query.to)}</span></div></div>`;};
function queryForm() {
  return `<form id="search-form" class="search-card"><div class="stations"><label>출발역<input name="from" list="stations" value="${esc(q.from)}" required autocomplete="off" placeholder="역 이름"></label><button type="button" id="swap" class="swap" aria-label="출발역과 도착역 바꾸기">⇄</button><label>도착역<input name="to" list="stations" value="${esc(q.to)}" required autocomplete="off" placeholder="역 이름"></label></div><datalist id="stations">${model.stations.map(s=>`<option value="${esc(s)}"></option>`).join('')}</datalist><div class="form-row"><label>출발 날짜<input type="date" name="date" min="${kstDate()}" max="${addDays(kstDate(),30)}" value="${q.date}" required></label><label>승객<select name="pax">${Array.from({length:6},(_,i)=>`<option value="${i+1}" ${+q.pax===i+1?'selected':''}>${i+1}명</option>`).join('')}</select></label></div><div class="date-quick"><button type="button" data-date-offset="0">오늘</button><button type="button" data-date-offset="1">내일</button><button type="button" data-date-offset="weekend">이번 주말</button></div><fieldset class="class-field"><legend>좌석 등급</legend><div class="class-options">${Object.entries(model.data.classes).filter(([k])=>k!=='standing').map(([k,v])=>`<label class="class-option"><input type="radio" name="cls" value="${k}" ${q.cls===k?'checked':''}>${v.label}<small>${k==='general'?'기본 좌석':k==='special'?'지원 열차의 특실':'KTX-이음 우등실'}</small></label>`).join('')}</div></fieldset><button class="primary" type="submit">열차 조회 <span aria-hidden="true">→</span></button><p class="micro">한국 시간 기준 · 오늘부터 30일 이내 · 직통 열차 조회</p></form>`;
}
function searchPage() {
  main.innerHTML=heading('BOOK A JOURNEY',changing?'새 일정을 선택하세요':'어디로 떠나시나요?',changing?'새 예약을 저장할 때 기존 예약이 변경 처리됩니다.':'출발역부터 도착역까지, 나에게 맞는 열차를 찾아보세요.')+queryForm()+`<div class="quick-grid"><button data-action="nav" data-value="tickets"><b>내 승차권</b><span>일정과 탑승 안내 확인 →</span></button><button data-action="nav" data-value="travel"><b>여행을 계획하세요</b><span>관광열차와 자주 가는 구간 →</span></button></div>`+notice;
  $('#swap').onclick=()=>{const form=$('#search-form');const a=form.elements.from.value;form.elements.from.value=form.elements.to.value;form.elements.to.value=a;};
  document.querySelectorAll('[data-date-offset]').forEach(b=>b.onclick=()=>{const offset=b.dataset.dateOffset==='weekend'?(6-new Date(kstDate()+'T12:00:00+09:00').getUTCDay()+7)%7:+b.dataset.dateOffset;$('#search-form').elements.date.value=addDays(kstDate(),offset);});
  $('#search-form').onsubmit=e=>{e.preventDefault();try {q={...q,...Object.fromEntries(new FormData(e.target))};q.pax=+q.pax;model.validateQuery(q);visibleCount=12;go('results');}catch(error){fail(error);}};
}
function resultPage() {
  results=model.search(q);
  main.innerHTML=heading('FIND YOUR TRAIN','열차 조회',`${esc(q.from)} → ${esc(q.to)} · ${esc(q.date)} · ${q.pax}명`)+`<button class="text-button" data-action="nav" data-value="search">← 검색 조건 변경</button><div class="filters"><label>열차 종류<select id="grade-filter"><option value="all">전체 열차</option>${[...new Set(model.trains.map(t=>t.grade))].map(g=>`<option ${q.grade===g?'selected':''}>${esc(g)}</option>`).join('')}</select></label><label>정렬<select id="sort"><option value="departure" ${q.sort==='departure'?'selected':''}>출발 시간순</option><option value="duration" ${q.sort==='duration'?'selected':''}>소요 시간순</option><option value="fare" ${q.sort==='fare'?'selected':''}>추정 요금순</option></select></label><label>출발 시간 이후<input id="after" type="time" value="${q.after||''}"></label></div><div class="result-heading"><b>${results.length}편의 열차</b><span>${model.data.classes[q.cls].label} · 잔여석은 모형 추정</span></div><div id="results-list"></div><div id="more"></div>`+notice;
  $('#grade-filter').onchange=e=>{q.grade=e.target.value;visibleCount=12;render();};$('#sort').onchange=e=>{q.sort=e.target.value;render();};$('#after').onchange=e=>{q.after=e.target.value;render();};
  if(!results.length) {$('#results-list').innerHTML='<div class="empty"><span>⌕</span><h3>조건에 맞는 직통 열차가 없습니다</h3><p>역·날짜·등급·시간 조건을 바꿔보세요.<br>환승 경로는 NIMBY Rail 철도 정보에서 확인할 수 있습니다.</p><button data-action="nav" data-value="search">검색 다시 하기</button></div>';return;}
  $('#results-list').innerHTML=results.slice(0,visibleCount).map((r,i)=>{
    let state;try{state=model.availability(r.train,q);}catch {state=null;}
    const available=state?.eligible&&state.available>=+q.pax;
    return `<article class="train-card"><div class="card-top"><div>${grade(r.train)}</div><button class="text-button" data-action="detail" data-index="${i}">정차역·시설 <span aria-hidden="true">↗</span></button></div>${routeSummary(r.train,q)}<div class="card-bottom"><div><strong>${won(r.fare)}</strong><small>1인 추정 요금</small></div><div class="book-action"><span class="status ${available?'':'unavailable'}">${r.departed?'출발한 열차':!state?'재고 조회 오류':!state.eligible?'선택 등급 미제공':available?`추정 ${state.available}석`:`${state.available?'인원 대비 좌석 부족':'모형상 매진'}`}</span><button ${r.departed||!state?'disabled':''} class="${available?'primary small':'secondary small'}" data-action="${available?'book':'watch'}" data-index="${i}">${r.departed?'출발 완료':available?'좌석 선택':'대기 기록'}</button></div></div></article>`;
  }).join('');
  if(results.length>visibleCount) $('#more').innerHTML=`<button class="load-more" data-action="more">열차 더 보기 (${Math.min(visibleCount,results.length)} / ${results.length})</button>`;
}
function startBooking(index) {
  const r=results[index];if(!r||r.departed)return;
  draft={key:r.key,q:{...q},seats:[],names:Array(+q.pax).fill(''),discount:'none'};selectedCar=0;go('seats');
}
function seatsPage() {
  if(!draft){go('search');return;}
  const t=model.byKey.get(draft.key),cars=model.seats(t,draft.q),car=cars[selectedCar]||cars[0];
  if(!car)throw new Error('선택한 좌석 등급의 객실이 없습니다. 검색 조건을 바꿔주세요.');
  main.innerHTML=heading('01 / 03 · SEATS','함께 앉을 자리를 골라보세요',`${esc(draft.q.date)} · ${draft.q.pax}명 · ${model.data.classes[draft.q.cls].label}`)+`<button class="text-button" data-action="nav" data-value="results">← 열차 목록</button><div class="panel">${grade(t)}${routeSummary(t,draft.q)}</div><div class="car-tabs" aria-label="호차 선택">${cars.map((c,i)=>`<button data-action="car" data-index="${i}" aria-pressed="${c.car===car.car}">${c.car}호차<small>${c.seats.filter(s=>!s.blocked).length}석</small></button>`).join('')}</div><div class="seat-legend"><span>□ 선택 가능</span><span>■ 선택됨</span><span>× 모형상 사용 중</span></div><div class="seat-shell"><div class="car-heading"><strong>${car.car}호차 · ${esc(car.label)}</strong><button class="text-button" data-action="draft-detail">차내 시설 ↗</button></div><p class="micro">${car.revRows?'일부 역방향 좌석 · 좌석별 방향 확인':'순방향 좌석'} · 실제 좌석 확보 아님</p><div class="seat-grid" style="--columns:${car.cols.length}">${Array.from({length:car.rows},(_,r)=>r+1).map(row=>`<div class="seat-row">${car.cols.map((col,i)=>{const seat=car.seats.find(s=>s.row===row&&s.col===col);return `${i===2?'<span class="aisle" aria-hidden="true"></span>':''}${seat?`<button class="seat" data-action="seat" data-value="${esc(seat.id)}" aria-label="${esc(seat.id)} ${seat.reverse?'역방향':'순방향'}${seat.blocked?' 사용 중':''}" aria-pressed="${draft.seats.includes(seat.id)}" ${seat.blocked?'disabled':''}>${seat.blocked?'×':esc(car.numbered?seat.id.split(' ')[1]:row+col)}<small>${seat.reverse?'↓':'↑'}</small></button>`:'<span class="no-seat"></span>'}`;}).join('')}</div>`).join('')}</div><p class="micro">시설 공간과 누락 좌석은 원본 편성 정보를 따릅니다.</p></div><div class="selection-bar"><div><strong id="selected-count"></strong><small id="selected-labels"></small></div><button id="next-passengers" class="primary small" data-action="nav" data-value="passengers">승객 정보 →</button></div>`;
  updateSelected();
}
function updateSelected() {$('#selected-count').textContent=`${draft.seats.length} / ${draft.q.pax}석 선택`;$('#selected-labels').textContent=draft.seats.join(', ')||'좌석을 선택하세요';$('#next-passengers').disabled=draft.seats.length!==+draft.q.pax;document.querySelectorAll('.seat[data-value]').forEach(b=>b.setAttribute('aria-pressed',String(draft.seats.includes(b.dataset.value))));}
function passengerPage() {
  if(!draft||draft.seats.length!==+draft.q.pax){go('seats');return;}
  main.innerHTML=heading('02 / 03 · PASSENGERS','승객 정보를 확인하세요','실명·연락처·결제 정보는 입력하지 마세요.')+`<form id="passenger-form" class="panel">${draft.names.map((n,i)=>`<label>승객 ${i+1} 별칭<input name="name${i}" value="${esc(n)}" maxlength="30" placeholder="예: 여행자 ${i+1}" required autocomplete="off"></label>`).join('')}<label>시제품 할인 유형<select name="discount">${Object.entries(model.data.discounts).map(([k,d])=>`<option value="${k}" ${draft.discount===k?'selected':''}>${esc(d.label)}${d.rate?` · ${d.rate*100}%`:''}${d.note?` (${d.note})`:''}</option>`).join('')}</select></label><p class="micro">선택한 할인은 모든 승객에게 동일하게 적용됩니다. 실제 자격 확인·할인 상품 연동은 제공하지 않습니다.</p><div class="button-row"><button type="button" data-action="nav" data-value="seats">← 좌석 선택</button><button class="primary" type="submit">예약 내용 확인 →</button></div></form>`+notice;
  $('#passenger-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);draft.names=draft.names.map((_,i)=>String(f.get('name'+i)).trim());draft.discount=f.get('discount');go('review');};
}
function reviewPage() {
  if(!draft||draft.names.some(n=>!n)){go('passengers');return;}
  const old=changing?model.read().tickets.find(t=>t.id===changing):null;
  const t=model.byKey.get(draft.key),base=model.data.fare(t,draft.q.from,draft.q.to,draft.q.cls),per=model.data.discount(base,draft.discount);
  main.innerHTML=heading('03 / 03 · REVIEW',old?'변경 내용을 확인해 주세요':'마지막으로 확인해 주세요','저장된 예약은 이 브라우저에서만 확인할 수 있습니다.')+`${old?`<div class="panel comparison-old"><div class="compare-label">기존 시제품 승차권</div><b>${esc(old.grade)} ${esc(old.trainNo)} · ${esc(old.travelDate)}</b><p>${esc(old.fromStn)} ${old.dep} → ${esc(old.toStn)} ${old.arr}</p><p>${old.seats.map(esc).join(' · ')}</p></div><div class="compare-arrow" aria-hidden="true">↓</div>`:''}<div class="panel">${old?'<div class="compare-label">변경할 시제품 승차권</div>':''}${grade(t)}${routeSummary(t,draft.q)}<dl class="summary"><div><dt>출발일</dt><dd>${draft.q.date}</dd></div><div><dt>좌석</dt><dd>${draft.seats.map(esc).join('<br>')}</dd></div><div><dt>승객</dt><dd>${draft.names.map(esc).join(', ')}</dd></div><div><dt>할인</dt><dd>${model.data.discounts[draft.discount].label}</dd></div><div><dt>할인 전 추정 요금</dt><dd>${won(base*+draft.q.pax)}</dd></div>${old?`<div><dt>기존 추정 금액</dt><dd>${won(old.totalFare)}</dd></div><div><dt>가상 요금 차액</dt><dd>${won(per*+draft.q.pax-old.totalFare)}</dd></div>`:''}<div class="total"><dt>최종 추정 금액</dt><dd>${won(per*+draft.q.pax)}</dd></div></dl></div>${notice}<form id="confirm-form" class="panel"><label class="check"><input type="checkbox" required>실제 결제·발권이 아닌 시제품 예약임을 확인했습니다.</label><div class="button-row"><button type="button" data-action="nav" data-value="passengers">← 승객 정보</button><button class="primary" type="submit">${changing?'변경 예약':'시제품 예약'} 저장</button></div></form>`;
  $('#confirm-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('[type="submit"]');b.disabled=true;try{const commit=()=>model.book(draft,changing);lastTicket=await (navigator.locks?navigator.locks.request('raillink-booking',commit):commit());draft=null;changing=null;go('complete');}catch(error){fail(error);b.disabled=false;}};
}
function completePage() {
  if(!lastTicket){go('tickets');return;}
  main.innerHTML=heading('JOURNEY SAVED','여행 준비를 마쳤어요','시제품 예약이 이 브라우저에 저장되었습니다.')+`<div class="success-mark" aria-hidden="true">✓</div><div class="panel"><strong>${esc(lastTicket.fromStn)} → ${esc(lastTicket.toStn)}</strong><p>${lastTicket.travelDate} · ${lastTicket.dep} 출발</p><p>${lastTicket.seats.map(esc).join(', ')}</p><p class="notice">결제된 금액은 0원입니다.<br>이 예약은 실제 열차에 사용할 수 없습니다.</p><button class="primary" data-action="nav" data-value="tickets">내 승차권 확인 →</button></div>`;
}
function ticketsPage() {
  const state=model.read(),tickets=[...state.tickets].reverse();
  main.innerHTML=heading('MY JOURNEYS','내 승차권','승차권과 일정, 탑승 정보를 한곳에서 확인하세요.')+`<div class="segmented" aria-label="승차권 필터"><button data-ticket-filter="active" aria-pressed="true">이용 예정</button><button data-ticket-filter="history" aria-pressed="false">지난 일정</button><button data-ticket-filter="cancelled" aria-pressed="false">취소·변경</button></div><div id="ticket-list"></div>`+notice;
  const list=filter=>{
    document.querySelectorAll('[data-ticket-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ticketFilter===filter)));
    const items=tickets.filter(t=>filter==='cancelled'?t.status!=='active':t.status==='active'&&(new Date(t.departure)>new Date())===(filter==='active'));
    $('#ticket-list').innerHTML=items.length?items.map(t=>{const train=model.byKey.get(t.key),active=t.status==='active'&&new Date(t.departure)>new Date();return `<article class="ticket-card"><div class="card-top"><span class="ticket-stamp">시제품 승차권 · 탑승 불가</span><b>${t.status==='cancelled'?'취소됨':t.status==='changed'?'일정 변경됨':active?'이용 예정':'지난 일정'}</b></div><h3>${esc(t.fromStn)} <span aria-hidden="true">→</span> ${esc(t.toStn)}</h3><p>${esc(t.travelDate)} · ${esc(t.dep)} 출발 — ${esc(t.arr)} 도착</p><div>${train?grade(train):esc(t.grade)+' '+esc(t.trainNo)}</div><div class="ticket-seats">${t.seats.map(esc).join(' · ')}</div><div class="ticket-footer"><span>${t.passengerCount}명 · 추정 ${won(t.totalFare)}</span><small>${esc(t.id.slice(0,11))}</small></div>${t.status==='cancelled'?`<p class="micro">가상 환불 ${won(t.refund)} · 실제 금전 거래 없음</p>`:''}<div class="button-row"><button data-action="ticket-detail" data-value="${t.id}" ${!train?'disabled':''}>시간표·탑승 안내</button>${active?`<button data-action="change" data-value="${t.id}">일정 변경</button><button class="danger" data-action="cancel" data-value="${t.id}">취소</button>`:''}</div></article>`;}).join(''):'<div class="empty"><span>▤</span><h3>이곳에 표시할 승차권이 없습니다</h3><p>열차를 조회하고 나만의 여행을 준비해 보세요.</p><button class="primary small" data-action="nav" data-value="search">열차 예매</button></div>';
  };
  list('active');document.querySelectorAll('[data-ticket-filter]').forEach(b=>b.onclick=()=>list(b.dataset.ticketFilter));
}
function showDialog(title,body) {dialogFocus=document.activeElement;dialog.innerHTML=`<header class="dialog-head"><h2 id="dialog-title">${title}</h2><button id="close-dialog" aria-label="닫기">×</button></header><div class="dialog-body">${body}</div>`;$('#close-dialog').onclick=()=>dialog.close();dialog.showModal();}
dialog.addEventListener('close',()=>dialogFocus?.isConnected&&dialogFocus.focus());
function details(t,query,ticket=null) {
  const seg=model.segment(t,query.from,query.to);if(!seg)throw new Error('현재 시간표에서 예약 구간을 찾을 수 없습니다.');
  const forecast=model.data.forecast(t.line,t.grade),cars=model.data.cars(model.data.formation(t.grade,t.no)),plat=model.data.platform(t.no,query.from);
  const dep=model.departure(seg,query.date),arr=new Date(dep.getTime()+model.data.duration(seg.dep,seg.arr)*60000),now=new Date();
  const status=now<dep?'출발 예정':now>arr?'선택 구간 운행 종료':'선택 구간 운행 시간';
  showDialog(`${esc(t.grade)} ${esc(t.no)} · 열차 안내`,`${grade(t)}${routeSummary(t,query)}<div class="info-box"><b>${status} · 시간표 기준</b><p>지연 가능성 ${forecast.label} (${forecast.prob}%) · 지연 발생 시 모형 범위 ${forecast.min}–${forecast.max}분</p><small>실시간 위치·운행 장애 정보는 제공되지 않습니다. NIMBY Rail의 공통 지연 예측 모형입니다.</small></div><h3>승차 안내</h3><div class="boarding"><span>${esc(query.from)}역</span><strong>${plat!=null?`${esc(plat)}번 승강장`:'승강장 정보 없음'}</strong><p>${ticket?ticket.seats.map(esc).join(' · '):'좌석 선택 후 내 승차권에서 호차를 확인하세요.'}</p><small>게임 DB 기준입니다. 역 내부 지도·출입구 동선·정확한 탑승 위치 데이터는 제공되지 않습니다.</small></div><h3>정차역과 시간표</h3><ol class="stops">${seg.stops.map((s,i)=>`<li class="${i>=seg.fi&&i<=seg.ti?'selected':''}"><span>${esc(s.s)} ${i===seg.fi?'<b>승차</b>':i===seg.ti?'<b>하차</b>':''}</span><span>${esc(s.arr||'—')} <small>도착</small> / ${esc(s.dep||'—')} <small>출발</small></span></li>`).join('')}</ol><h3>내 열차의 차내 시설</h3><div class="facility-list">${cars.map(c=>`<div><b>${c.car}호차 · ${esc(c.label)}</b><p>${(c.tags||[]).map(esc).join(' · ')||''}</p>${c.facilities?`<p>앞쪽: ${c.facilities.start.map(f=>esc(f.label)).join(' · ')||'등록 시설 없음'}</p><p>뒤쪽: ${c.facilities.end.map(f=>esc(f.label)).join(' · ')||'등록 시설 없음'}</p>`:`<p>${c.cafe?'카페객차':'세부 시설 위치 미등록'}</p>`}${c.notice?`<small>${esc(c.notice)}</small>`:''}</div>`).join('')}</div><button class="primary" id="alternatives">같은 구간의 다른 열차 조회</button>`);
  $('#alternatives').onclick=()=>{q={...query,grade:'all',sort:'departure',after:''};dialog.close();go('results');};
}
function travelPage() {
  const state=model.read(),tourist=model.trains.filter(t=>['남도해양','국악와인'].includes(t.grade));
  const unique=[...new Map(tourist.map(t=>[t.grade+'|'+t.stops[0].s+'|'+t.dest,t])).values()];
  main.innerHTML=heading('TAKE THE SCENIC ROUTE','조금 다른 여행','공통 시간표에 등록된 관광열차를 만나보세요.')+`<div class="travel-list">${unique.length?unique.map(t=>{const stops=model.data.stops(t);return `<article class="panel">${grade(t)}<h3>${esc(stops[0].s)} → ${esc(stops.at(-1).s)}</h3><p>${esc(t.line)} · ${stops.length}개 정차역</p><button data-action="tour" data-value="${esc(model.key(t))}">이 구간 조회 →</button></article>`;}).join(''):'<p class="empty">등록된 관광열차가 없습니다.</p>'}</div><h3>자주 가는 구간</h3><p class="muted">자주 이용하는 구간을 저장해 빠르게 조회하세요. 철도 패스 판매·사용 권한은 제공하지 않습니다.</p><div class="panel"><form id="route-form"><div class="form-row"><label>출발역<input name="from" list="travel-stations" required></label><label>도착역<input name="to" list="travel-stations" required></label></div><datalist id="travel-stations">${model.stations.map(s=>`<option value="${esc(s)}"></option>`).join('')}</datalist><button type="submit">구간 저장 ＋</button></form></div><div>${state.routes.map((r,i)=>`<div class="saved-route"><button data-action="saved-route" data-index="${i}">${esc(r.from)} → ${esc(r.to)} <span>조회 →</span></button><button data-action="remove-route" data-index="${i}" aria-label="${esc(r.from)} ${esc(r.to)} 구간 삭제">×</button></div>`).join('')}</div>`+notice;
  $('#route-form').onsubmit=e=>{e.preventDefault();try{const r=Object.fromEntries(new FormData(e.target));model.validateQuery({...q,...r,date:kstDate()});const current=model.read();if(!current.routes.some(x=>x.from===r.from&&x.to===r.to))current.routes.push(r);model.save(current);render();notify('구간을 저장했습니다.');}catch(error){fail(error);}};
}
function myPage() {
  const state=model.read();
  main.innerHTML=heading('YOUR RAILLINK','마이 레일링크','나의 여행 기록은 이 브라우저에만 저장됩니다.')+`<div class="panel profile"><span class="avatar" aria-hidden="true">○</span><div><h3>로컬 여행자</h3><p>계정·서버 동기화 없음</p></div></div><h3>좌석 대기 기록</h3><p class="muted">자동 예약이나 알림 전송 없이, 앱을 열었을 때 모형 잔여석을 다시 확인합니다.</p>${state.watches.length?state.watches.map(w=>{const t=model.byKey.get(w.key);let text='열차 정보 없음';if(t){try{const seg=model.segment(t,w.q.from,w.q.to);text=model.departure(seg,w.q.date)<=new Date()?'출발한 열차':model.availability(t,w.q).available>=+w.q.pax?'모형상 좌석 선택 가능':'아직 대기 중';}catch{text='조회할 수 없음';}}return `<div class="panel"><b>${esc(w.q.from)} → ${esc(w.q.to)}</b><p>${esc(w.q.date)} · ${esc(t?.no||'')} · ${text}</p><div class="button-row"><button data-action="watch-search" data-value="${w.id}">다시 조회</button><button data-action="remove-watch" data-value="${w.id}">기록 삭제</button></div></div>`;}).join(''):'<div class="panel muted">등록된 대기 기록이 없습니다.</div>'}<div class="panel"><label class="check"><input id="notifications" type="checkbox" ${state.notifications?'checked':''}>앱 안에서 여행 안내 표시</label><p class="micro">푸시 알림은 보내지 않습니다.</p>${state.notifications?'<p>출발 전 승강장과 내 호차를 확인하세요. 시제품 승차권은 실제 탑승에 사용할 수 없습니다.</p>':''}</div><div class="panel"><h3>예약 데이터 관리</h3><p>저장 공간 삭제 시 예약·대기·구간 기록이 사라집니다.</p><div class="button-row"><button data-action="export">내 데이터 내보내기</button><button class="danger" data-action="reset">초기화</button></div></div>`;
  $('#notifications').onchange=e=>{const s=model.read();s.notifications=e.target.checked;model.save(s);render();};
}
function confirmCancel(id) {const t=model.read().tickets.find(t=>t.id===id);if(!t)return;showDialog('시제품 예약을 취소할까요?',`<p>${esc(t.fromStn)} → ${esc(t.toStn)} · ${esc(t.travelDate)}</p><p>가상 환불 금액: <b>${won(t.totalFare)}</b></p><p class="muted">실제 결제·환불은 발생하지 않습니다. 이 예약은 취소 내역으로 보관됩니다.</p><button class="danger" id="confirm-cancel">예약 취소 확인</button>`);$('#confirm-cancel').onclick=()=>{try{model.cancel(id);dialog.close();render();notify('시제품 예약을 취소했습니다.');}catch(error){fail(error);}};}
function render() {
  const route=location.hash.slice(1)||'search';
  document.querySelectorAll('[data-nav]').forEach(a=>{const current=a.dataset.nav===(['results','seats','passengers','review','complete'].includes(route)?'search':route);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  try {({search:searchPage,results:resultPage,seats:seatsPage,passengers:passengerPage,review:reviewPage,complete:completePage,tickets:ticketsPage,travel:travelPage,my:myPage}[route]||searchPage)();document.title=`${main.querySelector('h2')?.textContent||'레일링크'} · RailLink`;}
  catch(error){main.innerHTML=heading('PLEASE TRY AGAIN','화면을 불러오지 못했습니다')+`<div class="empty"><p>${esc(error.message)}</p><button data-action="nav" data-value="search">검색으로 돌아가기</button><button data-action="export">저장 데이터 내보내기</button></div>`;}
}
main.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
  const {action,value,index}=b.dataset;
  try {
    if(action==='nav'){if(value==='search')changing=null;go(value);}
    if(action==='detail')details(results[index].train,q);
    if(action==='draft-detail')details(model.byKey.get(draft.key),draft.q);
    if(action==='book')startBooking(+index);
    if(action==='watch'){model.watch(results[index].key,q);notify('대기 기록을 저장했습니다. 마이에서 확인하세요.');}
    if(action==='more'){visibleCount+=12;resultPage();}
    if(action==='car'){selectedCar=+index;seatsPage();}
    if(action==='seat'){const i=draft.seats.indexOf(value);if(i>=0)draft.seats.splice(i,1);else if(draft.seats.length<+draft.q.pax)draft.seats.push(value);else notify(`${draft.q.pax}명에 맞게 좌석을 선택하세요.`);updateSelected();}
    if(action==='ticket-detail'){const t=model.read().tickets.find(t=>t.id===value);details(model.byKey.get(t.key),{from:t.fromStn,to:t.toStn,date:t.travelDate,pax:t.passengerCount,cls:t.seatClass},t);}
    if(action==='cancel')confirmCancel(value);
    if(action==='change'){const t=model.read().tickets.find(t=>t.id===value);changing=t.id;q={...q,from:t.fromStn,to:t.toStn,date:t.travelDate,pax:t.passengerCount,cls:t.seatClass,after:'',grade:'all'};go('search');}
    if(action==='tour'){const t=model.byKey.get(value),s=model.data.stops(t);q={...q,from:s[0].s,to:s.at(-1).s,date:kstDate(),grade:t.grade,after:'',cls:'general'};go('results');}
    if(action==='saved-route'){q={...q,...model.read().routes[index],date:kstDate(),grade:'all',after:''};go('results');}
    if(action==='remove-route'){const s=model.read();s.routes.splice(+index,1);model.save(s);render();}
    if(action==='watch-search'){q={...model.read().watches.find(w=>w.id===value).q};if(q.date<kstDate())q.date=kstDate();go('results');}
    if(action==='remove-watch'){const s=model.read();s.watches=s.watches.filter(w=>w.id!==value);model.save(s);render();}
    if(action==='export'){const blob=new Blob([localStorage.getItem(STORE_KEY)||'{}'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='raillink-reservations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(action==='reset'){showDialog('이 브라우저의 기록을 삭제할까요?','<p>예약·대기·저장 구간 기록을 삭제합니다. 필요하면 먼저 내보내기를 이용하세요.</p><button class="danger" id="confirm-reset">내 기록 모두 삭제</button>');$('#confirm-reset').onclick=()=>{localStorage.removeItem(STORE_KEY);model.data.invalidate();dialog.close();render();};}
  } catch(error){fail(error);}
});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);main.focus({preventScroll:true});});
window.addEventListener('storage',e=>{if(e.key===STORE_KEY){model.data.invalidate();notify('다른 탭에서 예약 정보가 변경되었습니다.');if(!draft)render();}});
try {
  if(!window.RailData) throw new Error('공통 철도 데이터 연결을 확인하세요.');
  model=createModel(window.RailData,localStorage);
  window.loadTickets=()=>model.read().tickets.map(t=>({...t,travelDate:t.serviceDate||t.travelDate}));
  q={from:'',to:'',date:kstDate(),pax:1,cls:'general',grade:'all',sort:'departure',after:''};
  render();
} catch(error){main.innerHTML=heading('CONNECTION REQUIRED','데이터 연결을 확인해 주세요')+`<p>${esc(error.message)}</p><button onclick="location.reload()">다시 시도</button>`;}
