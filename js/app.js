import {previewPass,travelBoard} from './travel-tools.js';
import {openOperation} from './operations.js';
import {ticketsView,ticketsCSV} from './tickets.js';
import {ticketQR} from './ticket-qr.js';
import {observeInventory,inventoryLabel} from './inventory-queue.js';
import {displayClock,minuteOf,dateAt,clockAt} from './railway-time.js';
import {homeView} from './home.js';
import {journeyState, upcomingJourneys, matchesStation} from './journey.js';
import {createModel, kstDate, addDays, STORE_KEY} from './model.js';
const $ = s => document.querySelector(s);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
const paths={home:'m3 10 9-8 9 8v11h-6v-7H9v7H3Z',more:'M4 12h.01M12 12h.01M20 12h.01',bell:'M5 17h14l-2-4V8a5 5 0 0 0-10 0v5Zm5 3h4',clipboard:'M8 4H4v18h16V4h-4M8 2h8v4H8Z M8 11h8M8 15h6',bag:'M4 8h16l1 13H3ZM8 8V6a4 4 0 0 1 8 0v2',back:'m14 5-7 7 7 7',down:'m6 9 6 6 6-6',next:'m9 5 7 7-7 7',calendar:'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Zm-2 5h18M7 2v5m10-5v5',user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9v-2a8 6 0 0 1 16 0v2Z',swap:'M8 3v17m-4-4 4 4 4-4M16 21V4m-4 4 4-4 4 4',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l4 3',search:'M6 3h12v14H6Zm0 6h12M9 20l-2 2m8-2 2 2M9 14h.01M15 14h.01M9 3V1h6v2',ticket:'M3 5h18v4a3 3 0 0 0 0 6v4H3v-4a3 3 0 0 0 0-6ZM8 5v14',travel:'M3 7h18v14H3ZM8 7V3h8v4M7 7v14m10-14v14',seat:'M7 3h8v9h4v7H7ZM4 9v12h16',card:'M2 5h20v14H2Zm0 5h20',check:'m5 12 5 5L20 6',round:'M20 8a9 9 0 0 0-15-3L2 8m0-5v5h5M4 16a9 9 0 0 0 15 3l3-3m0 5v-5h-5',pin:'M12 22S4 13 4 9a8 8 0 1 1 16 0c0 4-8 13-8 13ZM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.user}"/></svg>`;
const dateLabel=(date,year=false)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',...(year?{year:'numeric'}:{})}).format(new Date(date+'T12:00:00+09:00'));
const clock=displayClock;
const duration=n=>`${Math.floor(n/60)?Math.floor(n/60)+'시간 ':''}${n%60? n%60+'분':''}`;
let homeTab='booking',transferResults=[],disposeInventory=()=>{},journeyDrafts=[],journeyIndex=0,bookingType='single',selectingReturn=false,bookingQuery=null,lastTickets=[];
let roundTrip=false,returnDate='',returnJourney=null;
const recentKey='raillink.recent';
function recent(){try{return JSON.parse(localStorage.getItem(recentKey)||'[]').filter(r=>model.stations.includes(r.from)&&model.stations.includes(r.to)).slice(0,5);}catch{return [];}}
function saveRecent(){try{localStorage.setItem(recentKey,JSON.stringify([{from:q.from,to:q.to},...recent().filter(r=>r.from!==q.from||r.to!==q.to)].slice(0,5)));}catch{}}
function shell(route){
 document.body.dataset.screen=route;
 const titles={results:'열차 조회',seats:'좌석 선택',passengers:'승객 정보',review:'예약 정보 확인',complete:'예약 완료',tickets:'내 승차권',travel:'기차 여행',my:'마이 레일링크',passes:'정기 일정',board:'내 여행 일정'};
 const prev={results:'search',seats:'results',passengers:'seats',review:'passengers',complete:'tickets'};
 const brand=`<a href="#home" class="brand"><svg viewBox="0 0 60 36" aria-hidden="true"><path d="M2 30 22 8Q26 4 32 4h25l-8 7H32L15 30Z" fill="#159ee1"/><path d="m21 30 13-15h17l-7 7h-7l-7 8Z" fill="#1d6feb"/></svg><b>레일링크 <em>TICKET</em></b></a>`;
 $('.top').innerHTML=['home','search'].includes(route)?`${brand}<button id="home-notifications" class="header-icon" aria-label="여행 알림">${icon('bell')}</button>`:`<a href="#${prev[route]||'search'}" class="header-icon" aria-label="뒤로">${icon('back')}</a><h1>${titles[route]||'레일링크'}</h1><button class="header-icon" id="help" aria-label="이용 안내">?</button>`;
 if($('#help'))$('#help').onclick=()=>showDialog('레일링크 이용 안내','<p>NIMBY Rail 게임 데이터로 이용하는 예매 시제품입니다. 요금과 좌석은 추정값이며 실제 결제·발권은 하지 않습니다.</p><p>예약은 이 브라우저에 저장됩니다.</p><a href="/NIMBYRAILTABLE/">NIMBY Rail 철도 정보 ↗</a>');
 const navItems=[['home','home','홈'],['search','ticket','예매'],['tickets','card','승차권'],['travel','bag','여행'],['my','more','더보기']];
 $('.navigation').innerHTML=navItems.map(([route,i,label])=>`<a href="#${route}" data-nav="${route}">${icon(i)}<span>${label}</span></a>`).join('');
 if($('#home-notifications'))$('#home-notifications').onclick=()=>{
   const next=upcomingJourneys(model.read().tickets)[0];
   showDialog('여행 알림',next?`<p>${esc(next.ticket.fromStn)} → ${esc(next.ticket.toStn)} · ${next.state.label}</p><p>${dateLabel(next.ticket.travelDate)} ${esc(next.ticket.dep)} 출발 예정</p><p>시간표 기준 안내입니다. 실시간 지연·푸시 알림은 제공하지 않습니다.</p>`:'<p>현재 예정된 여행 알림이 없습니다.</p><p>예약한 여정이 생기면 이곳에서 확인할 수 있습니다.</p>');
 }
}
let model, q, results=[], draft=null, selectedCar=0, changing=null, lastTicket=null, visibleCount=12, dialogFocus=null, toastTimer;
const main=$('#main'), dialog=$('#dialog');
function notify(text) {$('#message').textContent=text;$('#message').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#message').hidden=true,4500);}
function fail(error) {notify(error.message || '작업을 완료하지 못했습니다. 다시 시도하세요.');}
function go(route) {if(location.hash===`#${route}`)render();else location.hash=route;}
const notice = '<p class="notice">ⓘ 게임 데이터 기반 시제품 · 실제 결제·발권 없음</p>';
const heading = (k,title,sub='') => `<div class="page-head"><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>`;
const grade=t=>`<span class="grade-name" style="--grade:${esc(model.data.colors[t.grade]||'#2266db')}">${esc(model.data.grades[t.grade]||t.grade)}</span> <b class="train-no">${esc(t.no)}</b>`;
const routeSummary=(t,query)=>{const seg=model.segment(t,query.from,query.to),mins=model.data.duration(seg.dep,seg.arr);return `<div class="journey-line"><div><strong>${clock(seg.dep)}</strong><span>${esc(query.from)}</span></div><div class="journey-mid"><i></i><small>${duration(mins)}${minuteOf(seg.arr)<minuteOf(seg.dep)?' · 익일':''}</small></div><div><strong>${clock(seg.arr)}</strong><span>${esc(query.to)}</span></div></div>`;};
function queryForm(){return `<form id="search-form" class="search-card"><div class="home-fields"><div class="stations"><button type="button" class="station-control" data-station="from"><span><small>출발역</small><b>${esc(q.from)||'출발역 선택'}</b></span></button><button type="button" id="swap" class="swap" aria-label="출발역과 도착역 바꾸기">${icon('swap')}</button><button type="button" class="station-control" data-station="to"><span><small>도착역</small><b>${esc(q.to)||'도착역 선택'}</b></span></button></div><button type="button" class="date-control" id="open-date"><span><small>가는 날</small><b>${dateLabel(q.date,true)}${q.after?' '+esc(q.after):''}</b></span>${icon('calendar')}</button><button type="button" id="open-passengers" class="passenger-control"><span><small>인원</small><b>승객 ${q.pax}명 <em>· ${model.data.classes[q.cls].label}</em></b></span>${icon('user')}</button></div><button class="primary search-submit" type="submit">${changing?'변경할 열차 조회':'열차 조회하기'} <span aria-hidden="true">→</span></button></form>`;}
function searchOptions(){return `<details class="home-options" ${roundTrip||q.transfer?'open':''}><summary>왕복 · 환승 검색 옵션</summary><div class="trip-controls"><button type="button" id="roundtrip" role="switch" aria-checked="${roundTrip}">${icon('round')}<b>왕복</b><i class="toggle"></i></button><button type="button" id="direct-info" role="switch" aria-checked="${!!q.transfer}">${icon('swap')}<b>환승 포함</b><i class="toggle"></i></button></div>${q.transfer?`<div class="form-row"><label>최소 대기(분)<input id="min-wait" type="number" min="3" max="180" value="${q.minWait||3}"></label><label>최대 대기(분)<input id="max-wait" type="number" min="3" max="180" value="${q.maxWait||60}"></label><label>환승 결과 수<input id="transfer-limit" type="number" min="1" max="20" value="${q.transferLimit||5}"></label></div>`:''}${roundTrip?`<button type="button" id="return-date" class="return-date">오는 날 ${dateLabel(returnDate)} ${icon('down')}</button>`:''}</details>`;}
function datePicker(returning=false){
 showDialog(returning?'오는 날 선택':'출발일 선택',`<form id="date-form"><label>날짜<input type="date" name="date" min="${returning?q.date:kstDate()}" max="${addDays(kstDate(),30)}" value="${returning?returnDate:q.date}" required></label>${returning?'':`<label>출발 기준 시각<input type="time" name="after" value="${esc(q.after)}"></label>`}<div class="date-quick"><button type="button" data-day="0">오늘</button><button type="button" data-day="1">내일</button><button type="button" data-day="${(6-new Date(kstDate()+'T12:00:00').getDay()+7)%7}">주말</button></div><button type="submit" class="primary">선택 완료</button></form>`);
 dialog.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>$('#date-form').elements.date.value=addDays(kstDate(),+b.dataset.day));
 $('#date-form').onsubmit=e=>{e.preventDefault();const d=e.target.elements.date.value;if(returning)returnDate=d;else {q.date=d;q.after=e.target.elements.after.value;if(returnDate<d)returnDate=d;}dialog.close();searchPage();$(returning?'#return-date':'#open-date').focus({preventScroll:true});};
}
function stationPicker(which){
 showDialog(which==='from'?'출발역 선택':'도착역 선택',`<label class="station-search">역 이름 · 초성 검색<input id="station-query" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="station-options" placeholder="서울 · ㅅㅇ · 원본 역 ID" autocomplete="off"></label><div id="station-shortcuts" class="station-shortcuts"></div><button id="favorite-station" type="button" ${q[which]?'':'disabled'}>${esc(q[which]||'선택한 역')} 즐겨찾기 전환</button><div id="station-options" class="station-options" role="listbox" aria-label="역 검색 결과"></div><p id="station-count" class="micro" role="status"></p>`);
 const input=$('#station-query');let composing=false,selected=-1,list=[];
 const choose=st=>{q[which]=st;dialog.close();searchPage();main.querySelector(`[data-station=${which}]`).focus({preventScroll:true});};
 const highlight=()=>{const options=[...$('#station-options').children];options.forEach((el,i)=>el.setAttribute('aria-selected',String(i===selected)));if(selected>=0){input.setAttribute('aria-activedescendant',options[selected].id);options[selected].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');};
 const draw=()=>{list=model.stationRecords.filter(s=>matchesStation(s.name,input.value.trim())||(input.value.trim()&&String(s.sourceId).includes(input.value.trim()))).map(s=>s.name).slice(0,60);selected=-1;input.removeAttribute('aria-activedescendant');$('#station-options').innerHTML=list.map((st,i)=>`<button type="button" role="option" tabindex="-1" aria-selected="false" id="station-option-${i}" data-st="${esc(st)}">${icon('search')}<b>${esc(st)}</b>${icon('next')}</button>`).join('');$('#station-count').textContent=list.length?`${list.length}개 역 표시. 방향키로 선택하고 Enter를 누르세요.`:'검색 결과가 없습니다.';$('#station-options').querySelectorAll('button').forEach(b=>b.onclick=()=>choose(b.dataset.st));};
 input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>{composing=false;draw();});input.oninput=()=>{if(!composing)draw();};
 input.onkeydown=e=>{if(composing||e.isComposing)return;if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(list.length){selected=selected<0?(e.key==='ArrowDown'?0:list.length-1):(selected+(e.key==='ArrowDown'?1:-1)+list.length)%list.length;highlight();}}if(e.key==='Enter'&&selected>=0){e.preventDefault();choose(list[selected]);}};
 const drawShortcuts=()=>{const favorites=model.read().favoriteStations||[],names=[...new Set([...favorites,...recent().flatMap(r=>[r.from,r.to])])].filter(name=>model.stations.includes(name));$('#station-shortcuts').innerHTML=names.map(name=>`<button type="button" data-short-station="${esc(name)}">${favorites.includes(name)?'★':'최근'} ${esc(name)}</button>`).join('');$('#station-shortcuts').querySelectorAll('button').forEach(b=>b.onclick=()=>choose(b.dataset.shortStation));};
 $('#favorite-station').onclick=()=>{try{const s=model.read(),name=q[which],favorites=s.favoriteStations||[];s.favoriteStations=favorites.includes(name)?favorites.filter(n=>n!==name):[...favorites,name];model.save(s);drawShortcuts();notify(s.favoriteStations.includes(name)?'즐겨찾기에 추가했습니다.':'즐겨찾기에서 삭제했습니다.');}catch(error){fail(error);}};
 drawShortcuts();draw();input.focus();
}
function passengerPicker(){
 showDialog('인원 및 좌석 등급',`<form id="pax-form"><h3>승객 인원</h3><label>최대 6명<select name="pax">${Array.from({length:6},(_,i)=>`<option value="${i+1}" ${+q.pax===i+1?'selected':''}>${i+1}명</option>`).join('')}</select></label><h3>좌석 등급</h3><div class="class-options">${Object.entries(model.data.classes).filter(([k])=>true).map(([k,v])=>`<label class="class-option"><input type="radio" name="cls" value="${k}" ${q.cls===k?'checked':''}>${v.label}</label>`).join('')}</div><button class="primary" type="submit">적용</button></form>`);$('#pax-form').onsubmit=e=>{e.preventDefault();q.pax=+e.target.elements.pax.value;q.cls=e.target.elements.cls.value;dialog.close();searchPage();$('#open-passengers').focus({preventScroll:true});};
}
function searchPage(){
 main.innerHTML=homeView({q,model,tab:homeTab,queryForm,searchOptions,esc,icon,grade,dateLabel,notice,recent:recent(),journeys:upcomingJourneys(model.read().tickets)});
 const selectTab=(tab,focus=false)=>{homeTab=tab;searchPage();if(focus)$(`#tab-${tab}`).focus();};
 main.querySelectorAll('[data-home-tab]').forEach(b=>{b.onclick=()=>selectTab(b.dataset.homeTab,true);b.onkeydown=e=>{const tabs=['booking','pass','tour'];let index=tabs.indexOf(homeTab);if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();index=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;selectTab(tabs[index],true);}};});
 main.querySelectorAll('[data-shortcut]').forEach(b=>b.onclick=()=>{const target=b.dataset.shortcut;if(target==='tickets')go('tickets');else if(target==='guide')showDialog('이용 안내','<p>출도착역과 날짜를 선택해 열차를 조회하고 좌석을 고르세요. 예약은 이 브라우저에 저장됩니다.</p><p>NIMBY Rail 게임 데이터 기반 시제품으로 실제 결제·발권·정기권 판매는 제공하지 않습니다.</p><a href="/NIMBYRAILTABLE/">NIMBY Rail 철도 정보 ↗</a>');else{selectTab(target);$('#home-tab-panel').scrollIntoView({block:'nearest',behavior:'smooth'});}});
 main.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{q={...q,...recent()[+b.dataset.recent]};homeTab='booking';searchPage();});
 if(homeTab!=='booking')return;
 $('#swap').onclick=()=>{[q.from,q.to]=[q.to,q.from];searchPage();};$('#open-date').onclick=()=>datePicker();$('#open-passengers').onclick=passengerPicker;
 main.querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>stationPicker(b.dataset.station));
 main.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{q={...q,...recent()[+b.dataset.recent]};searchPage();});
 $('#roundtrip').onclick=()=>{roundTrip=!roundTrip;if(!returnDate||returnDate<q.date)returnDate=q.date;searchPage();};if($('#return-date'))$('#return-date').onclick=()=>datePicker(true);
 $('#direct-info').onclick=()=>{q.transfer=!q.transfer;searchPage();};
 for(const [id,key] of [['min-wait','minWait'],['max-wait','maxWait'],['transfer-limit','transferLimit']])if($('#'+id))$('#'+id).onchange=e=>q[key]=+e.target.value;
 $('#search-form').onsubmit=e=>{e.preventDefault();try{model.validateQuery(q);if(roundTrip&&returnDate<q.date)throw Error('오는 날은 가는 날 이후로 선택하세요.');q.grade='all';q.family='all';saveRecent();visibleCount=12;journeyDrafts=[];selectingReturn=false;bookingQuery={...q};go('results');}catch(error){fail(error);}};

}
function resultPage(){
 disposeInventory();
 if(selectingReturn&&journeyDrafts.length){const d=journeyDrafts.at(-1),seg=model.segment(model.byKey.get(d.key),d.q.from,d.q.to),arrival=+model.departure(seg,d.q.date)+seg.duration*60000;const earliest=dateAt(arrival);if(q.date<earliest)q.date=earliest;q.after=q.date===earliest?clockAt(arrival):'';}
 if(!navigator.onLine){main.innerHTML='<div class="empty"><h2>오프라인에서는 새 열차를 조회할 수 없습니다</h2><p>저장된 승차권과 QR은 계속 확인할 수 있습니다.</p><a href="#tickets">저장된 승차권 보기</a></div>';return;}
 results=model.search(q).filter(r=>q.family==='ktx'?r.train.grade.startsWith('KTX'):q.family==='regional'?!r.train.grade.startsWith('KTX')&&r.train.grade!=='SRT':true);
 transferResults=q.transfer?model.transfers(q):[];
 main.innerHTML=`${selectingReturn?'<div class="info-box"><b>오는 열차를 선택하세요</b><p>가는 편 선택을 보관하고 있습니다. 아직 예약이 확정되지 않았습니다.</p><button id="restart-journey">가는 편부터 다시 선택</button></div>':''}<div class="result-context"><div><h2>${esc(q.from)} → ${esc(q.to)}</h2><p>${dateLabel(q.date)} · 승객 ${q.pax}명</p></div><button data-action="nav" data-value="search">조건 변경</button></div><div class="date-strip">${[-1,0,1].map(d=>{const date=addDays(q.date,d);return `<button data-result-date="${date}" ${date<kstDate()||date>addDays(kstDate(),30)?'disabled':''} aria-pressed="${d===0}">${date.slice(5).replace('-','.')}</button>`;}).join('')}</div><div class="result-filters"><div>${[['all','전체 '+results.length],['ktx','KTX'],['regional','일반열차']].map(([k,label])=>`<button data-family="${k}" aria-pressed="${(q.family||'all')===k}">${label}</button>`).join('')}</div><select id="sort" aria-label="열차 정렬"><option value="departure">출발 빠른순</option><option value="duration">소요 시간순</option><option value="fare">낮은 요금순</option></select></div><p class="micro">이미 출발한 열차는 표시하지 않습니다. 좌석 상태는 보이는 열차부터 조회합니다.</p><div id="results-list"></div><div id="more"></div><section id="transfer-results"></section><p class="fare-note">ⓘ 요금은 1인 기준 추정 운임입니다.</p>${notice}`;
 if($('#restart-journey'))$('#restart-journey').onclick=()=>{journeyDrafts=[];selectingReturn=false;q={...bookingQuery};go('search');};
 $('#sort').value=q.sort;$('#sort').onchange=e=>{q.sort=e.target.value;resultPage();};main.querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>{q.family=b.dataset.family;visibleCount=12;resultPage();});main.querySelectorAll('[data-result-date]').forEach(b=>b.onclick=()=>{q.date=b.dataset.resultDate;visibleCount=12;resultPage();});
 $('#results-list').innerHTML=results.length?results.slice(0,visibleCount).map((r,i)=>`<article class="train-card" data-inventory="${i}"><div class="card-top"><div>${grade(r.train)}<span class="direct-badge">직통</span></div><button class="detail-chevron" data-action="detail" data-index="${i}" aria-label="${esc(r.train.grade)} ${esc(r.train.no)} 정차역과 시설">${icon('next')}</button></div>${routeSummary(r.train,q)}<div class="card-bottom"><div class="fare-columns"><div><small>${model.data.classes[q.cls].label}</small><strong>${won(r.fare)}</strong><span class="inventory-status" role="status">조회 중</span><button class="text-button" data-action="mixed" data-index="${i}">구간별 좌석·입석 대안</button></div></div><button disabled class="outline" data-action="book" data-index="${i}">좌석 조회 중</button></div></article>`).join(''):'<div class="empty"><h3>출발 가능한 직통 열차가 없습니다</h3><p>날짜나 출도착역을 변경하거나 환승 포함을 선택하세요.</p><button data-action="nav" data-value="search">조건 변경</button></div>';
 if(results.length>visibleCount)$('#more').innerHTML=`<button class="load-more" data-action="more">열차 더 보기</button>`;
 if(q.transfer)$('#transfer-results').innerHTML=`<h3>환승 여정 · ${transferResults.length}건</h3>${transferResults.length?transferResults.map((r,i)=>`<article class="transfer-card" data-transfer-inventory="${i}"><header><b>${duration(r.duration)}</b><span>추정 ${won(r.fare)}</span></header>${r.legs.map((l,j)=>`<div class="transfer-leg">${grade(l.train)}<p>${esc(l.q.date)} · ${clock(l.seg.dep)} ${esc(l.q.from)} → ${clock(l.seg.arr)} ${esc(l.q.to)}${l.arr>=Date.parse(l.q.date+'T00:00:00+09:00')+86400000?' +1일':''}</p></div>${j===0?`<p class="transfer-wait">${esc(r.via)} 환승 · ${r.wait}분 대기</p>`:''}`).join('')}<div class="button-row"><button data-action="transfer-detail" data-index="${i}" data-leg="0">선행 시간표</button><button data-action="transfer-detail" data-index="${i}" data-leg="1">후행 시간표</button></div><span class="inventory-status" role="status">조회 중</span><button disabled class="primary" data-action="book-transfer" data-index="${i}">좌석 조회 중</button></article>`).join(''):'<p class="empty">설정한 대기 범위로 연결되는 환승 열차가 없습니다.</p>'}`;
 disposeInventory=observeInventory(main.querySelectorAll('[data-inventory],[data-transfer-inventory]'),el=>{
  const transfer=el.dataset.transferInventory!==undefined,r=transfer?transferResults[+el.dataset.transferInventory]:results[+el.dataset.inventory];
  if(!r)return;
  const states=transfer?r.legs.map(l=>model.availability(l.train,l.q)):[model.availability(r.train,q)];
  el.querySelector('.inventory-status').textContent=states.map((state,i)=>(transfer?`${i+1}구간 `:'')+inventoryLabel(state,+q.pax)).join(' · ');
  const button=el.querySelector('[data-action="book"],[data-action="book-transfer"]'),available=states.every(state=>state.eligible&&state.available>=+q.pax);
  button.disabled=transfer&&!available;button.textContent=available?(q.cls==='standing'?'입석 조건 확인':'좌석 선택'):transfer?'선택 구간 매진':'대기 기록';if(!transfer)button.dataset.action=available?'book':'watch';
 },el=>{el.querySelector('.inventory-status').textContent='조회 오류 · 다시 조회해 주세요';});
}
function makeDraft(key,query){return {key,q:{...query},seats:[],names:Array(+query.pax).fill(''),discount:'none',discounts:Array(+query.pax).fill('none')};}
function startBooking(index,transfer=false) {
 const r=transfer?transferResults[index]:results[index];if(!r)return;
 const legs=transfer?r.legs:[{key:r.key,q:{...q}}];
 if(legs.some(l=>model.departure(model.segment(model.byKey.get(l.key),l.q.from,l.q.to),l.q.date)<=new Date())){notify('출발한 열차입니다. 조회 결과를 갱신했습니다.');resultPage();return;}
 if(!selectingReturn){journeyDrafts=[];bookingType=roundTrip?'roundtrip':transfer?'transfer':'single';}
 const offset=journeyDrafts.length;journeyDrafts.push(...legs.map(l=>makeDraft(l.key,l.q)));journeyIndex=offset;draft=journeyDrafts[journeyIndex];selectedCar=0;go('seats');
}
function nextJourneySeat(){
 if(draft.q.cls!=='standing'&&draft.seats.length!==+draft.q.pax)return;
 if(journeyIndex<journeyDrafts.length-1){draft=journeyDrafts[++journeyIndex];selectedCar=0;seatsPage();}
 else if(roundTrip&&!selectingReturn&&!changing){
  const first=journeyDrafts[0].q,last=journeyDrafts.at(-1),seg=model.segment(model.byKey.get(last.key),last.q.from,last.q.to),arrival=+model.departure(seg,last.q.date)+seg.duration*60000;
  returnDate=returnDate<dateAt(arrival)?dateAt(arrival):returnDate;
  q={...bookingQuery,from:first.to,to:first.from,date:returnDate,after:'',grade:'all',family:'all'};
  // Transfer outbound origin/destination come from the original search, not its first leg.
  q.from=bookingQuery.to;q.to=bookingQuery.from;q.after=q.date===dateAt(arrival)?clockAt(arrival):'';
  selectingReturn=true;go('results');
 }else go('passengers');
}
function seatsPage(){
 if(!draft){go('search');return;}
 const t=model.byKey.get(draft.key),cars=model.seats(t,draft.q),seg=model.segment(t,draft.q.from,draft.q.to);
 if(!draft.carVisited){selectedCar=Math.max(0,cars.findIndex(c=>c.seats.some(s=>!s.blocked)));draft.carVisited=true;}
 const car=cars[selectedCar]||cars[0];
 if(draft.q.cls==='standing'){standingPage(t);return;}
 if(!car)throw new Error('이 열차에는 선택한 등급의 객실이 없습니다.');
 const classes=Object.keys(model.data.classes).filter(c=>c==='standing'||model.data.classCars(model.data.cars(model.data.formation(t.grade,t.no)),c).length);
 main.innerHTML=`<p class="journey-step">${bookingType==='roundtrip'?'왕복 여정':bookingType==='transfer'?'환승 여정':'좌석 선택'} · ${journeyIndex+1} / ${journeyDrafts.length}구간</p><div class="seat-trip">${grade(t)} · <b>${clock(seg.dep)} ${esc(draft.q.from)}</b> → <b>${clock(seg.arr)} ${esc(draft.q.to)}</b></div><div class="seat-class-tabs">${classes.map(c=>`<button data-seat-class="${c}" aria-pressed="${draft.q.cls===c}">${model.data.classes[c].label}</button>`).join('')}</div><div class="auto-seat"><label>좌석 선호<select id="seat-preference"><option value="together">일행 인접</option><option value="window">창측</option><option value="aisle">복도측</option><option value="forward">순방향</option><option value="reverse">역방향</option></select></label><button id="auto-seat">자동 배정</button></div><div class="car-selector"><button data-action="car" data-index="${Math.max(0,selectedCar-1)}" ${selectedCar===0?'disabled':''} aria-label="이전 호차">${icon('back')}</button><h2>${car.car}호차</h2><button data-action="car" data-index="${selectedCar+1}" ${selectedCar>=cars.length-1?'disabled':''} aria-label="다음 호차">${icon('next')}</button></div><div class="seat-shell"><p class="car-end">← ${esc(draft.q.from)}</p><div class="seat-grid" tabindex="0" role="region" aria-label="호차 좌석 목록, 아래로 스크롤하여 전체 좌석 확인">${Array.from({length:car.rows},(_,r)=>r+1).map(row=>`<div class="seat-row">${car.cols.map((col,i)=>{const seat=car.seats.find(x=>x.row===row&&x.col===col);return `${i===2?`<span class="aisle" aria-hidden="true">${row}</span>`:''}${seat?`<button class="seat" data-action="seat" data-value="${esc(seat.id)}" aria-label="${esc(seat.id)} ${seat.reverse?'역방향':'순방향'}${seat.blocked?' 사용 중':''}" aria-pressed="${draft.seats.includes(seat.id)}" ${seat.blocked?'disabled':''}>${esc(car.numbered?seat.id.split(' ')[1]:row+col)}<small>${seat.reverse?'↓':'↑'}</small></button>`:'<span class="no-seat"></span>'}`;}).join('')}</div>`).join('')}</div><p class="car-end">${esc(draft.q.to)} →</p></div><div class="seat-legend"><span><i></i>선택 가능</span><span><i class="chosen">✓</i>선택됨</span><span><i class="occupied"></i>선택 불가</span></div><button class="facility-link" data-action="draft-detail">차내 시설 및 정차역 보기 ${icon('next')}</button><p class="notice">좌석 현황은 게임 수요 모형의 추정값입니다.</p><div class="selection-bar"><div><small>선택 좌석</small><strong id="selected-count"></strong><small id="selected-labels"></small></div><div class="selection-fare"><small>${model.data.classes[draft.q.cls].label}</small><b>${won(model.data.fare(t,draft.q.from,draft.q.to,draft.q.cls)*+draft.q.pax)}</b></div><button id="next-passengers" class="primary" data-action="next-leg">선택 완료</button></div>`;
 main.querySelectorAll('[data-seat-class]').forEach(b=>b.onclick=()=>{draft.q.cls=b.dataset.seatClass;draft.seats=[];draft.carVisited=false;selectedCar=0;seatsPage();});$('#auto-seat').onclick=()=>{try{const assigned=model.autoAssign(t,draft.q,$('#seat-preference').value);const apply=()=>{draft.seats=assigned.seats;selectedCar=Math.max(0,cars.findIndex(c=>c.seats.some(s=>assigned.seats.includes(s.id))));seatsPage();};if(assigned.split||!assigned.preferenceMet){showDialog('자동 배정 조건 확인',`<p>${assigned.split?'일행을 같은 줄에 배정할 수 없어 분리 배정합니다.':''} ${!assigned.preferenceMet?'일부 좌석은 선택한 선호 조건과 다릅니다.':''}</p><p>${assigned.seats.map(esc).join(', ')}</p><button id="accept-auto" class="primary">이 좌석 사용</button>`);$('#accept-auto').onclick=()=>{dialog.close();apply();};}else apply();}catch(error){fail(error);}};updateSelected();
}
function updateSelected() {$('#selected-count').textContent=draft.seats.length?draft.seats.map(s=>s.split(' ')[1]).join(', '):'선택하세요';$('#selected-labels').textContent=draft.seats.join(', ')||'좌석을 선택하세요';$('#next-passengers').disabled=draft.seats.length!==+draft.q.pax;document.querySelectorAll('.seat[data-value]').forEach(b=>b.setAttribute('aria-pressed',String(draft.seats.includes(b.dataset.value))));}
function standingPage(t){
 const state=model.availability(t,draft.q);
 main.innerHTML=`<h2>입석 · 자유석</h2>${routeSummary(t,draft.q)}<div class="panel"><h3>${state.label||'입석'}</h3><p>${state.eligible?`모형 잔여 ${state.available}명`:`좌석 혼잡도 ${Math.round((state.threshold||0)*100)}%부터 판매`}</p><p>지정 좌석이 없습니다. 자유석 운영 여부는 공통 편성·판매 조건을 따릅니다.</p><button id="standing-next" class="primary" ${!state.eligible||state.available<+draft.q.pax?'disabled':''}>입석 조건 확인 · 다음</button><button id="back-general">일반실 좌석 보기</button></div>${notice}`;
 $('#standing-next').onclick=()=>{draft.seats=[];nextJourneySeat();};$('#back-general').onclick=()=>{draft.q.cls='general';draft.carVisited=false;seatsPage();};
}
function passengerPage() {
 if(!draft||journeyDrafts.some(d=>d.q.cls!=='standing'&&d.seats.length!==+d.q.pax)){go('seats');return;}
 const first=journeyDrafts[0];
 main.innerHTML=heading('','승객 정보를 확인하세요','모든 구간에 함께 적용합니다. 실명·연락처·결제 정보는 입력하지 마세요.')+`<form id="passenger-form" class="panel">${first.names.map((n,i)=>`<fieldset><legend>승객 ${i+1}</legend><label>별칭<input name="name${i}" value="${esc(n)}" maxlength="30" required autocomplete="off"></label><label>시제품 할인 유형<select name="discount${i}">${Object.entries(model.data.discounts).map(([k,d])=>`<option value="${k}" ${first.discounts?.[i]===k?'selected':''}>${esc(d.label)}${d.rate?` · ${d.rate*100}%`:''}${d.note?` (${d.note})`:''}</option>`).join('')}</select></label></fieldset>`).join('')}<div class="button-row"><button type="button" data-action="nav" data-value="seats">좌석 다시 선택</button><button class="primary" type="submit">전체 여정 확인</button></div></form>`+notice;
 $('#passenger-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),names=first.names.map((_,i)=>String(f.get('name'+i)).trim()),discounts=names.map((_,i)=>f.get('discount'+i));journeyDrafts.forEach(d=>Object.assign(d,{names:[...names],discounts:[...discounts],discount:discounts[0]}));go('review');};
}
function reviewPage(){
 if(!draft||journeyDrafts.some(d=>d.names.some(n=>!n))){go('passengers');return;}
 const old=changing?model.read().tickets.find(t=>t.id===changing):null;
 const amounts=journeyDrafts.map(d=>{const t=model.byKey.get(d.key),fare=model.data.fare(t,d.q.from,d.q.to,d.q.cls);return {base:fare*+d.q.pax,total:d.discounts.reduce((sum,discount)=>sum+model.data.discount(fare,discount),0)};}),base=amounts.reduce((s,a)=>s+a.base,0),total=amounts.reduce((s,a)=>s+a.total,0);
 main.innerHTML=`<h2>전체 여정 확인</h2><p class="micro">${journeyDrafts.length}구간을 한 번에 저장합니다. 한 구간이라도 예약할 수 없으면 전체를 저장하지 않습니다.</p>${old?`<section class="panel comparison-old"><h3>기존 승차권</h3><p>${esc(old.grade)} ${esc(old.trainNo)} · ${old.travelDate}</p><b>${old.dep} ${esc(old.fromStn)} → ${old.arr} ${esc(old.toStn)}</b><p>${old.seats.map(esc).join(', ')}</p></section>`:''}${journeyDrafts.map((d,i)=>{const t=model.byKey.get(d.key);return `<section class="review-journey"><div class="card-top"><div>${grade(t)}<p>${dateLabel(d.q.date)} · ${i+1}구간</p></div><button data-edit-leg="${i}">수정</button></div>${routeSummary(t,d.q)}<div class="review-seat">${model.data.classes[d.q.cls].label} · ${d.q.cls==='standing'?'지정 좌석 없음':d.seats.map(esc).join(', ')}</div><p>추정 ${won(amounts[i].total)}</p></section>`;}).join('')}<section class="review-section"><h3>승객 정보</h3>${draft.names.map((n,i)=>`<p>${esc(n)} · ${esc(model.data.discounts[draft.discounts[i]].label)}</p>`).join('')}</section><section class="review-section"><h3>요금 내역</h3><dl class="summary"><div><dt>운임</dt><dd>${won(base)}</dd></div><div><dt>할인</dt><dd>${won(base-total)}</dd></div>${old?`<div><dt>변경 차액</dt><dd>${won(total-old.totalFare)}</dd></div>`:''}<div class="total"><dt>총 추정 금액</dt><dd>${won(total)}</dd></div></dl></section><form id="confirm-form"><section class="review-section"><h3>예약 방식</h3><p>시제품 예약 · 결제 없음</p><label class="check"><input type="checkbox" required>실제 결제·발권이 없는 시제품임을 확인했습니다.</label></section><div class="review-footer"><button class="primary" type="submit">${old?'변경 확정':journeyDrafts.length>1?'전체 여정 예약 저장':'예약 저장'}</button></div></form>`;
 main.querySelectorAll('[data-edit-leg]').forEach(b=>b.onclick=()=>{journeyIndex=+b.dataset.editLeg;draft=journeyDrafts[journeyIndex];selectedCar=0;go('seats');});
 $('#confirm-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{const commit=()=>model.bookMany(journeyDrafts,{replaceId:changing,type:bookingType});lastTickets=await(navigator.locks?navigator.locks.request('raillink-booking',commit):commit());lastTicket=lastTickets[0];ticketFilter='active';ticketDate='';roundTrip=false;selectingReturn=false;returnJourney=null;draft=null;journeyDrafts=[];changing=null;go('complete');}catch(error){fail(error);button.disabled=false;}};
}
function completePage(){
 if(!lastTicket){go('tickets');return;}
 const t=lastTicket,train=model.byKey.get(t.key),query={from:t.fromStn,to:t.toStn,date:t.travelDate};
 main.innerHTML=`<div class="completion-heading"><div class="success-mark">${icon('check')}</div><h2>예약이 완료되었습니다</h2><p>시제품 승차권 ${lastTickets.length||1}개가 저장되었습니다.</p></div>${lastTickets.length>1?`<section class="panel">${lastTickets.map(t=>`<p>${esc(t.grade)} ${esc(t.trainNo)} · ${esc(t.travelDate)} ${esc(t.dep)} ${esc(t.fromStn)} → ${esc(t.arr)} ${esc(t.toStn)}</p>`).join('')}<a href="#tickets">통합 승차권 보기</a></section>`:''}<div class="reservation-number"><span>예약번호</span><b>${esc(t.id.slice(3,11).toUpperCase())}</b></div><section class="complete-ticket"><div class="card-top"><div>${grade(train)}</div><span>${dateLabel(t.travelDate)}</span></div>${routeSummary(train,query)}<div class="complete-meta"><p>${icon('seat')}${model.data.classes[t.seatClass].label} · ${t.seats.map(esc).join(', ')}</p><p>${icon('user')}승객 ${t.passengerCount}명</p></div><div class="complete-total"><span>전체 여정 추정 금액</span><b>${won(lastTickets.reduce((s,t)=>s+t.totalFare,0)||t.totalFare)}</b></div></section><div class="payment-option completion-payment">${icon('card')}<b>시제품 예약 완료 · 실제 결제 0원</b></div><button class="primary complete-action" data-action="nav" data-value="tickets">승차권 확인</button><button class="outline complete-action" data-action="nav" data-value="tickets">예매 내역으로</button>${returnJourney?'<button class="outline complete-action" id="book-return">오는 열차 조회</button>':''}<p class="notice">ⓘ 실제 열차에 사용할 수 없는 시제품 승차권입니다.</p>`;
 if($('#book-return'))$('#book-return').onclick=()=>{q={...q,...returnJourney,grade:'all',family:'all',after:''};returnJourney=null;go('results');};
}
let ticketFilter='active',ticketDate='',ticketCalendar=false,ticketMonth=kstDate().slice(0,7);
function ticketsPage(){
 main.innerHTML=ticketsView({model,esc,grade,won,icon,filter:ticketFilter,date:ticketDate,calendar:ticketCalendar,month:ticketMonth});
 main.querySelectorAll('[data-ticket-filter]').forEach(b=>b.onclick=()=>{ticketFilter=b.dataset.ticketFilter;ticketsPage();});
 $('#calendar-toggle').onclick=()=>{ticketCalendar=!ticketCalendar;if(!ticketCalendar)ticketDate='';ticketsPage();};
 if($('#ticket-month'))$('#ticket-month').onchange=e=>{if(e.target.value){ticketMonth=e.target.value;ticketDate='';ticketsPage();}};
 if($('#ticket-date'))$('#ticket-date').onchange=e=>{ticketDate=e.target.value;ticketsPage();};
 main.querySelectorAll('[data-ticket-day]').forEach(b=>b.onclick=()=>{ticketDate=b.dataset.ticketDay;ticketsPage();});
}
function showTicketQR(id){
 const t=model.read().tickets.find(t=>t.id===id);if(!t)return;
 showDialog('시뮬레이션 승차권',`<div class="qr-ticket" style="--grade:${esc(model.data.colors[t.grade]||'#1168ad')}"><h3>${esc(t.grade)} ${esc(t.trainNo)} · ${journeyState(t).label}</h3><p>${esc(t.fromStn)} → ${esc(t.toStn)}</p><p>${esc(t.travelDate)} ${esc(t.dep)} 출발</p>${ticketQR(t.id)}<strong>시뮬레이션 · 실제 탑승 불가</strong><small>${esc(t.id)}</small><p>${t.seats.map(esc).join(', ')||'지정 좌석 없음'}</p><p>QR에는 로컬 예매 ID만 들어 있습니다. 개인정보·결제정보가 포함되지 않습니다.</p><button id="qr-formation">내 편성과 시설 보기</button></div>`);
 $('#qr-formation').onclick=()=>{dialog.close();details(model.byKey.get(t.key),{from:t.fromStn,to:t.toStn,date:t.travelDate,pax:t.passengerCount,cls:t.seatClass},t);};
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
  main.innerHTML='<div class="button-row"><a href="#board">내 여행 일정</a><a href="#passes">정기 일정 · 반복 예매</a></div>'+heading('TAKE THE SCENIC ROUTE','조금 다른 여행','공통 시간표에 등록된 관광열차를 만나보세요.')+`<div class="travel-list">${unique.length?unique.map(t=>{const stops=model.data.stops(t);return `<article class="panel">${grade(t)}<h3>${esc(stops[0].s)} → ${esc(stops.at(-1).s)}</h3><p>${esc(t.line)} · ${stops.length}개 정차역</p><button data-action="tour" data-value="${esc(model.key(t))}">이 구간 조회 →</button></article>`;}).join(''):'<p class="empty">등록된 관광열차가 없습니다.</p>'}</div><h3>자주 가는 구간</h3><p class="muted">자주 이용하는 구간을 저장해 빠르게 조회하세요. 철도 패스 판매·사용 권한은 제공하지 않습니다.</p><div class="panel"><form id="route-form"><div class="form-row"><label>출발역<input name="from" list="travel-stations" required></label><label>도착역<input name="to" list="travel-stations" required></label></div><datalist id="travel-stations">${model.stations.map(s=>`<option value="${esc(s)}"></option>`).join('')}</datalist><button type="submit">구간 저장 ＋</button></form></div><div>${state.routes.map((r,i)=>`<div class="saved-route"><button data-action="saved-route" data-index="${i}">${esc(r.from)} → ${esc(r.to)} <span>조회 →</span></button><button data-action="remove-route" data-index="${i}" aria-label="${esc(r.from)} ${esc(r.to)} 구간 삭제">×</button></div>`).join('')}</div>`+notice;
  $('#route-form').onsubmit=e=>{e.preventDefault();try{const r=Object.fromEntries(new FormData(e.target));model.validateQuery({...q,...r,date:kstDate()});const current=model.read();if(!current.routes.some(x=>x.from===r.from&&x.to===r.to))current.routes.push(r);model.save(current);render();notify('구간을 저장했습니다.');}catch(error){fail(error);}};
}
function myPage() {
  const state=model.read();
  main.innerHTML=heading('YOUR RAILLINK','마이 레일링크','나의 여행 기록은 이 브라우저에만 저장됩니다.')+`<div class="panel profile"><span class="avatar" aria-hidden="true">○</span><div><h3>로컬 여행자</h3><p>계정·서버 동기화 없음</p></div></div><div class="panel"><label>화면 테마<select id="theme"><option value="light">라이트</option><option value="dark">다크</option><option value="system">시스템 설정</option></select></label><label class="check"><input id="simulation" type="checkbox" ${state.simulation?'checked':''}>공통 지연 모형 사용</label><p class="micro">NIMBY Rail 게임의 확률 모형입니다. 한국 시간대로 설정된 기기에서 적용하며 실제 운행 지연이 아닙니다.</p></div><div class="panel"><button id="system-alerts">시스템 여행 알림 허용</button><p class="micro">앱이 열린 동안에만 출발·도착 준비를 알립니다. 백그라운드 예약 알림은 제공하지 않습니다.</p></div><h3>좌석 대기 기록</h3><p class="muted">자동 예약이나 알림 전송 없이, 앱을 열었을 때 모형 잔여석을 다시 확인합니다.</p>${state.watches.length?state.watches.map(w=>{const t=model.byKey.get(w.key);let text='열차 정보 없음';if(t){try{const seg=model.segment(t,w.q.from,w.q.to);text=model.departure(seg,w.q.date)<=new Date()?'출발한 열차':model.availability(t,w.q).available>=+w.q.pax?'모형상 좌석 선택 가능':'아직 대기 중';}catch{text='조회할 수 없음';}}return `<div class="panel"><b>${esc(w.q.from)} → ${esc(w.q.to)}</b><p>${esc(w.q.date)} · ${esc(t?.no||'')} · ${text}</p><div class="button-row"><button data-action="watch-search" data-value="${w.id}">다시 조회</button><button data-action="remove-watch" data-value="${w.id}">기록 삭제</button></div></div>`;}).join(''):'<div class="panel muted">등록된 대기 기록이 없습니다.</div>'}<div class="panel"><label class="check"><input id="notifications" type="checkbox" ${state.notifications?'checked':''}>앱 안에서 여행 안내 표시</label><p class="micro">푸시 알림은 보내지 않습니다.</p>${state.notifications?'<p>출발 전 승강장과 내 호차를 확인하세요. 시제품 승차권은 실제 탑승에 사용할 수 없습니다.</p>':''}</div><div class="panel"><h3>예약 데이터 관리</h3><p>저장 공간 삭제 시 예약·대기·구간 기록이 사라집니다.</p><div class="button-row"><button data-action="export">내 데이터 내보내기</button><button class="danger" data-action="reset">초기화</button></div></div>`;
  $('#system-alerts').onclick=async()=>{if(!('Notification' in window)){notify('이 브라우저는 시스템 알림을 지원하지 않습니다.');return;}const permission=await Notification.requestPermission();localStorage.setItem('raillink.systemAlerts',permission==='granted'?'1':'0');notify(permission==='granted'?'앱이 열린 동안 여행 알림을 표시합니다.':'시스템 알림이 허용되지 않았습니다.');};
  $('#theme').value=localStorage.getItem('raillink.theme')||'light';$('#theme').onchange=e=>{localStorage.setItem('raillink.theme',e.target.value);applyTheme();};
  $('#simulation').onchange=e=>{const s=model.read();s.simulation=e.target.checked;model.save(s);model.data.setSimulation?.(s.simulation);};
  $('#notifications').onchange=e=>{const s=model.read();s.notifications=e.target.checked;model.save(s);render();};
}
function confirmCancel(id){
 const state=model.read(),t=state.tickets.find(t=>t.id===id);if(!t)return;
 const group=t.groupId?state.tickets.filter(x=>x.groupId===t.groupId):[t];
 showDialog('시제품 예약을 취소할까요?',`<p>${group.length}구간 · ${esc(group[0].fromStn)} → ${esc(group.at(-1).toStn)}</p><p>가상 환불 금액: <b>${won(group.reduce((sum,t)=>sum+t.totalFare,0))}</b></p><p>실제 금전 거래는 없습니다. 첫 열차가 출발하면 전체 취소할 수 없습니다.</p><button class="danger" id="confirm-cancel">예약 취소 확인</button>`);
 $('#confirm-cancel').onclick=()=>{try{model.cancel(id);dialog.close();render();notify('시제품 예약을 취소했습니다.');}catch(error){fail(error);}};
}
function render() {
  const route=location.hash.slice(1)||'home';
  disposeInventory();
  shell(route);
  document.querySelectorAll('[data-nav]').forEach(a=>{const current=a.dataset.nav===(route==='complete'?'tickets':['passes','board'].includes(route)?'travel':['results','seats','passengers','review'].includes(route)?'search':route);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  try {({home:searchPage,search:searchPage,results:resultPage,seats:seatsPage,passengers:passengerPage,review:reviewPage,complete:completePage,tickets:ticketsPage,travel:travelPage,passes:passesPage,board:boardPage,my:myPage}[route]||searchPage)();document.title=`${['home','search'].includes(route)?'레일링크 · 열차 예매':main.querySelector('h2')?.textContent||'레일링크'} · RailLink`;}
  catch(error){main.innerHTML=heading('PLEASE TRY AGAIN','화면을 불러오지 못했습니다')+`<div class="empty"><p>${esc(error.message)}</p><button data-action="nav" data-value="search">검색으로 돌아가기</button><button data-action="export">저장 데이터 내보내기</button></div>`;}
}
main.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
  const {action,value,index}=b.dataset;
  try {
    if(action==='nav'){if(value==='search')homeTab='booking';go(value);}
    if(action==='detail')details(results[index].train,q);
    if(action==='draft-detail')details(model.byKey.get(draft.key),draft.q);
    if(action==='book')startBooking(+index);
    if(action==='book-transfer')startBooking(+index,true);
    if(action==='mixed'){const r=results[index],legs=model.mixed(r.train,q);if(!legs.length){notify('좌석·입석을 나눠 이용할 수 있는 대안이 없습니다.');return;}showDialog('구간별 좌석·입석 대안',`<p>구간마다 좌석과 운임이 다릅니다. 각 구간의 좌석을 선택한 뒤 전체를 저장합니다.</p>${legs.map(l=>`<p>${esc(l.q.from)} → ${esc(l.q.to)} · ${model.data.classes[l.q.cls].label}</p>`).join('')}<button class="primary" id="accept-mixed">구간별 선택 시작</button>`);$('#accept-mixed').onclick=()=>{dialog.close();journeyDrafts=legs.map(l=>makeDraft(l.key,l.q));journeyIndex=0;draft=journeyDrafts[0];bookingType='mixed';roundTrip=false;selectingReturn=false;selectedCar=0;go('seats');};}
    if(action==='transfer-detail'){const leg=transferResults[index].legs[+b.dataset.leg];details(leg.train,leg.q);}
    if(action==='next-leg')nextJourneySeat();
    if(action==='watch'){model.watch(results[index].key,q);notify('대기 기록을 저장했습니다. 마이에서 확인하세요.');}
    if(action==='more'){visibleCount+=12;resultPage();}
    if(action==='car'){selectedCar=+index;seatsPage();}
    if(action==='seat'){const i=draft.seats.indexOf(value);if(i>=0)draft.seats.splice(i,1);else if(draft.seats.length<+draft.q.pax)draft.seats.push(value);else notify(`${draft.q.pax}명에 맞게 좌석을 선택하세요.`);updateSelected();}
    if(action==='operation'){if(!navigator.onLine){notify('운행 정보 갱신은 인터넷 연결 후 이용하세요.');return;}const t=model.read().tickets.find(t=>t.id===value);openOperation({model,train:model.byKey.get(t.key),query:{from:t.fromStn,to:t.toStn,date:t.travelDate},showDialog,dialog,esc,grade});}
    if(action==='ticket-detail'){const t=model.read().tickets.find(t=>t.id===value);details(model.byKey.get(t.key),{from:t.fromStn,to:t.toStn,date:t.travelDate,pax:t.passengerCount,cls:t.seatClass},t);}
    if(action==='cancel')confirmCancel(value);
    if(action==='qr')showTicketQR(value);
    if(action==='delete-history'){showDialog('여정 기록 삭제','<p>이 여정의 승차권 기록을 브라우저에서 삭제합니다.</p><button id="delete-record" class="danger">기록 삭제</button>');$('#delete-record').onclick=()=>{try{model.removeHistory(value);dialog.close();ticketsPage();}catch(error){fail(error);}};}
    if(action==='export-csv'){const blob=new Blob([ticketsCSV(model.read().tickets)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='raillink-tickets.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(action==='change'){roundTrip=false;selectingReturn=false;journeyDrafts=[];homeTab='booking';const t=model.read().tickets.find(t=>t.id===value);changing=t.id;q={...q,from:t.fromStn,to:t.toStn,date:t.travelDate,pax:t.passengerCount,cls:t.seatClass,after:'',grade:'all'};go('search');}
    if(action==='tour'){const t=model.byKey.get(value),s=model.data.stops(t);q={...q,from:s[0].s,to:s.at(-1).s,date:kstDate(),grade:t.grade,after:'',cls:'general'};go('results');}
    if(action==='saved-route'){q={...q,...model.read().routes[index],date:kstDate(),grade:'all',after:''};go('results');}
    if(action==='remove-route'){const s=model.read();s.routes.splice(+index,1);model.save(s);render();}
    if(action==='watch-search'){q={...model.read().watches.find(w=>w.id===value).q};if(q.date<kstDate())q.date=kstDate();go('results');}
    if(action==='remove-watch'){const s=model.read();s.watches=s.watches.filter(w=>w.id!==value);model.save(s);render();}
    if(action==='export'){const blob=new Blob([localStorage.getItem(STORE_KEY)||'{}'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='raillink-reservations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(action==='reset'){showDialog('이 브라우저의 기록을 삭제할까요?','<p>예약·대기·저장 구간 기록을 삭제합니다. 필요하면 먼저 내보내기를 이용하세요.</p><button class="danger" id="confirm-reset">내 기록 모두 삭제</button>');$('#confirm-reset').onclick=()=>{localStorage.removeItem(STORE_KEY);localStorage.removeItem(recentKey);model.data.invalidate();model.data.setSimulation?.(false);dialog.close();render();};}
  } catch(error){fail(error);}
});
window.addEventListener('hashchange',()=>{if(location.hash==='#search')homeTab='booking';render();window.scrollTo(0,0);main.focus({preventScroll:true});});
window.addEventListener('storage',e=>{if(e.key===STORE_KEY){model.data.invalidate();notify('다른 탭에서 예약 정보가 변경되었습니다.');if(!draft)render();}});
try {
  if(!window.RailData) throw new Error('공통 철도 데이터 연결을 확인하세요.');
  model=createModel(window.RailData,localStorage);
  model.data.setSimulation?.(model.read().simulation===true);
  window.loadTickets=()=>model.read().tickets.map(t=>({...t,travelDate:t.serviceDate||t.travelDate}));
  q={from:'',to:'',date:kstDate(),pax:1,cls:'general',grade:'all',sort:'departure',after:''};
  render();
} catch(error){main.innerHTML=heading('CONNECTION REQUIRED','데이터 연결을 확인해 주세요')+`<p>${esc(error.message)}</p><button onclick="location.reload()">다시 시도</button>`;}

// Refresh schedule regions only: station/date inputs and open sheets retain focus and scroll.
function refreshHomeJourney(){
 try {
  if(location.hash==='#results'){let removed=0;for(const el of main.querySelectorAll('[data-inventory],[data-transfer-inventory]')){const r=el.dataset.transferInventory!==undefined?transferResults[+el.dataset.transferInventory]:results[+el.dataset.inventory];const dep=r?.legs?r.legs[0].dep:r?+model.departure(r.seg,q.date):Infinity;if(dep<=Date.now()){el.remove();removed++;}}if(removed){const count=results.filter(r=>+model.departure(r.seg,q.date)>Date.now()).length;const all=main.querySelector('[data-family=all]');if(all)all.textContent='전체 '+count;notify('출발한 열차를 조회 결과에서 제외했습니다.');if(!main.querySelector('[data-inventory]'))$('#results-list').innerHTML='<p class="empty">표시된 열차가 모두 출발했습니다. 다음 날짜나 다른 열차를 조회하세요.</p>';}}
  if(['home','search',''].includes(location.hash.slice(1))&&!dialog.open){
   const template=document.createElement('template');
   template.innerHTML=homeView({q,model,tab:homeTab,queryForm,searchOptions,esc,icon,grade,dateLabel,notice,recent:recent(),journeys:upcomingJourneys(model.read().tickets)});
   for(const selector of ['.home-schedule','.home-live']){
    const current=main.querySelector(selector),next=template.content.querySelector(selector);
    if(current?.contains(document.activeElement))continue;
    if(current&&next)current.replaceWith(next);
    else if(current)current.remove();
    else if(next)main.querySelector('.home-greeting').after(next);
   }
  }
 }catch(error){fail(error);}
 setTimeout(refreshHomeJourney,60000-Date.now()%60000);
}
setTimeout(refreshHomeJourney,60000-Date.now()%60000);

function applyTheme(){const selected=localStorage.getItem('raillink.theme')||'light';document.documentElement.dataset.theme=selected==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):selected;}
try{applyTheme();matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);}catch{}

function boardPage(){main.innerHTML=travelBoard(model.read().tickets,model,esc)+notice;}
let passPreview=[];
function passesPage(){
 const s=model.read();main.innerHTML=heading('','정기 일정','향후 4주간 반복 예매를 준비합니다. 실제 정기권 판매·이용 권한은 없습니다.')+`<form id="pass-form" class="panel"><label>일정 이름<input name="name" maxlength="40" required placeholder="예: 출근길"></label><div class="form-row"><label>출발역<input name="from" list="pass-stations" value="${esc(q.from)}" required></label><label>도착역<input name="to" list="pass-stations" value="${esc(q.to)}" required></label></div><datalist id="pass-stations">${model.stations.map(st=>`<option value="${esc(st)}"></option>`).join('')}</datalist><label>시작일<input type="date" name="start" min="${kstDate()}" max="${addDays(kstDate(),3)}" value="${kstDate()}" required></label><button type="button" id="pass-trains">선호 열차 조회</button><label>선호 열차<select name="trainKey" id="pass-train" required><option value="">먼저 구간을 조회하세요</option></select></label><label>좌석 등급<select name="cls">${Object.entries(model.data.classes).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select></label><label>인원<select name="pax">${[1,2,3,4,5,6].map(n=>`<option value="${n}">${n}명</option>`).join('')}</select></label><label>승객 별칭<input name="alias" maxlength="30" required></label><fieldset><legend>반복 요일</legend><div class="weekday-options">${['일','월','화','수','목','금','토'].map((day,i)=>`<label><input type="checkbox" name="weekday" value="${i}">${day}</label>`).join('')}</div></fieldset><button class="primary" type="submit">4주 일정 미리보기</button></form><div id="pass-preview" aria-live="polite"></div><h3>저장된 정기 일정</h3>${(s.passes||[]).map(p=>`<div class="panel"><b>${esc(p.name)}</b><p>${esc(p.from)} → ${esc(p.to)} · ${p.weekdays.map(d=>['일','월','화','수','목','금','토'][d]).join(', ')}</p><a href="#tickets">발행된 시제품 승차권 보기</a></div>`).join('')||'<p>저장된 정기 일정이 없습니다.</p>'}`;
 $('#pass-trains').onclick=()=>{try{const form=$('#pass-form'),data=Object.fromEntries(new FormData(form));const query={from:data.from,to:data.to,date:data.start,cls:data.cls,pax:+data.pax,sort:'departure'};const rows=model.search(query);$('#pass-train').innerHTML=rows.map(r=>`<option value="${esc(r.key)}">${esc(r.train.grade)} ${esc(r.train.no)} · ${clock(r.seg.dep)} 출발</option>`).join('')||'<option value="">조회된 열차 없음</option>';}catch(error){fail(error);}};
 $('#pass-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;const form=new FormData(e.target),config={...Object.fromEntries(form),pax:+form.get('pax'),weekdays:form.getAll('weekday').map(Number)};$('#pass-preview').textContent='날짜별 시간표와 좌석을 확인하고 있습니다…';try{passPreview=await previewPass(model,config);if(!$('#pass-preview'))return;$('#pass-preview').innerHTML=passPreview.map(p=>`<p>${p.date} · ${p.draft?'예약 가능':esc(p.reason)+' · 제외'}</p>`).join('')+`<p>예약 가능한 ${passPreview.filter(p=>p.draft).length}건만 일괄 저장합니다. 선택한 별칭과 인접 좌석 자동 배정이 적용됩니다.</p><button class="primary" id="commit-pass" ${passPreview.some(p=>p.draft)?'':'disabled'}>시제품 일괄 예약</button>`;$('#commit-pass').onclick=async()=>{const b=$('#commit-pass');b.disabled=true;try{const commit=()=>model.bookMany(passPreview.filter(p=>p.draft).map(p=>p.draft),{type:'pass',pass:config});lastTickets=await(navigator.locks?navigator.locks.request('raillink-booking',commit):commit());lastTicket=lastTickets[0];ticketFilter='active';ticketDate='';go('complete');}catch(error){fail(error);b.disabled=false;}};}catch(error){fail(error);if($('#pass-preview'))$('#pass-preview').textContent='미리보기를 생성하지 못했습니다.';}finally{button.disabled=false;}};
}
const sentAlerts=new Set();
function checkJourneyAlerts(){
 try{if(model?.read().notifications){for(const {ticket,state} of upcomingJourneys(model.read().tickets)){if(!['boarding','arriving'].includes(state.phase))continue;const key=ticket.id+state.phase;if(sentAlerts.has(key))continue;sentAlerts.add(key);const text=`${ticket.grade} ${ticket.trainNo} · ${state.label} · ${ticket.fromStn} → ${ticket.toStn} (시간표 기준)`;notify(text);if(localStorage.getItem('raillink.systemAlerts')==='1'&&'Notification' in window&&Notification.permission==='granted')new Notification('레일링크 여행 안내',{body:text,tag:key});}}}catch{}
 setTimeout(checkJourneyAlerts,60000-Date.now()%60000);
}
setTimeout(checkJourneyAlerts,1000);

if('serviceWorker' in navigator&&location.protocol!=='file:'){
 navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(registration=>{
  const urls=[...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(el=>el.src||el.href);
  urls.push(new URL('/NIMBYRAILTABLE/index.html',location.origin).href);
  registration.active?.postMessage({type:'cache-sources',urls});
 }).catch(()=>{});
}
window.addEventListener('offline',()=>notify('오프라인 · 저장된 승차권과 QR만 확인할 수 있습니다.'));
