import {createBoardingController} from './boarding-controller.js';
import {createBoardingAlerts} from './boarding-notifications.js';
import {activeLegIndex} from './boarding.js';
import {createGreetingSession,updateHomeGreeting} from './greetings.js';
import {ensureProductStyles} from './styles.js';
import {tourismView,tourismGroups,tourSystemsView,tourDirectionView,tourProductDetailView,tourItineraryView} from './tourism.js';
import {tourProductById,buildTourPlan,tourSegmentQuery,markTourSegmentBooked,nextUnbookedTourSegment} from './tour-products.js';
import {openAppStorage,openBookingStorage} from './booking-storage.js';
import {queryOptions} from './query-options.js';
import {initPWA,installApp} from './pwa.js';
import {resultHeader,trainResult,transferResult,transferDetail} from './search-view.js';
import {seatsView} from './seats-view.js';
import {openStationPicker} from './station-picker.js';
import {previewPass,travelBoard} from './travel-tools.js';
import {openOperation} from './operations.js';
import {ticketsView,ticketsCSV} from './tickets.js';
import {ticketQR} from './ticket-qr.js';
import {combinedTicket,isSameTrainSeatJourney,logicalTicketCount,orderedTicketGroup,seatSegments} from './ticket-journey.js';
import {observeInventory,inventoryLabel,inventoryPresentation} from './inventory-queue.js';
import {displayClock,minuteOf,dateAt,clockAt} from './railway-time.js';
import {homeView} from './home.js';
import {journeyState, upcomingJourneys} from './journey.js';
import {createModel, kstDate, addDays, STORE_KEY} from './model.js';
import {createSettingsStore,queryFromSettings,seatOptions,stationIdFor,formatClock,currentKstClock,SETTINGS_KEY} from './settings.js';
import {moreView,settingsMainView,searchSettingsView,seatSettingsView,alertsSettingsView,boardingSettingsView,appearanceSettingsView,routesSettingsView,dataSettingsView,privacySettingsView,aboutSettingsView} from './settings-view.js';
const $ = s => document.querySelector(s);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
const paths={info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7h.01M12 11v6',share:'M12 16V2m-5 5 5-5 5 5M5 10H3v12h18V10h-2',home:'m3 10 9-8 9 8v11h-6v-7H9v7H3Z',more:'M4 12h.01M12 12h.01M20 12h.01',bell:'M5 17h14l-2-4V8a5 5 0 0 0-10 0v5Zm5 3h4',clipboard:'M8 4H4v18h16V4h-4M8 2h8v4H8Z M8 11h8M8 15h6',bag:'M4 8h16l1 13H3ZM8 8V6a4 4 0 0 1 8 0v2',back:'m14 5-7 7 7 7',down:'m6 9 6 6 6-6',next:'m9 5 7 7-7 7',calendar:'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Zm-2 5h18M7 2v5m10-5v5',user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9v-2a8 6 0 0 1 16 0v2Z',swap:'M8 3v17m-4-4 4 4 4-4M16 21V4m-4 4 4-4 4 4',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l4 3',search:'M6 3h12v14H6Zm0 6h12M9 20l-2 2m8-2 2 2M9 14h.01M15 14h.01M9 3V1h6v2',ticket:'M3 5h18v4a3 3 0 0 0 0 6v4H3v-4a3 3 0 0 0 0-6ZM8 5v14',travel:'M3 7h18v14H3ZM8 7V3h8v4M7 7v14m10-14v14',seat:'M7 3h8v9h4v7H7ZM4 9v12h16',card:'M2 5h20v14H2Zm0 5h20',check:'m5 12 5 5L20 6',round:'M20 8a9 9 0 0 0-15-3L2 8m0-5v5h5M4 16a9 9 0 0 0 15 3l3-3m0 5v-5h-5',pin:'M12 22S4 13 4 9a8 8 0 1 1 16 0c0 4-8 13-8 13ZM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.user}"/></svg>`;
const dateLabel=(date,year=false)=>{const format=settingsStore?.get().appearance.dateFormat||'korean';if(format==='iso')return date;if(format==='dot')return `${year?date.slice(0,4)+'.':''}${date.slice(5,7)}.${date.slice(8)}`;return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',...(year?{year:'numeric'}:{})}).format(new Date(date+'T12:00:00+09:00'));};
const clock=value=>settingsStore?formatClock(displayClock(value),settingsStore.get().appearance.timeFormat):displayClock(value);
const duration=n=>`${Math.floor(n/60)?Math.floor(n/60)+'시간 ':''}${n%60? n%60+'분':''}`;
const homeGreetings=createGreetingSession();
let homeTab='booking',transferResults=[],disposeInventory=()=>{},journeyDrafts=[],journeyIndex=0,bookingType='single',selectingReturn=false,bookingQuery=null,lastTickets=[],completedTourSegment=false;
let roundTrip=false,returnDate='',returnJourney=null;
let selectedTourGrade='',tourOrigin='travel',tourFilter='all',selectedTourProductId='',selectedTourDuration='',tourPlan=null,boarding,boardingAlerts,settingsStore;
const tourPlanKey='raillink.tour.plan',tourProductKey='raillink.tour.product';
try{tourPlan=JSON.parse(sessionStorage.getItem(tourPlanKey)||'null');selectedTourProductId=tourPlan?.productId||sessionStorage.getItem(tourProductKey)||'';}catch{tourPlan=null;}
function selectTourProduct(id){selectedTourProductId=id;try{sessionStorage.setItem(tourProductKey,id);}catch{}}
function saveTourPlan(plan){tourPlan=plan;selectTourProduct(plan?.productId||selectedTourProductId);try{if(plan)sessionStorage.setItem(tourPlanKey,JSON.stringify(plan));else sessionStorage.removeItem(tourPlanKey);}catch{}}
const recentKey='raillink.recent';
function recent(){try{return JSON.parse(localStorage.getItem(recentKey)||'[]').filter(r=>model.stations.includes(r.from)&&model.stations.includes(r.to)).slice(0,5);}catch{return [];}}
function saveRecent(){try{localStorage.setItem(recentKey,JSON.stringify([{from:q.from,to:q.to},...recent().filter(r=>r.from!==q.from||r.to!==q.to)].slice(0,5)));}catch{}}
function shell(route){
 document.body.dataset.screen=route;
 const titles={boarding:'스마트 탑승 도우미','tour-routes':'관광열차 계통','tour-product':'관광상품','tour-itinerary':'여행 일정','route-details':'경로 상세',results:'열차 조회',seats:'좌석 선택',passengers:'승객 정보',review:'예약 정보 확인',complete:'예약 완료',tickets:'내 승차권',travel:'기차 여행',my:'더보기',settings:'설정','settings-search':'열차 조회 기본 설정','settings-seat':'좌석 · 환승 선호','settings-routes':'자주 이용하는 구간','settings-alerts':'운행 및 탑승 알림','settings-boarding':'스마트 탑승 도우미','settings-appearance':'화면 및 접근성','settings-data':'데이터 및 저장 공간','settings-privacy':'개인정보 및 보안','settings-about':'앱 정보 및 도움말',passes:'정기 일정',board:'내 여행 일정'};
 const prev={boarding:boarding?.origin||'tickets','tour-routes':tourOrigin,'tour-product':tourOrigin,'tour-itinerary':'tour-product','route-details':'results',results:q?.tourSystem?'tour-routes':q?.tourProductId?'tour-itinerary':'search',seats:'results',passengers:'seats',review:'passengers',complete:'tickets',settings:'my','settings-search':'settings','settings-seat':'settings','settings-routes':'settings','settings-alerts':'settings','settings-boarding':'settings','settings-appearance':'settings','settings-data':'settings','settings-privacy':'settings','settings-about':'settings'};
 const brand=`<a href="#home" class="brand"><svg viewBox="0 0 60 36" aria-hidden="true"><path d="M2 30 22 8Q26 4 32 4h25l-8 7H32L15 30Z" fill="#159ee1"/><path d="m21 30 13-15h17l-7 7h-7l-7 8Z" fill="#1d6feb"/></svg><b>레일링크 <em>TICKET</em></b></a>`;
 $('.top').innerHTML=['home','search'].includes(route)?`${brand}<button id="home-notifications" class="header-icon" aria-label="여행 알림">${icon('bell')}</button>`:`<a href="#${prev[route]||'search'}" class="header-icon" aria-label="뒤로">${icon('back')}</a><h1>${titles[route]||'레일링크'}</h1><button class="header-icon" id="help" aria-label="이용 안내">?</button>`;
 if(route==='seats')$('.top').innerHTML='<h1>좌석 선택</h1><a href="#results" class="header-icon seat-close" aria-label="좌석 선택 닫기">×</a>';
 if($('#help'))$('#help').onclick=()=>showDialog('레일링크 이용 안내','<p>레일링크에서 열차를 조회하고 승차권을 발매할 수 있습니다.</p><p>예약은 이 브라우저에 저장됩니다.</p><a href="/NIMBYRAILTABLE/">NIMBY Rail 철도 정보 ↗</a>');
 const navItems=[['home','home','홈'],['search','ticket','예매'],['tickets','card','승차권'],['travel','bag','여행'],['my','more','더보기']];
 $('.navigation').innerHTML=navItems.map(([route,i,label])=>`<a href="#${route}" data-nav="${route}">${icon(i)}<span>${label}</span></a>`).join('');
 if($('#home-notifications'))$('#home-notifications').onclick=()=>{
   const journeys=boarding?.service.upcoming()||[];
   showDialog('여행 알림',journeys.length?journeys.slice(0,5).map(({ticket:t,state:s})=>`<div class="panel"><p>${esc(t.fromStn)} → ${esc(t.toStn)} · ${esc(s.phase)}</p><p>${dateLabel(t.travelDate)} ${esc(t.dep)} 출발 예정</p><button data-alert-ticket="${esc(t.id)}">탑승 도우미 열기</button></div>`).join(''):'<p>현재 예정된 여행 알림이 없습니다.</p><p>예약한 여정이 생기면 이곳에서 확인할 수 있습니다.</p>');
   dialog.querySelectorAll('[data-alert-ticket]').forEach(b=>b.onclick=()=>{dialog.close();boarding.open(b.dataset.alertTicket);});
 }
}
let bookingStorage,settingsStorage, model, q, results=[], draft=null, selectedCar=0, changing=null, lastTicket=null, visibleCount=12, dialogFocus=null, toastTimer;
const main=$('#main'), dialog=$('#dialog');
function notify(text) {$('#message').textContent=text;$('#message').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#message').hidden=true,4500);}
function fail(error) {notify(error.message || '작업을 완료하지 못했습니다. 다시 시도하세요.');}
function go(route) {if(location.hash===`#${route}`)render();else location.hash=route;}
const notice = '';
const heading = (k,title,sub='') => `<div class="page-head"><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>`;
const grade=t=>`<span class="grade-name" style="--grade:${esc(model.data.colors[t.grade]||'#2266db')}">${esc(model.data.grades[t.grade]||t.grade)}</span> <b class="train-no">${esc(t.no)}</b>`;
const routeSummary=(t,query)=>{const seg=model.segment(t,query.from,query.to),mins=model.data.duration(seg.dep,seg.arr),showDuration=settingsStore?.get().appearance.duration!==false;return `<div class="journey-line"><div><strong>${clock(seg.dep)}</strong><span>${esc(query.from)}</span></div><div class="journey-mid"><i></i>${showDuration?`<small>${duration(mins)}${minuteOf(seg.arr)<minuteOf(seg.dep)?' · 익일':''}</small>`:''}</div><div><strong>${clock(seg.arr)}</strong><span>${esc(query.to)}</span></div></div>`;};
function queryForm(){return `<form id="search-form" class="search-card"><div class="home-fields"><div class="stations"><button type="button" class="station-control" data-station="from"><span><small>출발역</small><b>${esc(q.from)||'선택'}</b></span></button><button type="button" id="swap" class="swap" aria-label="출발역과 도착역 바꾸기">${icon('swap')}</button><button type="button" class="station-control" data-station="to"><span><small>도착역</small><b>${esc(q.to)||'선택'}</b></span></button></div><button type="button" class="date-control" id="open-date"><span><small>가는 날</small><b>${dateLabel(q.date,true)}${q.after?' '+esc(q.after):''}</b></span>${icon('calendar')}</button><button type="button" id="open-passengers" class="passenger-control"><span><small>인원</small><b>승객 ${q.pax}명 <em>· ${model.data.classes[q.cls].label}</em></b></span>${icon('user')}</button></div><button class="primary search-submit" type="submit">${changing?'변경할 열차 조회':'열차 조회하기'} <span aria-hidden="true">→</span></button></form>`;}
function searchOptions(){return `<details class="home-options" ${roundTrip?'open':''}><summary>왕복 검색 옵션</summary><div class="trip-controls"><button type="button" id="roundtrip" role="switch" aria-checked="${roundTrip}">${icon('round')}<b>왕복</b><i class="toggle"></i></button></div>${roundTrip?`<button type="button" id="return-date" class="return-date">오는 날 ${dateLabel(returnDate)} ${icon('down')}</button>`:''}</details>`;}
function datePicker(returning=false){
 showDialog(returning?'오는 날 선택':'출발일 선택',`<form id="date-form"><label>날짜<input type="date" name="date" min="${returning?q.date:kstDate()}" max="${addDays(kstDate(),30)}" value="${returning?returnDate:q.date}" required></label>${returning?'':`<label>출발 기준 시각<input type="time" name="after" value="${esc(q.after)}"></label>`}<div class="date-quick"><button type="button" data-day="0">오늘</button><button type="button" data-day="1">내일</button><button type="button" data-day="${(6-new Date(kstDate()+'T12:00:00').getDay()+7)%7}">주말</button></div><button type="submit" class="primary">선택 완료</button></form>`);
 dialog.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>$('#date-form').elements.date.value=addDays(kstDate(),+b.dataset.day));
 $('#date-form').onsubmit=e=>{e.preventDefault();const d=e.target.elements.date.value;if(returning)returnDate=d;else {q.date=d;q.after=e.target.elements.after.value;q.defaultTimeMode='manual';if(returnDate<d)returnDate=d;}dialog.close();searchPage();$(returning?'#return-date':'#open-date').focus({preventScroll:true});};
}
function stationPicker(which){
 openStationPicker({model,current:q[which],which,recent:recent(),showDialog,dialog,esc,notify,fail,onChoose:st=>{q[which]=st;searchPage();main.querySelector(`[data-station=${which}]`).focus({preventScroll:true});}});
}
function passengerPicker(){
 showDialog('인원 및 좌석 등급',`<form id="pax-form"><h3>승객 인원</h3><label>최대 6명<select name="pax">${Array.from({length:6},(_,i)=>`<option value="${i+1}" ${+q.pax===i+1?'selected':''}>${i+1}명</option>`).join('')}</select></label><h3>좌석 등급</h3><div class="class-options">${Object.entries(model.data.classes).filter(([k])=>true).map(([k,v])=>`<label class="class-option"><span>${v.label}</span><input type="radio" name="cls" value="${k}" ${q.cls===k?'checked':''}></label>`).join('')}</div><button class="primary" type="submit">적용</button></form>`);$('#pax-form').onsubmit=e=>{e.preventDefault();q.pax=+e.target.elements.pax.value;q.cls=e.target.elements.cls.value;dialog.close();searchPage();$('#open-passengers').focus({preventScroll:true});};
}
function searchPage(){
 main.innerHTML=homeView({greeting:homeGreetings.get(),q,model,tab:homeTab,queryForm,searchOptions,esc,icon,grade,dateLabel,notice,recent:recent(),boardingNext:boarding?.service.upcoming()[0],journeys:upcomingJourneys(model.read().tickets),tourFilter});
 const selectTab=(tab,focus=false)=>{homeTab=tab;searchPage();if(focus)$(`#tab-${tab}`).focus();};
 main.querySelectorAll('[data-home-tab]').forEach(b=>{b.onclick=()=>selectTab(b.dataset.homeTab,true);b.onkeydown=e=>{const tabs=['booking','pass','tour'];let index=tabs.indexOf(homeTab);if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();index=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;selectTab(tabs[index],true);}};});
 main.querySelectorAll('[data-shortcut]').forEach(b=>b.onclick=()=>{const target=b.dataset.shortcut;if(target==='tickets')go('tickets');else if(target==='guide')showDialog('이용 안내','<p>출도착역과 날짜를 선택해 열차를 조회하고 좌석을 선택하거나 바로 예매를 이용하세요. 예약은 이 브라우저에 저장됩니다.</p><a href="/NIMBYRAILTABLE/">NIMBY Rail 철도 정보 ↗</a>');else{selectTab(target);$('#home-tab-panel').scrollIntoView({block:'nearest',behavior:'smooth'});}});
 main.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{q={...q,...recent()[+b.dataset.recent]};homeTab='booking';searchPage();});
 if(homeTab!=='booking')return;
 $('#swap').onclick=()=>{[q.from,q.to]=[q.to,q.from];searchPage();};$('#open-date').onclick=()=>datePicker();$('#open-passengers').onclick=passengerPicker;
 main.querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>stationPicker(b.dataset.station));
 main.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{q={...q,...recent()[+b.dataset.recent]};searchPage();});
 $('#roundtrip').onclick=()=>{roundTrip=!roundTrip;if(!returnDate||returnDate<q.date)returnDate=q.date;searchPage();};if($('#return-date'))$('#return-date').onclick=()=>datePicker(true);
 for(const [id,key] of [['min-wait','minWait'],['max-wait','maxWait'],['transfer-limit','transferLimit']])if($('#'+id))$('#'+id).onchange=e=>q[key]=+e.target.value;
 $('#search-form').onsubmit=e=>{e.preventDefault();try{if(q.defaultTimeMode==='current')q.after=currentKstClock();model.validateQuery(q);if(roundTrip&&returnDate<q.date)throw Error('오는 날은 가는 날 이후로 선택하세요.');for(const key of ['tourSystem','tourGrade','tourProductId','tourSegmentIndex','before'])delete q[key];q.grade='all';saveRecent();visibleCount=12;journeyDrafts=[];selectingReturn=false;bookingQuery={...q};go('results');}catch(error){fail(error);}};

}
function resultPage(){
 disposeInventory();
 if(selectingReturn&&journeyDrafts.length){const d=journeyDrafts.at(-1),seg=model.segment(model.byKey.get(d.key),d.q.from,d.q.to),arrival=+model.departure(seg,d.q.date)+seg.duration*60000,earliest=dateAt(arrival),arrivalClock=clockAt(arrival);if(q.date<earliest){q.date=earliest;q.after=arrivalClock;}else if(q.date===earliest&&(!q.after||minuteOf(q.after)<minuteOf(arrivalClock)))q.after=arrivalClock;}
 if(!navigator.onLine){main.innerHTML='<div class="empty"><h2>오프라인에서는 새 열차를 조회할 수 없습니다</h2><p>저장된 승차권과 QR은 계속 확인할 수 있습니다.</p><a href="#tickets">저장된 승차권 보기</a></div>';return;}
 const tourSystem=tourismGroups(model).find(g=>g.grade===q.tourGrade)?.systems.find(s=>s.id===q.tourSystem);
 const product=tourProductById(q.tourProductId),includeTransfers=Boolean(q.includeTransfer&&!q.transfer);
 results=q.transfer?[]:model.search(q);
 if(tourSystem){const keys=new Set(tourSystem.directions.flatMap(d=>d.trains.map(t=>t.key)));results=results.filter(r=>keys.has(r.key));visibleCount=results.length;}
 transferResults=(q.transfer||includeTransfers)?model.transfers(q):[];
 if(q.showSoldOut===false){const available=leg=>{const state=model.availability(leg.train,leg.q);if(state.eligible&&state.available>=+leg.q.pax)return true;if(leg.q.cls!=='standing'){const standing=model.availability(leg.train,{...leg.q,cls:'standing'});return standing.eligible&&standing.available>=+leg.q.pax;}return false;};results=results.filter(r=>available({train:r.train,q}));transferResults=transferResults.filter(r=>r.legs.every(available));}
 const count=results.length+transferResults.length,segmentIndex=Number(q.tourSegmentIndex||0);
 const productContext=product?`<section class="tour-result-product"><small>${esc(product.name)}</small><div><b>${tourPlan?.segments?.length>2?`${segmentIndex+1}/${tourPlan.segments.length} 구간`:selectingReturn?'오는 편 선택':'가는 편 선택'}</b><span>추천 시간대 ${esc(q.after||'00:00')}~${esc(q.before||'24:00')}</span></div>${tourPlan?.segments?.length>2?`<div class="tour-progress">${tourPlan.segments.map((segment,index)=>`<i class="${segment.booked?'done':index===segmentIndex?'current':''}"></i>`).join('')}</div>`:''}</section>`:'';
 const directList=`<div id="results-list">${results.slice(0,visibleCount).map((r,i)=>trainResult({r,i,q,model,esc,grade,routeSummary,won,icon})).join('')}</div><div id="more"></div>`;
 const transferList=`<div id="transfer-results">${transferResults.map((r,i)=>transferResult({r,i,esc,grade,won,duration,clock})).join('')}</div>`;
 const directGroup=results.length&&includeTransfers?`<section class="result-route-group direct-group" aria-labelledby="direct-results-title"><header><div><h3 id="direct-results-title">직통 열차</h3><p>환승 없이 도착하는 열차</p></div><b>${results.length}건</b></header>${directList}</section>`:directList;
 const transferGroup=transferResults.length&&includeTransfers?`<section class="result-route-group transfer-group" aria-labelledby="transfer-results-title"><header><div><h3 id="transfer-results-title">환승 경로</h3><p>중간역에서 한 번 갈아타는 경로</p></div><b>${transferResults.length}건</b></header>${transferList}</section>`:transferList;
 main.innerHTML=`${selectingReturn?'<div class="info-box"><b>오는 열차를 선택하세요</b><button id="restart-journey">가는 편부터 다시 선택</button></div>':''}${productContext}${tourSystem?tourDirectionView({system:tourSystem,q,esc}):''}${resultHeader({q,count,esc,dateLabel})}${q.directFirst===false?transferGroup+directGroup:directGroup+transferGroup}${!count?`<div class="empty"><h3>조회 가능한 열차가 없습니다</h3><p>추천 시간대나 직통·환승 조건을 변경해 보세요.</p></div>`:''}<p class="fare-note">요금은 1인 기준입니다.</p>`;
 if($('#restart-journey'))$('#restart-journey').onclick=()=>{journeyDrafts=[];selectingReturn=false;q={...bookingQuery};go('search');};
 main.querySelectorAll('[data-tour-direction]').forEach(b=>b.onclick=()=>{const direction=tourSystem.directions.find(d=>d.id===b.dataset.tourDirection),t=direction.trains[0];q={...q,from:t.from,to:t.to,after:''};resultPage();});
 main.querySelectorAll('[data-query-open]').forEach(b=>b.onclick=()=>openQueryOptions(b.dataset.queryOpen));
 $('#sort').value=q.sort;$('#sort').onchange=e=>{q.sort=e.target.value;resultPage();};
 main.querySelectorAll('[data-result-date]').forEach(b=>b.onclick=()=>{q.date=b.dataset.resultDate;visibleCount=12;resultPage();});
 if(results.length>visibleCount)$('#more').innerHTML='<button class="load-more" data-action="more">열차 더 보기</button>';

 disposeInventory=observeInventory(main.querySelectorAll('[data-inventory],[data-transfer-inventory]'),el=>{
  const transfer=el.dataset.transferInventory!==undefined,r=transfer?transferResults[+el.dataset.transferInventory]:results[+el.dataset.inventory];
  if(!r)return;
  const legs=transfer?r.legs:[{train:r.train,q}],states=legs.map(l=>model.availability(l.train,l.q));
  const presentations=states.map((state,i)=>{const leg=legs[i],standing=leg.q.cls==='standing';let standingAvailable=false;if(!standing)try{const standingState=model.availability(leg.train,{...leg.q,cls:'standing'});standingAvailable=standingState.eligible&&standingState.available>=+q.pax;}catch{}return inventoryPresentation(state,+q.pax,{standing,standingAvailable});});
  const severity={relaxed:0,normal:1,crowded:2,standing:3,soldout:4},overall=presentations.reduce((worst,current)=>severity[current.tone]>severity[worst.tone]?current:worst,presentations[0]);
  el.querySelector('.inventory-status').textContent=presentations.map((item,i)=>(transfer?`${i+1}구간 `:'')+item.label).join(' · ');
  el.dataset.inventoryTone=overall.tone;el.classList.toggle('is-sold-out',presentations.some(item=>item.soldOut));
  const button=el.querySelector('[data-action="book"],[data-action="book-transfer"]'),available=states.every(state=>state.eligible&&state.available>=+q.pax);
  button.disabled=!transfer&&r.departed;if(!transfer&&r.departed){el.classList.add('is-sold-out');el.querySelector('.inventory-status').textContent='출발 완료';}else if(transfer)button.textContent=available?'예매':'등급 선택';
 },el=>{el.querySelector('.inventory-status').textContent='조회 오류 · 다시 조회해 주세요';});
}
let selectedTransfer=0;
function routeDetailPage(){const r=transferResults[selectedTransfer];if(!r){go('results');return;}main.innerHTML=transferDetail({r,index:selectedTransfer,model,esc,grade,won,duration,clock});}
function openQueryOptions(tab='conditions'){queryOptions({model,query:q,tab,showDialog,dialog,esc,onApply:next=>{next.defaultTimeMode='manual';delete next.tourSystem;delete next.tourGrade;if(next.tourProductId&&tourPlan){const index=Number(next.tourSegmentIndex||0);saveTourPlan({...tourPlan,includeTransfer:next.includeTransfer,pax:next.pax,cls:next.cls,segments:tourPlan.segments.map((segment,i)=>i===index?{...segment,from:next.from,to:next.to,date:next.date,start:next.after,end:next.before}:segment)});}q=next;visibleCount=12;resultPage();}});}
function makeDraft(key,query){return {key,q:{...query},seats:[],discount:'none',discounts:Array(+query.pax).fill('none')};}
function bookingOptions(index,transfer=false){
 const r=transfer?transferResults[index]:results[index];if(!r)return;
 const legs=transfer?r.legs:[{key:r.key,train:r.train,q:{...q}}];let cls=legs[0].q.cls;
 const supports=c=>legs.every(l=>model.data.classCars(model.data.cars(model.data.formation(l.train.grade,l.train.no)),c).length);
 const classes=[...['general','special','premium'].filter(supports),'standing'];let mixedLegs=null;
 const title=transfer?'환승 여정 예매':`${esc(r.train.grade)} ${esc(r.train.no)}`;
 showDialog(title,`<div class="booking-info-actions"><button id="booking-facilities">차내 시설</button><button id="booking-operations">운행 정보</button></div><div class="booking-option-context">${esc(q.from)} → ${esc(q.to)} · 승객 ${q.pax}명${transfer?` · ${legs.length}개 열차`:''}</div><div id="booking-classes" class="booking-class-options" role="group" aria-label="좌석 등급">${classes.map(c=>`<button data-booking-class="${c}" aria-pressed="${cls===c}">${model.data.classes[c].label}</button>`).join('')}</div><div class="booking-availability" id="booking-availability" role="status"></div><div id="booking-mixed-segments"></div><p class="booking-explanation">좌석을 직접 고르거나, 남은 좌석을 자동 배정받을 수 있습니다.</p><p id="booking-error" role="alert"></p><div class="booking-actions"><button id="choose-seats">좌석 선택</button><button id="quick-book" class="primary">바로 예매</button></div>`);
 dialog.classList.add('booking-dialog');
 $('#booking-facilities').onclick=()=>{dialog.close();setTimeout(()=>details(legs[0].train,legs[0].q),0);};
 $('#booking-operations').onclick=()=>{dialog.close();setTimeout(()=>openOperation({model,train:legs[0].train,query:legs[0].q,showDialog,dialog,esc}),0);};
 const card=main.querySelector(transfer?`[data-transfer-inventory="${index}"]`:`[data-inventory="${index}"]`);card?.classList.add('booking-selected');
 dialog.addEventListener('close',()=>{dialog.classList.remove('booking-dialog');card?.classList.remove('booking-selected');},{once:true});
 const paint=()=>{
  mixedLegs=null;
  if(cls==='standing'){
   const parts=legs.map(l=>model.flexible(l.train,l.q));
   if(parts.every(r=>r.length))mixedLegs=parts.flat().map(l=>({...l,train:model.byKey.get(l.key)}));
  }
  const effective=cls==='standing'?(mixedLegs||[]):legs.map(l=>({...l,q:{...l.q,cls}}));
  const states=effective.map(l=>model.availability(l.train,l.q)),available=states.length>0&&states.every(s=>s.eligible&&s.available>=+q.pax);
  dialog.querySelectorAll('[data-booking-class]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bookingClass===cls)));
  $('#booking-availability').innerHTML=`<span>${states.length?states.map((s,i)=>(effective.length>1?`${i+1}구간 `:'')+esc(inventoryLabel(s,+q.pax))).join(' · '):'입석·자유석 또는 입석+좌석으로 예매할 수 있는 구간이 없습니다'}</span>${effective.length?`<strong>${won(effective.reduce((sum,l)=>sum+model.data.fare(l.train,l.q.from,l.q.to,l.q.cls)*+q.pax,0))}</strong>`:''}`;
  $('#booking-mixed-segments').innerHTML=mixedLegs?mixedLegs.map(l=>`<p>${esc(l.q.from)} → ${esc(l.q.to)} · ${model.data.classes[l.q.cls].label}</p>`).join(''):'';
  $('#choose-seats').disabled=!available;const onlyStanding=cls==='standing'&&!effective.some(l=>l.q.cls!=='standing');$('#choose-seats').hidden=onlyStanding;$('#quick-book').disabled=!available;$('.booking-actions').classList.toggle('standing-only',onlyStanding);
  $('.booking-explanation').textContent=cls==='standing'?'입석·자유석과 입석+좌석을 함께 조회합니다. 좌석이 있는 구간은 좌석을 배정합니다.':'좌석을 직접 고르거나, 남은 좌석을 자동 배정받을 수 있습니다.';
  $('#booking-error').textContent='';$('#quick-book').textContent='바로 예매';$('#quick-book').onclick=()=>proceed(true);
 };
 dialog.querySelectorAll('[data-booking-class]').forEach(b=>b.onclick=()=>{cls=b.dataset.bookingClass;paint();});
 const proceed=quick=>{try{startBooking(index,transfer,{cls,quick,customLegs:mixedLegs});}catch(error){paint();$('#booking-error').textContent=error.message;}};
 $('#choose-seats').onclick=()=>proceed(false);$('#quick-book').onclick=()=>proceed(true);paint();
}
function startBooking(index,transfer=false,{cls=q.cls,quick=false,customLegs=null}={}) {
 const r=transfer?transferResults[index]:results[index];if(!r)return;
 const legs=customLegs|| (transfer?r.legs:[{key:r.key,q:{...q}}]).map(l=>({...l,q:{...l.q,cls}}));
 if(!navigator.onLine)throw Error('인터넷 연결 후 예매할 수 있습니다.');
 for(const l of legs){
  const train=model.byKey.get(l.key),state=model.availability(train,l.q);
  if(model.departure(model.segment(train,l.q.from,l.q.to),l.q.date)<=new Date())throw Error('이미 출발한 열차입니다. 다른 열차를 선택하세요.');
  if(!state.eligible||state.available<+l.q.pax)throw Error('좌석 상태가 변경되었습니다. 다른 등급이나 열차를 선택하세요.');
 }
 const pending=legs.map(l=>makeDraft(l.key,l.q));let split=false;
 if(quick)pending.filter(d=>d.q.cls!=='standing').forEach(d=>{const assigned=model.autoAssign(model.byKey.get(d.key),d.q,seatOptions(settingsStore.get()));d.seats=assigned.seats;split ||= assigned.split;});
 const proceed=()=>{
  try{
   if(!navigator.onLine)throw Error('인터넷 연결 후 예매할 수 있습니다.');
   for(const d of pending){const t=model.byKey.get(d.key),state=model.availability(t,d.q);if(model.departure(model.segment(t,d.q.from,d.q.to),d.q.date)<=new Date())throw Error('이미 출발한 열차입니다.');if(!state.eligible||state.available<+d.q.pax)throw Error('좌석 상태가 변경되었습니다. 다른 등급이나 열차를 선택하세요.');if(quick){const free=new Set(model.seats(t,d.q).flatMap(c=>c.seats).filter(s=>!s.blocked).map(s=>s.id));if(d.seats.some(id=>!free.has(id)))throw Error('자동 배정한 좌석의 상태가 변경되었습니다. 다시 선택하세요.');}}
  }catch(error){$('#booking-error').textContent=error.message;return;}
  dialog.close();
  if(!selectingReturn){journeyDrafts=[];bookingType=roundTrip?'roundtrip':customLegs?.some(l=>l.q.cls==='standing')&&customLegs.some(l=>l.q.cls!=='standing')?'mixed':transfer?'transfer':'single';}
  const offset=journeyDrafts.length;journeyDrafts.push(...pending);journeyIndex=quick?journeyDrafts.length-1:offset;draft=journeyDrafts[journeyIndex];selectedCar=0;
  if(quick)nextJourneySeat();else go('seats');
 };
 if(split){
  // Keep the assignment review in the same sheet so closing it leaves the draft untouched.
  $('#booking-error').textContent='일행을 같은 줄에 배정하기 어려워 좌석이 나뉩니다. '+pending.map(d=>d.seats.join(', ')).join(' / ');
  $('#quick-book').textContent='분리 좌석으로 계속';$('#quick-book').onclick=proceed;
 }else proceed();
}
function nextJourneySeat(){
 if(draft.q.cls!=='standing'&&draft.seats.length!==+draft.q.pax)return;
 if(journeyIndex<journeyDrafts.length-1){draft=journeyDrafts[++journeyIndex];selectedCar=0;seatsPage();}
 else if(roundTrip&&!selectingReturn&&!changing){
  const first=journeyDrafts[0].q,last=journeyDrafts.at(-1),seg=model.segment(model.byKey.get(last.key),last.q.from,last.q.to),arrival=+model.departure(seg,last.q.date)+seg.duration*60000;
  returnDate=returnDate<dateAt(arrival)?dateAt(arrival):returnDate;
  const returnSegment=tourPlan?.productId===bookingQuery.tourProductId?tourPlan.segments[1]:null;
  q={...bookingQuery,from:first.to,to:first.from,date:returnDate,after:returnSegment?.start||'',before:returnSegment?.end||'',grade:'all',family:'all',tourSegmentIndex:returnSegment?1:bookingQuery.tourSegmentIndex};
  // Transfer outbound origin/destination come from the original search, not its first leg.
  q.from=bookingQuery.to;q.to=bookingQuery.from;if(q.date===dateAt(arrival)&&(!q.after||minuteOf(q.after)<minuteOf(clockAt(arrival))))q.after=clockAt(arrival);
  selectingReturn=true;go('results');
 }else go('passengers');
}
function seatsPage(){
 if(!draft){go('search');return;}
 const t=model.byKey.get(draft.key),cars=model.seats(t,draft.q),seg=model.segment(t,draft.q.from,draft.q.to);
 if(!draft.carVisited){selectedCar=Math.max(0,cars.findIndex(c=>c.seats.some(s=>!s.blocked)));draft.carVisited=true;}
 const car=cars[selectedCar]||cars[0];
 if(draft.q.cls==='standing'){const state=model.availability(t,draft.q);if(!state.eligible||state.available<+draft.q.pax)throw Error('입석 잔여석이 부족합니다.');draft.seats=[];nextJourneySeat();return;}
 if(!car)throw new Error('이 열차에는 선택한 등급의 객실이 없습니다.');
 const classes=Object.keys(model.data.classes).filter(c=>c==='standing'||model.data.classCars(model.data.cars(model.data.formation(t.grade,t.no)),c).length);
 const prefs=settingsStore.get().seat,preference=prefs.position!=='none'?prefs.position:prefs.direction!=='none'?prefs.direction:prefs.adjacent?'together':'random';
 main.innerHTML=seatsView({train:t,cars,selectedCar,draft,classes,model,esc,grade,won,clock,journeyIndex,journeyCount:journeyDrafts.length,sameTrainJourney:bookingType==='mixed',preference});
 const strip=$('.car-cards'),selected=strip.querySelector('[aria-pressed=true]');strip.scrollLeft=selected.offsetLeft-strip.offsetLeft-(strip.clientWidth-selected.clientWidth)/2;
 main.querySelectorAll('[data-seat-class]').forEach(b=>b.onclick=()=>{draft.q.cls=b.dataset.seatClass;draft.seats=[];draft.carVisited=false;selectedCar=0;seatsPage();});$('#auto-seat').onclick=()=>{try{const assigned=model.autoAssign(t,draft.q,$('#seat-preference').value);const apply=()=>{draft.seats=assigned.seats;selectedCar=Math.max(0,cars.findIndex(c=>c.seats.some(s=>assigned.seats.includes(s.id))));seatsPage();};if(assigned.split||!assigned.preferenceMet){showDialog('자동 배정 조건 확인',`<p>${assigned.split?'일행을 같은 줄에 배정할 수 없어 분리 배정합니다.':''} ${!assigned.preferenceMet?'일부 좌석은 선택한 선호 조건과 다릅니다.':''}</p><p>${assigned.seats.map(esc).join(', ')}</p><button id="accept-auto" class="primary">이 좌석 사용</button>`);$('#accept-auto').onclick=()=>{dialog.close();apply();};}else apply();}catch(error){fail(error);}};updateSelected();
}
function updateSelected() {$('#selected-count').textContent=draft.seats.length+'석 선택';$('#selected-labels').textContent=draft.seats.join(', ')||'좌석을 선택하세요';$('#next-passengers').disabled=draft.seats.length!==+draft.q.pax;document.querySelectorAll('.seat[data-value]').forEach(b=>b.setAttribute('aria-pressed',String(draft.seats.includes(b.dataset.value))));}
function passengerPage() {
 if(!draft||journeyDrafts.some(d=>d.q.cls!=='standing'&&d.seats.length!==+d.q.pax)){go('seats');return;}
 const first=journeyDrafts[0];
 main.innerHTML=heading('','인원 및 할인 확인','승객별 할인 유형을 확인해 주세요.')+`<form id="passenger-form" class="panel">${Array.from({length:+first.q.pax},(_,i)=>`<fieldset><legend>승객 ${i+1}</legend><label>할인 유형<select name="discount${i}">${Object.entries(model.data.discounts).map(([k,d])=>`<option value="${k}" ${first.discounts?.[i]===k?'selected':''}>${esc(d.label)}${d.rate?` · ${d.rate*100}%`:''}</option>`).join('')}</select></label></fieldset>`).join('')}<div class="button-row"><button type="button" data-action="nav" data-value="seats">좌석 다시 선택</button><button class="primary" type="submit">예매 정보 확인</button></div></form>`;
 $('#passenger-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),discounts=Array.from({length:+first.q.pax},(_,i)=>f.get('discount'+i));journeyDrafts.forEach(d=>Object.assign(d,{discounts:[...discounts],discount:discounts[0]}));go('review');};
}
function reviewPage(){
 if(!draft||journeyDrafts.some(d=>!d.discounts?.length)){go('passengers');return;}
 const old=changing?model.read().tickets.find(t=>t.id===changing):null;
 const amounts=journeyDrafts.map(d=>{const t=model.byKey.get(d.key),fare=model.data.fare(t,d.q.from,d.q.to,d.q.cls);return {base:fare*+d.q.pax,total:d.discounts.reduce((sum,discount)=>sum+model.data.discount(fare,discount),0)};}),base=amounts.reduce((s,a)=>s+a.base,0),total=amounts.reduce((s,a)=>s+a.total,0);
 const mixed=bookingType==='mixed';
 main.innerHTML=`<h2>${mixed?'한 열차의 좌석 이용 확인':'전체 여정 확인'}</h2><p class="micro">${mixed?`열차는 바뀌지 않습니다. 같은 열차 안에서 ${journeyDrafts.length}개 구간의 좌석 이용 방식만 변경됩니다.`:`${journeyDrafts.length}구간을 한 번에 저장합니다. 한 구간이라도 예약할 수 없으면 전체를 저장하지 않습니다.`}</p>${old?`<section class="panel comparison-old"><h3>기존 승차권</h3><p>${esc(old.grade)} ${esc(old.trainNo)} · ${old.travelDate}</p><b>${old.dep} ${esc(old.fromStn)} → ${old.arr} ${esc(old.toStn)}</b><p>${old.seats.map(esc).join(', ')}</p></section>`:''}${journeyDrafts.map((d,i)=>{const t=model.byKey.get(d.key);return `<section class="review-journey"><div class="card-top"><div>${i===0||!mixed?grade(t):''}<p>${dateLabel(d.q.date)} · ${mixed?'좌석 이용 ':''}${i+1}구간</p></div><button data-edit-leg="${i}">수정</button></div>${routeSummary(t,d.q)}<div class="review-seat">${model.data.classes[d.q.cls].label} · ${d.q.cls==='standing'?'지정 좌석 없음':d.seats.map(esc).join(', ')}</div><p>${won(amounts[i].total)}</p></section>`;}).join('')}<section class="review-section"><h3>승객 정보</h3>${draft.discounts.map((d,i)=>`<p>승객 ${i+1} · ${esc(model.data.discounts[d].label)}</p>`).join('')}</section><section class="review-section"><h3>요금 내역</h3><dl class="summary"><div><dt>운임</dt><dd>${won(base)}</dd></div><div><dt>할인</dt><dd>${won(base-total)}</dd></div>${old?`<div><dt>변경 차액</dt><dd>${won(total-old.totalFare)}</dd></div>`:''}<div class="total"><dt>총 결제 금액</dt><dd>${won(total)}</dd></div></dl></section><form id="confirm-form"><section class="review-section"><label class="check"><input type="checkbox" required>승차권 발매 조건에 동의합니다.</label></section><div class="review-footer"><button class="primary" type="submit">${old?'변경 확정':mixed?'입석+좌석 승차권 발매':journeyDrafts.length>1?'전체 여정 승차권 발매':'승차권 발매'}</button></div></form>`;
 main.querySelectorAll('[data-edit-leg]').forEach(b=>b.onclick=()=>{journeyIndex=+b.dataset.editLeg;draft=journeyDrafts[journeyIndex];selectedCar=0;go('seats');});
 $('#confirm-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{const tourId=journeyDrafts[0]?.q.tourProductId,tourIndex=Number(journeyDrafts[0]?.q.tourSegmentIndex||0);const commit=async()=>{await bookingStorage.refresh();return model.bookMany(journeyDrafts,{replaceId:changing,type:bookingType});};lastTickets=await(navigator.locks?navigator.locks.request('raillink-booking',commit):commit());lastTicket=lastTickets[0];completedTourSegment=false;if(tourPlan&&tourId&&tourPlan.productId===tourId){if(tourPlan.segments.length>2){saveTourPlan(markTourSegmentBooked(tourPlan,tourIndex,lastTickets.map(t=>t.id)));completedTourSegment=true;}else saveTourPlan({...tourPlan,segments:tourPlan.segments.map(segment=>({...segment,booked:true,ticketIds:lastTickets.map(t=>t.id)}))});}ticketFilter='active';ticketDate='';roundTrip=false;selectingReturn=false;returnJourney=null;draft=null;journeyDrafts=[];changing=null;go('complete');}catch(error){fail(error);button.disabled=false;}};
}
function completePage(){
 if(!lastTicket){go('tickets');return;}
 const mixed=isSameTrainSeatJourney(lastTickets),t=mixed?combinedTicket(lastTickets):lastTicket,train=model.byKey.get(t.key),query={from:t.fromStn,to:t.toStn,date:t.travelDate};
 const nextTour=completedTourSegment&&tourPlan?nextUnbookedTourSegment(tourPlan):-1,product=tourProductById(tourPlan?.productId);
 const mixedSegments=mixed?seatSegments(t):[];
 const mixedPlan=mixed?`<section class="panel mixed-complete"><b>${esc(t.grade)} ${esc(t.trainNo)} · 같은 열차 계속 이용</b><p>열차에서 내리지 않고 아래 역부터 좌석 이용 방식만 바뀝니다.</p>${mixedSegments.map(item=>`<p><strong>${esc(item.fromStn)} → ${esc(item.toStn)}</strong> · ${esc(model.data.classes[item.seatClass]?.label||item.seatClass)} · ${esc(item.seats.join(' · ')||'지정 좌석 없음')}</p>`).join('')}<a href="#tickets">승차권 보기</a></section>`:lastTickets.length>1?`<section class="panel">${lastTickets.map(item=>`<p>${esc(item.grade)} ${esc(item.trainNo)} · ${esc(item.travelDate)} ${esc(item.dep)} ${esc(item.fromStn)} → ${esc(item.arr)} ${esc(item.toStn)}</p>`).join('')}<a href="#tickets">통합 승차권 보기</a></section>`:'';
 const seatSummary=mixed?mixedSegments.map((item,i)=>`<p>${i===0?icon('seat'):''}<b>${esc(item.fromStn)} → ${esc(item.toStn)}</b> · ${esc(model.data.classes[item.seatClass]?.label||item.seatClass)} · ${esc(item.seats.join(' · ')||'지정 좌석 없음')}</p>`).join(''):`<p>${icon('seat')}${model.data.classes[t.seatClass].label} · ${t.seats.map(esc).join(', ')}</p>`;
 main.innerHTML=`<div class="completion-heading"><div class="success-mark">${icon('check')}</div><h2>${nextTour>=0?'구간 예매가 완료되었습니다':'예약이 완료되었습니다'}</h2><p>${mixed?'입석+좌석 승차권 1매가 저장되었습니다.':`승차권 ${lastTickets.length||1}개가 저장되었습니다.`}${nextTour>=0?` 전체 ${tourPlan.segments.length}개 중 ${tourPlan.segments.filter(segment=>segment.booked).length}개 구간을 예매했습니다.`:''}</p></div>${mixedPlan}<div class="reservation-number"><span>예약번호</span><b>${esc(t.id.slice(3,11).toUpperCase())}</b></div><section class="complete-ticket"><div class="card-top"><div>${grade(train)}</div><span>${dateLabel(t.travelDate)}</span></div>${routeSummary(train,query)}<div class="complete-meta">${seatSummary}<p>${icon('user')}승객 ${t.passengerCount}명</p></div><div class="complete-total"><span>${mixed?'승차권':'전체 여정'} 결제 금액</span><b>${won(t.totalFare)}</b></div></section><div class="payment-option completion-payment">${icon('card')}<b>결제 완료</b></div>${nextTour>=0?`<button class="primary complete-action" id="book-next-tour-segment">${esc(product?.shortName||'여행')} 다음 구간 조회</button><p class="notice">남은 구간은 각각 열차와 좌석을 선택해 예매합니다.</p>`:'<button class="primary complete-action" data-action="nav" data-value="tickets">승차권 확인</button>'}<button class="outline complete-action" data-action="nav" data-value="tickets">예매 내역으로</button>${returnJourney?'<button class="outline complete-action" id="book-return">오는 열차 조회</button>':''}<p class="notice">승차 전 출발 시각과 승강장을 확인해 주세요.</p>`;
 if($('#book-return'))$('#book-return').onclick=()=>{q={...q,...returnJourney,grade:'all',family:'all',after:''};returnJourney=null;go('results');};
 if($('#book-next-tour-segment'))$('#book-next-tour-segment').onclick=()=>{const index=nextUnbookedTourSegment(tourPlan);if(index<0){go('tickets');return;}q={...q,...tourSegmentQuery(tourPlan,index),minWait:3,maxWait:60,transferLimit:20};bookingQuery={...q};completedTourSegment=false;visibleCount=12;go('results');};
}
let ticketFilter='active',ticketDate='',ticketCalendar=false,ticketMonth=kstDate().slice(0,7);
function ticketsPage(){
 const now=Date.now(),offline=!navigator.onLine;
 const delayState=t=>{const legs=boarding?.service.journey(t.id,now,offline)||[],exact=legs.find(l=>l.ticket.id===t.id);if(exact)return exact;return legs.length?{...legs[0],arrivalDelay:legs.at(-1).arrivalDelay,delayConfirmed:legs.every(leg=>leg.delayConfirmed)}:null;};
 main.innerHTML=ticketsView({model,esc,grade,won,icon,filter:ticketFilter,date:ticketDate,calendar:ticketCalendar,month:ticketMonth,delayState});
 main.querySelectorAll('[data-ticket-filter]').forEach(b=>b.onclick=()=>{ticketFilter=b.dataset.ticketFilter;ticketsPage();});
 if($('#history-status'))$('#history-status').onchange=e=>{ticketFilter=e.target.value;ticketsPage();};
 $('#calendar-toggle').onclick=()=>{ticketCalendar=!ticketCalendar;if(!ticketCalendar)ticketDate='';ticketsPage();};
 if($('#ticket-month'))$('#ticket-month').onchange=e=>{if(e.target.value){ticketMonth=e.target.value;ticketDate='';ticketsPage();}};
 if($('#ticket-date'))$('#ticket-date').onchange=e=>{ticketDate=e.target.value;ticketsPage();};
 main.querySelectorAll('[data-ticket-day]').forEach(b=>b.onclick=()=>{ticketDate=b.dataset.ticketDay;ticketsPage();});
}
function ticketBoardingPlace(t,assistant=boarding?.service.journey(t.id,Date.now(),!navigator.onLine).find(l=>l.ticket.id===t.id)){
 return assistant?assistant.stage==='BEFORE_BOARDING'?`<small>타는 곳</small><b>${assistant.platform==null?'미정':esc(assistant.platform)+'번'}</b>`:assistant.stage==='ON_BOARD'?`<small>다음 정차역</small><b>${esc(assistant.next?.s||'확인 중')}</b><small>${assistant.next?clockAt(assistant.next.arrTime??assistant.next.depTime)+' 예정':''}</small>`:`<small>운행 상태</small><b>도착 확인 중</b>`:'';
}
function ticketDelayLabel(minutes,confirmed=false){return minutes>0?`(${minutes}분 지연${confirmed?'':' 예상'})`:'';}
function refreshTicketBoardingPlace(){
 const target=$('#ticket-boarding-place');if(!dialog.open||!target||document.visibilityState!=='visible')return;
 const tickets=model.read().tickets,t=tickets.find(t=>t.id===dialog.dataset.ticketId);if(!t){dialog.close();return;}
 const group=orderedTicketGroup(tickets,t),mixed=isSameTrainSeatJourney(group),legs=boarding?.service.journey(group[0].id,Date.now(),!navigator.onLine)||[];
 const assistant=mixed?legs[activeLegIndex(legs)]:legs.find(l=>l.ticket.id===t.id),first=legs[0]||assistant,last=legs.at(-1)||assistant;
 target.innerHTML=ticketBoardingPlace(assistant?.ticket||t,assistant);
 const departureDelay=dialog.querySelector('[data-ticket-departure-delay]'),arrivalDelay=dialog.querySelector('[data-ticket-arrival-delay]');
 if(departureDelay)departureDelay.textContent=ticketDelayLabel(first?.departureDelay||0,first?.delayConfirmed);
 if(arrivalDelay)arrivalDelay.textContent=ticketDelayLabel(last?.arrivalDelay||0,last?.delayConfirmed);
 if($('#ticket-boarding'))$('#ticket-boarding').disabled=t.status!=='active';
}
function showTicketQR(id){
 const tickets=model.read().tickets,selected=tickets.find(t=>t.id===id);if(!selected)return;
 const group=orderedTicketGroup(tickets,selected),mixed=isSameTrainSeatJourney(group),t=mixed?combinedTicket(group):selected,train=model.byKey.get(t.key),state=journeyState(t),label=t.status==='cancelled'?'환불 완료':state.label;
 const groupIndex=group.findIndex(item=>item.id===selected.id),legs=boarding?.service.journey(group[0].id,Date.now(),!navigator.onLine)||[];
 const assistant=mixed?legs[activeLegIndex(legs)]:legs.find(l=>l.ticket.id===selected.id),firstAssistant=legs[0]||assistant,lastAssistant=legs.at(-1)||assistant;
 const boardingPlace=ticketBoardingPlace(assistant?.ticket||t,assistant);
 const departureDelay=ticketDelayLabel(firstAssistant?.departureDelay||0,firstAssistant?.delayConfirmed),arrivalDelay=ticketDelayLabel(lastAssistant?.arrivalDelay||0,lastAssistant?.delayConfirmed);
 const seats=!mixed&&train?model.seats(train,{from:t.fromStn,to:t.toStn,date:t.travelDate,pax:t.passengerCount,cls:t.seatClass}).flatMap(c=>c.seats):[];
 const stateIcon=state.phase==='completed'?'check':state.phase==='riding'||state.phase==='arriving'?'search':'clock';
 const stateDetail=t.status==='cancelled'?'환불 처리가 완료됐어요':state.phase==='completed'?'이용한 여정을 확인하세요':state.phase==='riding'||state.phase==='arriving'?`${esc(t.toStn)}까지 안내를 확인하세요`:`${esc(t.fromStn)}에서 출발하는 승차권이에요`;
 const segments=mixed?seatSegments(t):[];
 const passengerRows=Array.from({length:t.passengerCount},(_,i)=>{const discount=esc(model.data.discounts[t.discounts?.[i]||t.discount||'none']?.label||'일반');if(mixed)return `<div class="ticket-passenger ticket-passenger-mixed"><strong>${discount}</strong><div class="ticket-seat-plan">${segments.map(item=>`<span><small>${esc(item.fromStn)} → ${esc(item.toStn)}</small><b>${esc(model.data.classes[item.seatClass]?.label||item.seatClass)} · ${esc(item.seats[i]||'지정 좌석 없음')}</b></span>`).join('')}</div></div>`;const seat=t.seats[i],parts=seat?.split(' ')||[],direction=seats.find(s=>s.id===seat);return `<div class="ticket-passenger"><strong>${discount}</strong><div><span><small>호차</small><b>${esc(parts[0]||'입석')}</b> ${esc(model.data.classes[t.seatClass]?.label)}</span><span><small>좌석</small><b>${esc(parts.slice(1).join(' ')||'미지정')}</b>${direction?`<small class="ticket-seat-direction">${direction.reverse?'역방향':'순방향'}</small>`:''}</span></div></div>`;}).join('');
 showDialog('승차권',`<div class="ticket-state-banner" data-phase="${esc(state.phase)}"><span class="ticket-state-icon">${icon(stateIcon)}</span><span><b>${esc(label)}</b><small>${stateDetail}</small></span></div><section class="mobile-ticket ${state.eligible?'ticket-untraveled':'ticket-used'}" style="--ticket-grade:${esc(model.data.colors[t.grade]||'#1168ad')}"><header><b>${esc(t.travelDate.replaceAll('-','.'))}</b><span>${mixed?'입석+좌석 승차권':'기차승차권'} ${t.passengerCount}매</span></header><div class="ticket-paper"><div class="ticket-route"><div><span>${esc(t.fromStn)}</span><b>${esc(t.dep)}</b><small class="ticket-delay" data-ticket-departure-delay>${departureDelay}</small></div><i>→</i><div><span>${esc(t.toStn)}</span><b>${esc(t.arr)}</b><small class="ticket-delay" data-ticket-arrival-delay>${arrivalDelay}</small></div></div><div class="ticket-train-heading"><div><h3>${train?grade(train):esc(t.grade)+' '+esc(t.trainNo)}</h3>${mixed?'<small class="ticket-same-train-label">같은 열차를 계속 이용합니다</small>':''}<div class="ticket-train-actions"><button id="qr-formation" ${train?'':'disabled'}>차내 시설 ›</button><button id="ticket-operation" ${train?'':'disabled'}>운행 정보 ›</button></div></div><aside id="ticket-boarding-place">${boardingPlace}</aside></div>${mixed?'<p class="ticket-same-train-note">열차에서 내리지 않고 안내된 역부터 좌석 이용 방식만 변경하세요.</p>':''}${passengerRows}<div class="ticket-stub"><div><small>승차권 번호</small><b>${esc(t.id)}</b><button id="ticket-receipt">영수증 보기 ›</button></div>${ticketQR(t.id)}</div></div></section><div class="ticket-document-actions"><button id="ticket-boarding" ${t.status==='active'?'':'disabled'}>스마트 탑승 도우미</button></div>${!mixed&&group.length>1?`<nav class="ticket-segment-nav" aria-label="여정 승차권"><button data-ticket-segment="${groupIndex-1}" ${groupIndex===0?'disabled':''}>‹ 이전</button><span>${groupIndex+1} / ${group.length}구간</span><button data-ticket-segment="${groupIndex+1}" ${groupIndex===group.length-1?'disabled':''}>다음 ›</button></nav>`:''}`);
 dialog.dataset.ticketId=group[0].id;dialog.classList.add('ticket-dialog');dialog.addEventListener('close',()=>{dialog.classList.remove('ticket-dialog');delete dialog.dataset.ticketId;},{once:true});
 const query={from:t.fromStn,to:t.toStn,date:t.travelDate,pax:t.passengerCount,cls:t.seatClass};
 $('#qr-formation').onclick=()=>{dialog.close();setTimeout(()=>details(train,query,t),0);};
 $('#ticket-operation').onclick=()=>{dialog.close();setTimeout(()=>openOperation({model,train,query,showDialog,dialog,esc}),0);};
 $('#ticket-boarding').onclick=()=>{dialog.close();boarding.open(group[0].id);};
 dialog.querySelectorAll('[data-ticket-segment]').forEach(b=>b.onclick=()=>showTicketQR(group[+b.dataset.ticketSegment].id));
 $('#ticket-receipt').onclick=()=>{dialog.close();setTimeout(()=>showReceipt(group[0].id),0);};
}
function showReceipt(id){const tickets=model.read().tickets,selected=tickets.find(t=>t.id===id);if(!selected)return;const group=orderedTicketGroup(tickets,selected),mixed=isSameTrainSeatJourney(group),t=mixed?combinedTicket(group):selected,segments=mixed?seatSegments(t):[];showDialog('영수증',`<p>${esc(t.grade)} ${esc(t.trainNo)} · ${esc(t.travelDate)}</p><p>${esc(t.fromStn)} → ${esc(t.toStn)}</p>${mixed?`<p>입석+좌석 승차권 1매 · 같은 열차 좌석 ${segments.length}구간</p>${segments.map(item=>`<p>${esc(item.fromStn)} → ${esc(item.toStn)} · ${esc(model.data.classes[item.seatClass]?.label||item.seatClass)}</p>`).join('')}`:''}<dl class="summary"><div><dt>결제 금액</dt><dd>${won(t.totalFare)}</dd></div></dl>`);}
function showDialog(title,body) {if(!dialog.open)dialogFocus=document.activeElement;dialog.innerHTML=`<header class="dialog-head"><h2 id="dialog-title">${title}</h2><button id="close-dialog" aria-label="닫기">×</button></header><div class="dialog-body">${body}</div>`;$('#close-dialog').onclick=()=>dialog.close();dialog.showModal();}
dialog.addEventListener('close',()=>dialogFocus?.isConnected&&dialogFocus.focus());
function details(t,query,ticket=null) {
 const cars=model.data.cars(model.data.formation(t.grade,t.no));
 showDialog(`${esc(t.grade)} ${esc(t.no)} · 차내 시설`,`<div class="facility-list">${cars.map(c=>`<div><b>${c.car}호차 · ${esc(c.label)}</b><p>${(c.tags||[]).map(esc).join(' · ')}</p>${c.facilities?`<p>앞쪽: ${c.facilities.start.map(f=>esc(f.label)).join(' · ')||'등록 시설 없음'}</p><p>뒤쪽: ${c.facilities.end.map(f=>esc(f.label)).join(' · ')||'등록 시설 없음'}</p>`:`<p>${c.cafe?'카페객차':'세부 시설 위치 미등록'}</p>`}${c.notice?`<small>${esc(c.notice)}</small>`:''}</div>`).join('')}</div>`);
}
function tourRoutesPage(){main.innerHTML=tourSystemsView({model,esc,grade:selectedTourGrade,date:q.date});}
function tourProductPage(){const product=tourProductById(selectedTourProductId);if(!product){go('travel');return;}main.innerHTML=tourProductDetailView({product,model,esc});}
function tourItineraryPage(){
 const product=tourProductById(selectedTourProductId);if(!product){go('travel');return;}
 const existing=tourPlan?.productId===product.id?tourPlan:null,date=existing?.date>=kstDate()?existing.date:q.date>=kstDate()?q.date:kstDate(),durationId=selectedTourDuration||existing?.durationId||product.defaultDuration;
 main.innerHTML=tourItineraryView({product,model,esc,date,durationId});
 $('#tour-plan-form').onsubmit=e=>{e.preventDefault();try{
  const values=Object.fromEntries(new FormData(e.target)),includeTransfer=new FormData(e.target).has('includeTransfer');
  if(!product.segments)model.validateQuery({...q,from:values.from.trim(),to:values.to.trim(),date:values.date,pax:+values.pax,cls:values.cls,after:values.outStart,before:values.outEnd});
  else {model.validateQuery({...q,from:values.from.trim(),to:values.to.trim(),date:values.date,pax:+values.pax,cls:values.cls,after:product.segments[0].start,before:product.segments[0].end});const missing=[...new Set(product.segments.slice(1).flatMap(segment=>[segment.from,segment.to]).filter(station=>!model.stations.includes(station)))];if(missing.length)throw Error(`${missing.join(', ')} 역이 열차 DB에 없어 일정을 조회할 수 없습니다.`);}
  let plan=buildTourPlan(product,{date:values.date,durationId:values.durationId,from:values.from.trim(),to:values.to.trim(),pax:+values.pax,cls:values.cls,includeTransfer});
  if(!product.segments)plan={...plan,segments:plan.segments.map((segment,index)=>index===0?{...segment,start:values.outStart,end:values.outEnd}:{...segment,start:values.returnStart,end:values.returnEnd})};
  saveTourPlan(plan);q={...q,...tourSegmentQuery(plan,0),minWait:3,maxWait:60,transferLimit:20};roundTrip=!product.segments;returnDate=plan.segments.at(-1).date;selectingReturn=false;changing=null;journeyDrafts=[];bookingQuery={...q};visibleCount=12;go('results');
 }catch(error){fail(error);}};
}
function travelPage() {
  const state=model.read();
  main.innerHTML=heading('NIMBIRAIL TICKET · 여행','조금 다른 기차 여행','관광열차와 지역별 여행 일정을 만나보세요.')+`${tourismView({model,esc,date:q.date,filter:tourFilter})}<h3>자주 가는 구간</h3><p class="muted">자주 이용하는 구간을 저장해 빠르게 조회하세요. </p><div class="panel"><form id="route-form"><div class="form-row"><label>출발역<input name="from" list="travel-stations" required></label><label>도착역<input name="to" list="travel-stations" required></label></div><datalist id="travel-stations">${model.stations.map(s=>`<option value="${esc(s)}"></option>`).join('')}</datalist><button type="submit">구간 저장 ＋</button></form></div><div>${state.routes.map((r,i)=>`<div class="saved-route"><button data-action="saved-route" data-index="${i}">${esc(r.from)} → ${esc(r.to)} <span>조회 →</span></button><button data-action="remove-route" data-index="${i}" aria-label="${esc(r.from)} ${esc(r.to)} 구간 삭제">×</button></div>`).join('')}</div>`+notice;
  $('#route-form').onsubmit=async e=>{e.preventDefault();try{const r=Object.fromEntries(new FormData(e.target));model.validateQuery({...q,...r,date:kstDate()});const current=model.read();if(!current.routes.some(x=>x.from===r.from&&x.to===r.to))current.routes.push(r);await model.save(current);render();notify('구간을 저장했습니다.');}catch(error){fail(error);}};
}
function myPage() {
  const state=model.read();main.innerHTML=moreView({state})+`<section class="settings-section"><h3>앱</h3><div class="settings-group"><button class="setting-row" id="install-app"><span><b>레일링크 앱 설치</b><small>지원되는 브라우저에서 홈 화면에 추가</small></span><span>›</span></button></div></section>${state.watches.length?`<section class="settings-section"><h3>좌석 대기 기록</h3><div class="settings-group">${state.watches.map(w=>`<div class="setting-row"><span><b>${esc(w.q.from)} → ${esc(w.q.to)}</b><small>${esc(w.q.date)} · 앱을 열어 잔여석 다시 확인</small></span><button data-action="watch-search" data-value="${w.id}">조회</button><button data-action="remove-watch" data-value="${w.id}">삭제</button></div>`).join('')}</div></section>`:''}`;
  $('#install-app').onclick=()=>installApp(showDialog);
}
function settingsPage(){const state=model.read();main.innerHTML=settingsMainView({settings:settingsStore.get(),routeCount:state.routes.length});}
function saveSettings(section,form){const next=settingsStore.get(),values=Object.fromEntries(new FormData(form));Object.assign(next[section],values);return settingsStore.save(next);}
function settingsSearchPage(){main.innerHTML=searchSettingsView({settings:settingsStore.get(),model,esc});$('#settings-search-form').onsubmit=async e=>{e.preventDefault();try{const form=e.target,next=settingsStore.get(),values=Object.fromEntries(new FormData(form));Object.assign(next.search,values,{fromStationId:values.from,toStationId:values.to,pax:+values.pax,showSoldOut:form.elements.showSoldOut.checked,hideDeparted:form.elements.hideDeparted.checked});await settingsStore.save(next);q=queryFromSettings(settingsStore.get(),model,kstDate());notify('기본 검색 설정을 저장했습니다.');go('settings');}catch(error){fail(error);}};}
function settingsSeatPage(){main.innerHTML=seatSettingsView({settings:settingsStore.get()});$('#settings-seat-form').onsubmit=async e=>{e.preventDefault();try{const form=e.target,next=settingsStore.get(),values=Object.fromEntries(new FormData(form));Object.assign(next.seat,{position:values.position,direction:values.direction,adjacent:form.elements.adjacent.checked,allowAlternative:form.elements.allowAlternative.checked});Object.assign(next.transfer,{minWait:+values.minWait,riskAlerts:form.elements.riskAlerts.checked});await settingsStore.save(next);notify('좌석과 환승 선호를 저장했습니다.');go('settings');}catch(error){fail(error);}};}
function settingsAlertsPage(){const support=!('Notification' in window)?'이 브라우저는 기기 알림을 지원하지 않습니다.':Notification.permission==='granted'?'기기 알림 권한이 허용되어 있습니다.':Notification.permission==='denied'?'기기 알림 권한이 차단되어 있습니다.':'기기 알림을 켤 때 권한을 요청합니다.';main.innerHTML=alertsSettingsView({settings:settingsStore.get(),permission:support});$('#settings-alerts-form').onsubmit=async e=>{e.preventDefault();try{const form=e.target,next=settingsStore.get(),wanted=form.elements.system.checked;if(wanted&&(!('Notification' in window)||await Notification.requestPermission()!=='granted')){form.elements.system.checked=false;throw Error('기기 알림 권한이 허용되지 않았습니다. 앱 안 알림은 계속 사용할 수 있습니다.');}Object.assign(next.notifications,{enabled:form.elements.enabled.checked,system:form.elements.system.checked,departure:[...form.querySelectorAll('[name=departure]:checked')].map(x=>+x.value),delay:form.elements.delay.checked,cancel:form.elements.delay.checked,platform:form.elements.platform.checked,transferRisk:form.elements.transferRisk.checked,arrival:form.elements.arrival.checked});await settingsStore.save(next);notify('알림 설정을 저장했습니다.');go('settings');}catch(error){fail(error);}};}
function settingsBoardingPage(){main.innerHTML=boardingSettingsView({settings:settingsStore.get()});$('#settings-boarding-form').onsubmit=async e=>{e.preventDefault();try{const next=settingsStore.get();for(const key of ['countdown','nextStop','arrivalTime','platform'])next.boarding[key]=e.target.elements[key].checked;await settingsStore.save(next);notify('탑승 도우미 설정을 저장했습니다.');go('settings');}catch(error){fail(error);}};}
function settingsAppearancePage(){main.innerHTML=appearanceSettingsView({settings:settingsStore.get()});$('#settings-appearance-form').onsubmit=async e=>{e.preventDefault();try{const form=e.target,next=settingsStore.get(),values=Object.fromEntries(new FormData(form));Object.assign(next.appearance,values,{highContrast:form.elements.highContrast.checked,reduceMotion:form.elements.reduceMotion.checked,duration:form.elements.duration.checked,delayHighlight:form.elements.delayHighlight.checked});await settingsStore.save(next);applyAppearance();notify('화면 설정을 저장했습니다.');go('settings');}catch(error){fail(error);}};}
function settingsRoutesPage(){const state=model.read();main.innerHTML=routesSettingsView({routes:state.routes,model,esc});const form=$('#settings-route-form');form.onsubmit=async e=>{e.preventDefault();try{const values=Object.fromEntries(new FormData(form)),route={alias:values.alias.trim(),from:values.from.trim(),to:values.to.trim(),fromStationId:stationIdFor(model,values.from.trim()),toStationId:stationIdFor(model,values.to.trim()),pax:+values.pax,after:values.after,family:values.family};model.validateQuery({...q,...route,date:kstDate()});const next=model.read(),index=values.index===''?-1:+values.index;if(index<0){if(next.routes.some(r=>r.from===route.from&&r.to===route.to))throw Error('이미 저장된 구간입니다.');next.routes.push(route);}else next.routes[index]=route;await model.save(next);notify('자주 이용하는 구간을 저장했습니다.');settingsRoutesPage();}catch(error){fail(error);}};main.querySelectorAll('[data-route-edit]').forEach(button=>button.onclick=()=>{const r=model.read().routes[+button.dataset.routeEdit];for(const key of ['alias','from','to','pax','after','family'])form.elements[key].value=r[key]??(key==='pax'?1:key==='family'?'all':'');form.elements.index.value=button.dataset.routeEdit;form.scrollIntoView({behavior:'smooth'});});main.querySelectorAll('[data-route-delete]').forEach(button=>button.onclick=async()=>{const next=model.read();next.routes.splice(+button.dataset.routeDelete,1);await model.save(next);settingsRoutesPage();});main.querySelectorAll('[data-route-move]').forEach(button=>button.onclick=async()=>{const next=model.read(),from=+button.dataset.index,to=from+(button.dataset.routeMove==='up'?-1:1);[next.routes[from],next.routes[to]]=[next.routes[to],next.routes[from]];await model.save(next);settingsRoutesPage();});}
async function cacheLabel(){if(!globalThis.caches)return '미지원';const keys=await caches.keys();return keys.length?`${keys.length}개 캐시`:'저장된 캐시 없음';}
function settingsDataPage(){const dataCheckedAt=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(+(localStorage.getItem('raillink.data.checkedAt')||Date.now()))),ticketCount=logicalTicketCount(model.read().tickets);main.innerHTML=dataSettingsView({recentCount:recent().length,ticketCount,cacheText:'확인 중',dataCheckedAt});cacheLabel().then(text=>{if(location.hash==='#settings-data')main.innerHTML=dataSettingsView({recentCount:recent().length,ticketCount:logicalTicketCount(model.read().tickets),cacheText:text,dataCheckedAt});}).catch(()=>{});}
function settingsPrivacyPage(){main.innerHTML=privacySettingsView();}
function settingsAboutPage(){main.innerHTML=aboutSettingsView();}
function confirmCancel(id){
 const state=model.read(),t=state.tickets.find(t=>t.id===id);if(!t)return;
 const group=t.groupId?state.tickets.filter(x=>x.groupId===t.groupId):[t];
 const mixed=isSameTrainSeatJourney(group),segments=mixed?seatSegments(group):group;
 showDialog('예약을 취소할까요?',`<p>${mixed?'입석+좌석 승차권 1매 · 같은 열차 좌석 '+segments.length+'구간':group.length+'구간'} · ${esc(group[0].fromStn)} → ${esc(group.at(-1).toStn)}</p><p>환불 금액: <b>${won(group.reduce((sum,t)=>sum+t.totalFare,0))}</b></p><p>${mixed?'열차 출발 후에는 승차권을 취소할 수 없습니다.':'첫 열차가 출발하면 전체 취소할 수 없습니다.'}</p><button class="danger" id="confirm-cancel">예약 취소 확인</button>`);
 $('#confirm-cancel').onclick=async()=>{try{await model.cancel(id);dialog.close();render();notify('예약을 취소했습니다.');}catch(error){fail(error);}};
}
function render() {
  const route=location.hash.slice(1)||'home';
  disposeInventory();
  shell(route);
  document.querySelectorAll('[data-nav]').forEach(a=>{const current=a.dataset.nav===(['complete','boarding'].includes(route)?'tickets':['passes','board','tour-routes','tour-product','tour-itinerary'].includes(route)?'travel':['results','seats','passengers','review'].includes(route)?'search':route.startsWith('settings')?'my':route);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  try {({boarding:()=>boarding.render(),home:searchPage,search:searchPage,results:resultPage,'route-details':routeDetailPage,seats:seatsPage,passengers:passengerPage,review:reviewPage,complete:completePage,tickets:ticketsPage,travel:travelPage,'tour-routes':tourRoutesPage,'tour-product':tourProductPage,'tour-itinerary':tourItineraryPage,passes:passesPage,board:boardPage,my:myPage,settings:settingsPage,'settings-search':settingsSearchPage,'settings-seat':settingsSeatPage,'settings-routes':settingsRoutesPage,'settings-alerts':settingsAlertsPage,'settings-boarding':settingsBoardingPage,'settings-appearance':settingsAppearancePage,'settings-data':settingsDataPage,'settings-privacy':settingsPrivacyPage,'settings-about':settingsAboutPage}[route]||searchPage)();document.title=`${['home','search'].includes(route)?'레일링크 · 열차 예매':main.querySelector('h2')?.textContent||'레일링크'} · RailLink`;}
  catch(error){main.innerHTML=heading('PLEASE TRY AGAIN','화면을 불러오지 못했습니다')+`<div class="empty"><p>${esc(error.message)}</p><button data-action="nav" data-value="search">검색으로 돌아가기</button><button data-action="export">저장 데이터 내보내기</button></div>`;}
}
main.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b){const card=e.target.closest('.train-card');if(card&&!e.target.closest('button,a,input,select'))card.querySelector('[data-action=book]:enabled')?.click();return;}if(b.disabled)return;
  const {action,value,index}=b.dataset;
  try {
    if(action==='nav'){if(value==='search')homeTab='booking';go(value);}
    if(action==='detail')details(results[index].train,q);
    if(action==='draft-detail')details(model.byKey.get(draft.key),draft.q);
    if(action==='book')bookingOptions(+index);
    if(action==='book-transfer')bookingOptions(+index,true);
    if(action==='mixed'){const r=results[index],legs=model.mixed(r.train,q);if(!legs.length){notify('좌석·입석을 나눠 이용할 수 있는 대안이 없습니다.');return;}showDialog('같은 열차 구간별 좌석 이용',`<p><b>${esc(r.train.grade)} ${esc(r.train.no)} 열차를 계속 이용합니다.</b> 열차를 갈아타지 않고 구간에 따라 좌석과 입석만 바뀝니다.</p>${legs.map(l=>`<p>${esc(l.q.from)} → ${esc(l.q.to)} · ${model.data.classes[l.q.cls].label}</p>`).join('')}<button class="primary" id="accept-mixed">좌석 이용 구간 선택 시작</button>`);$('#accept-mixed').onclick=()=>{dialog.close();journeyDrafts=legs.map(l=>makeDraft(l.key,l.q));journeyIndex=0;draft=journeyDrafts[0];bookingType='mixed';roundTrip=false;selectingReturn=false;selectedCar=0;go('seats');};}
    if(action==='transfer-route'){selectedTransfer=+index;go('route-details');}
    if(action==='transfer-operation'){const leg=transferResults[index].legs[+b.dataset.leg];openOperation({model,train:leg.train,query:leg.q,showDialog,dialog,esc});}
    if(action==='transfer-detail'){const leg=transferResults[index].legs[+b.dataset.leg];details(leg.train,leg.q);}
    if(action==='next-leg')nextJourneySeat();
    if(action==='watch'){await model.watch(results[index].key,q);notify('대기 기록을 저장했습니다. 마이에서 확인하세요.');}
    if(action==='more'){visibleCount+=12;resultPage();}
    if(action==='car'){selectedCar=+index;seatsPage();}
    if(action==='seat'){const i=draft.seats.indexOf(value);if(i>=0)draft.seats.splice(i,1);else if(draft.seats.length<+draft.q.pax)draft.seats.push(value);else notify(`${draft.q.pax}명에 맞게 좌석을 선택하세요.`);updateSelected();}
    if(action==='operation'){if(!navigator.onLine){notify('운행 정보 갱신은 인터넷 연결 후 이용하세요.');return;}const t=model.read().tickets.find(t=>t.id===value);openOperation({model,train:model.byKey.get(t.key),query:{from:t.fromStn,to:t.toStn,date:t.travelDate},showDialog,dialog,esc,grade});}
    if(action==='boarding')boarding.open(value);
    if(action==='ticket-detail')showTicketQR(value);
    if(action==='ticket-facilities'){const t=model.read().tickets.find(t=>t.id===value);details(model.byKey.get(t.key),{from:t.fromStn,to:t.toStn,date:t.travelDate,pax:t.passengerCount,cls:t.seatClass},t);}
    if(action==='cancel')confirmCancel(value);
    if(action==='qr')showTicketQR(value);
    if(action==='delete-history'){showDialog('여정 기록 삭제','<p>이 여정의 승차권 기록을 브라우저에서 삭제합니다.</p><button id="delete-record" class="danger">기록 삭제</button>');$('#delete-record').onclick=async()=>{try{await model.removeHistory(value);dialog.close();ticketsPage();}catch(error){fail(error);}};}
    if(action==='export-csv'){const blob=new Blob([ticketsCSV(model.read().tickets)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='raillink-tickets.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(action==='change'){roundTrip=false;selectingReturn=false;journeyDrafts=[];homeTab='booking';const t=model.read().tickets.find(t=>t.id===value);changing=t.id;q={...q,from:t.fromStn,to:t.toStn,date:t.travelDate,pax:t.passengerCount,cls:t.seatClass,after:'',grade:'all'};for(const key of ['tourProductId','tourSegmentIndex','includeTransfer','before'])delete q[key];go('search');}
    if(action==='tour-grade'){selectedTourGrade=value;tourOrigin=location.hash.slice(1)||'home';go('tour-routes');}
    if(action==='tour-filter'){tourFilter=value;if(location.hash==='#travel')travelPage();else searchPage();}
    if(action==='tour-product'){selectTourProduct(value);selectedTourDuration='';tourOrigin=location.hash.slice(1)||'travel';go('tour-product');}
    if(action==='tour-plan'){selectTourProduct(value);selectedTourDuration=tourProductById(value)?.defaultDuration||'';go('tour-itinerary');}
    if(action==='tour-duration'){selectedTourDuration=value;tourItineraryPage();}
    if(action==='tour-back'){selectedTourGrade=q.tourGrade;go('tour-routes');}
    if(action==='tour-system'){
     const system=tourismGroups(model).find(g=>g.grade===selectedTourGrade)?.systems.find(s=>s.id===value);
     if(!system)throw Error('계통을 다시 선택해 주세요.');
     const direction=system.directions.find(d=>d.id==='down')||system.directions[0],t=direction.trains[0];
     const next={...q,from:t.from,to:t.to,date:$('#tour-date').value,grade:selectedTourGrade,family:'all',transfer:false,after:'',before:'',cls:'general',sort:'departure',tourGrade:selectedTourGrade,tourSystem:system.id};
     for(const key of ['tourProductId','tourSegmentIndex','includeTransfer'])delete next[key];
     model.validateQuery(next);q=next;roundTrip=false;selectingReturn=false;changing=null;journeyDrafts=[];go('results');
    }
    if(action==='saved-route'){for(const key of ['tourGrade','tourSystem','tourProductId','tourSegmentIndex','before'])delete q[key];const route=model.read().routes[index];q={...queryFromSettings(settingsStore.get(),model,kstDate()),...route,date:kstDate(),grade:'all',after:route.after||'',transfer:false};go('results');}
    if(action==='remove-route'){const s=model.read();s.routes.splice(+index,1);await model.save(s);render();}
    if(action==='watch-search'){q={...model.read().watches.find(w=>w.id===value).q};if(q.date<kstDate())q.date=kstDate();go('results');}
    if(action==='remove-watch'){const s=model.read();s.watches=s.watches.filter(w=>w.id!==value);await model.save(s);render();}
    if(action==='export'){const blob=new Blob([JSON.stringify(model.read())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='raillink-reservations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(action==='reset'){showDialog('이 브라우저의 기록을 삭제할까요?','<p>예약·대기·저장 구간 기록을 삭제합니다. 필요하면 먼저 내보내기를 이용하세요.</p><button class="danger" id="confirm-reset">내 기록 모두 삭제</button>');$('#confirm-reset').onclick=async()=>{try{await bookingStorage.removeItem();localStorage.removeItem(recentKey);model.data.invalidate();model.data.setSimulation?.(false);dialog.close();render();}catch(error){fail(error);}};}
    if(action==='clear-recent'||b.dataset.settingsAction==='clear-recent'){localStorage.removeItem(recentKey);notify('최근 검색 기록을 삭제했습니다.');settingsDataPage();}
  } catch(error){fail(error);}
});
main.addEventListener('click',e=>{const action=e.target.closest('[data-settings-action]')?.dataset.settingsAction;if(!action)return;if(action==='clear-recent'){localStorage.removeItem(recentKey);notify('최근 검색 기록을 삭제했습니다.');settingsDataPage();}if(action==='clear-cache'){if(!globalThis.caches){notify('이 브라우저는 앱 캐시 관리를 지원하지 않습니다.');return;}showDialog('앱 캐시를 삭제할까요?','<p>화면과 공통 철도 데이터의 임시 파일만 삭제합니다. 승차권과 예약은 유지됩니다.</p><button id="confirm-cache" class="danger">캐시 삭제</button>');$('#confirm-cache').onclick=async()=>{try{for(const key of await caches.keys())await caches.delete(key);dialog.close();notify('앱 캐시를 삭제했습니다. 다음 실행 시 데이터를 다시 불러옵니다.');settingsDataPage();}catch(error){fail(error);}};}if(action==='reset-settings'){showDialog('기본 설정을 초기화할까요?','<p>검색·좌석·알림·화면 설정을 기본값으로 되돌립니다. 예약과 승차권은 유지됩니다.</p><button id="confirm-settings-reset" class="danger">설정 초기화</button>');$('#confirm-settings-reset').onclick=async()=>{try{await settingsStore.reset();q=queryFromSettings(settingsStore.get(),model,kstDate());applyAppearance();dialog.close();notify('설정을 초기화했습니다.');settingsDataPage();}catch(error){fail(error);}};}});
window.addEventListener('hashchange',()=>{if(location.hash==='#search')homeTab='booking';render();window.scrollTo(0,0);main.focus({preventScroll:true});});
window.addEventListener('storage',async e=>{if(e.key===STORE_KEY){await bookingStorage.refresh();model.data.invalidate();notify('다른 탭에서 예약 정보가 변경되었습니다.');if(!draft)render();}if(e.key===SETTINGS_KEY){await settingsStorage.refresh();settingsStore=createSettingsStore({model,storage:settingsStorage});applyAppearance();if(!draft)render();}});
try {
  await ensureProductStyles();
  if(!window.RailData) throw new Error('공통 철도 데이터 연결을 확인하세요.');
  bookingStorage=await openBookingStorage(STORE_KEY);
  model=createModel(window.RailData,bookingStorage);
  await model.migrateStoredTickets();
  try{localStorage.setItem('raillink.data.checkedAt',String(Date.now()));}catch{}
  settingsStorage=await openAppStorage(SETTINGS_KEY);
  settingsStore=createSettingsStore({model,storage:settingsStorage});applyAppearance();
  boarding=createBoardingController({model,main,esc,icon,go,notify,settings:()=>settingsStore.get(),clock,ticket:showTicketQR,receipt:showReceipt,history:()=>{ticketFilter='history';ticketDate='';go('tickets');},
   operation:(train,query)=>openOperation({model,train,query,showDialog,dialog,esc}),
   rebook:t=>{q={...q,from:t.fromStn,to:t.toStn,date:kstDate(),pax:t.passengerCount,cls:t.seatClass,grade:'all',family:'all',after:'',transfer:false};for(const key of ['tourGrade','tourSystem','tourProductId','tourSegmentIndex','includeTransfer','before'])delete q[key];changing=null;roundTrip=false;selectingReturn=false;returnJourney=null;draft=null;bookingType='single';journeyDrafts=[];homeTab='booking';go('search');},
   alerts:()=>go('settings-alerts')});
  boardingAlerts=createBoardingAlerts({service:boarding.service,model,settings:()=>settingsStore.get(),notify,open:id=>boarding.open(id)});
  bookingStorage.onChange(()=>{model.data.invalidate();if(!draft)render();});
  settingsStorage.onChange(()=>{settingsStore=createSettingsStore({model,storage:settingsStorage});applyAppearance();if(!draft)render();});
  model.data.setSimulation?.(model.read().simulation===true);
  // The shared inventory needs seat-use sections, while RailLink persists and
  // presents the mixed product as one ticket document.
  window.loadTickets=()=>model.read().tickets.flatMap(t=>Array.isArray(t.seatSegments)?seatSegments(t).map((segment,index)=>({...t,...segment,id:`${t.id}:inventory:${index}`,parentTicketId:t.id,seatSegments:undefined,travelDate:segment.serviceDate||segment.travelDate})):[{...t,travelDate:t.serviceDate||t.travelDate}]);
  q=queryFromSettings(settingsStore.get(),model,kstDate());
  render();
} catch(error){main.innerHTML=heading('CONNECTION REQUIRED','데이터 연결을 확인해 주세요')+`<p>${esc(error.message)}</p><button onclick="location.reload()">다시 시도</button>`;}

// Refresh schedule regions only: station/date inputs and open sheets retain focus and scroll.
function refreshHomeJourney(){
 try {
  updateHomeGreeting(main,homeGreetings);
  boarding?.refresh();
  refreshTicketBoardingPlace();
  if(location.hash==='#results'){
   let removed=0;
   for(const el of main.querySelectorAll('[data-inventory],[data-transfer-inventory]')){
    const r=el.dataset.transferInventory!==undefined?transferResults[+el.dataset.transferInventory]:results[+el.dataset.inventory];
    const dep=r?.legs?r.legs[0].dep:r?+model.departure(r.seg,q.date):Infinity;
    if(q.hideDeparted!==false&&dep<=Date.now()){el.remove();removed++;}
   }
   if(removed){
    const directCount=q.transfer?0:results.filter(r=>+model.departure(r.seg,q.date)>Date.now()).length,transferCount=(q.transfer||q.includeTransfer)?transferResults.filter(r=>r.legs[0].dep>Date.now()).length:0,count=directCount+transferCount;
    const counter=main.querySelector('[data-result-count]');if(counter)counter.textContent=`${q.includeTransfer?'조회 결과':q.transfer?'환승 경로':'열차'} ${count}건`;
    notify('출발한 열차를 조회 결과에서 제외했습니다.');
    if(!count){const list=main.querySelector(q.transfer?'#transfer-results':'#results-list');if(list)list.innerHTML='<p class="empty">표시된 열차가 모두 출발했습니다. 다음 날짜나 다른 열차를 조회하세요.</p>';}
   }
  }
  if(['home','search',''].includes(location.hash.slice(1))&&!dialog.open){
   const template=document.createElement('template');
   template.innerHTML=homeView({greeting:homeGreetings.get(),q,model,tab:homeTab,queryForm,searchOptions,esc,icon,grade,dateLabel,notice,recent:recent(),boardingNext:boarding?.service.upcoming()[0],journeys:upcomingJourneys(model.read().tickets),tourFilter});
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
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){updateHomeGreeting(main,homeGreetings);refreshTicketBoardingPlace();}});
window.addEventListener('pageshow',()=>updateHomeGreeting(main,homeGreetings));

function applyAppearance(){const value=settingsStore?.get().appearance||{theme:localStorage.getItem('raillink.theme')||'light',fontSize:'medium',highContrast:false,reduceMotion:false,delayHighlight:true};const root=document.documentElement;root.dataset.theme=value.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):value.theme;root.dataset.fontSize=value.fontSize;root.dataset.contrast=value.highContrast?'high':'normal';root.dataset.reduceMotion=String(value.reduceMotion);root.dataset.delayHighlight=String(value.delayHighlight);}
try{applyAppearance();matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyAppearance);}catch{}

function boardPage(){main.innerHTML=travelBoard(model.read().tickets,model,esc)+notice;}
let passPreview=[];
function passesPage(){
 const s=model.read();main.innerHTML=heading('','정기 일정','향후 4주간 같은 구간을 반복 예매합니다.')+`<form id="pass-form" class="panel"><label>일정 이름<input name="name" maxlength="40" required placeholder="예: 출근길"></label><div class="form-row"><label>출발역<input name="from" list="pass-stations" value="${esc(q.from)}" required></label><label>도착역<input name="to" list="pass-stations" value="${esc(q.to)}" required></label></div><datalist id="pass-stations">${model.stations.map(st=>`<option value="${esc(st)}"></option>`).join('')}</datalist><label>시작일<input type="date" name="start" min="${kstDate()}" max="${addDays(kstDate(),3)}" value="${kstDate()}" required></label><button type="button" id="pass-trains">선호 열차 조회</button><label>선호 열차<select name="trainKey" id="pass-train" required><option value="">먼저 구간을 조회하세요</option></select></label><label>좌석 등급<select name="cls">${Object.entries(model.data.classes).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select></label><label>인원<select name="pax">${[1,2,3,4,5,6].map(n=>`<option value="${n}">${n}명</option>`).join('')}</select></label><fieldset><legend>반복 요일</legend><div class="weekday-options">${['일','월','화','수','목','금','토'].map((day,i)=>`<label><input type="checkbox" name="weekday" value="${i}">${day}</label>`).join('')}</div></fieldset><button class="primary" type="submit">4주 일정 미리보기</button></form><div id="pass-preview" aria-live="polite"></div><h3>저장된 정기 일정</h3>${(s.passes||[]).map(p=>`<div class="panel"><b>${esc(p.name)}</b><p>${esc(p.from)} → ${esc(p.to)} · ${p.weekdays.map(d=>['일','월','화','수','목','금','토'][d]).join(', ')}</p><a href="#tickets">발행된 승차권 보기</a></div>`).join('')||'<p>저장된 정기 일정이 없습니다.</p>'}`;
 $('#pass-trains').onclick=()=>{try{const form=$('#pass-form'),data=Object.fromEntries(new FormData(form));const query={from:data.from,to:data.to,date:data.start,cls:data.cls,pax:+data.pax,sort:'departure'};const rows=model.search(query);$('#pass-train').innerHTML=rows.map(r=>`<option value="${esc(r.key)}">${esc(r.train.grade)} ${esc(r.train.no)} · ${clock(r.seg.dep)} 출발</option>`).join('')||'<option value="">조회된 열차 없음</option>';}catch(error){fail(error);}};
 $('#pass-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;const form=new FormData(e.target),config={...Object.fromEntries(form),pax:+form.get('pax'),weekdays:form.getAll('weekday').map(Number)};$('#pass-preview').textContent='날짜별 시간표와 좌석을 확인하고 있습니다…';try{passPreview=await previewPass(model,config);if(!$('#pass-preview'))return;$('#pass-preview').innerHTML=passPreview.map(p=>`<p>${p.date} · ${p.draft?'예약 가능':esc(p.reason)+' · 제외'}</p>`).join('')+`<p>예약 가능한 ${passPreview.filter(p=>p.draft).length}건만 일괄 저장합니다. 인접 좌석 자동 배정이 적용됩니다.</p><button class="primary" id="commit-pass" ${passPreview.some(p=>p.draft)?'':'disabled'}> 일괄 예약</button>`;$('#commit-pass').onclick=async()=>{const b=$('#commit-pass');b.disabled=true;try{const commit=async()=>{await bookingStorage.refresh();return model.bookMany(passPreview.filter(p=>p.draft).map(p=>p.draft),{type:'pass',pass:config});};lastTickets=await(navigator.locks?navigator.locks.request('raillink-booking',commit):commit());lastTicket=lastTickets[0];ticketFilter='active';ticketDate='';go('complete');}catch(error){fail(error);b.disabled=false;}};}catch(error){fail(error);if($('#pass-preview'))$('#pass-preview').textContent='미리보기를 생성하지 못했습니다.';}finally{button.disabled=false;}};
}
function checkJourneyAlerts(){
 try{boardingAlerts?.check().catch(()=>{});}catch{}
 setTimeout(checkJourneyAlerts,60000-Date.now()%60000);
}
setTimeout(checkJourneyAlerts,1000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')boardingAlerts?.check().catch(()=>{});});

initPWA(notify);
