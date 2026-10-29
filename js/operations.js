import {serviceTimeline,midnight,displayClock,clockAt} from './railway-time.js';

const trainGlyph='<rect x="5" y="3" width="14" height="17" rx="4"/><path d="M8 7h8v5H8zM8 17h.01M16 17h.01M8 21l-2 2M16 21l2 2"/>';

export function operationSnapshot(model,train,query,now=new Date()){
 const seg=model.segment(train,query.from,query.to);
 if(!seg)throw Error('선택 구간이 현재 시간표에 없습니다.');
 const serviceDate=model.serviceDate(train,query),base=midnight(serviceDate),timed=serviceTimeline(train.stops);
 let delay={phase:'none',current:0},error='';
 // The upstream simulation uses local Date getters. Never reinterpret another timezone as KST.
 if(now.getTimezoneOffset()===-540&&model.data.delayState){
  try{delay=model.data.delayState(train,serviceDate);}catch{error='공통 지연 모형을 읽지 못했습니다.';}
 }
 let timedIndex=-1;
 const stopping=new Set(model.data.stops(train).map(n=>n.s));
 const nodes=timed.map(s=>{
  if(s.arrival!==null||s.departure!==null)timedIndex++;
  let pair={arr:0,dep:0};
  if(delay.phase!=='none'&&(!delay.serviceDate||delay.serviceDate===serviceDate)){
   try{
    const delta=model.data.delayAt?.(train,timedIndex,serviceDate)||0;
    pair=model.data.delayPair?.(train,timedIndex)||{arr:delta,dep:delta};
   }catch{error='공통 지연 모형을 읽지 못했습니다.';}
  }
  return {...s,coord:model.data.coordinate?.(s.geoKey||s.s),
   stop:(s.arrival!==null||s.departure!==null)&&!model.data.isPass?.(train,s.s)&&stopping.has(s.s),
   plannedArrival:s.arrival===null?null:base+s.arrival*60000,
   plannedDeparture:s.departure===null?null:base+s.departure*60000,
   arrTime:s.arrival===null?null:base+(s.arrival+pair.arr)*60000,
   depTime:s.departure===null?null:base+(s.departure+pair.dep)*60000,
   delay:pair.dep,arrivalDelay:pair.arr};
 });
 const distance=(a,b)=>a&&b?Math.hypot((a.lon-b.lon)*Math.cos((a.lat+b.lat)*Math.PI/360),a.lat-b.lat):0;
 for(let i=0;i<nodes.length;i++)if(nodes[i].arrTime===null&&nodes[i].depTime===null){
  let start=i-1,end=i+1;
  while(start>=0&&nodes[start].depTime===null&&nodes[start].arrTime===null)start--;
  while(end<nodes.length&&nodes[end].arrTime===null&&nodes[end].depTime===null)end++;
  if(start<0||end>=nodes.length)continue;
  let total=0,partial=0;
  for(let j=start+1;j<=end;j++){const d=distance(nodes[j-1].coord,nodes[j].coord);total+=d;if(j<=i)partial+=d;}
  const a=nodes[start].depTime??nodes[start].arrTime,b=nodes[end].arrTime??nodes[end].depTime;
  nodes[i].interpolated=a+(b-a)*(total?partial/total:(i-start)/(end-start));
 }
 const dep=+model.departure(seg,query.date),arr=dep+seg.duration*60000;
 const first=nodes.find(n=>n.s===query.from&&n.depTime!==null);
 const last=nodes.find(n=>n.s===query.to&&n.arrTime!==null&&n.index>(first?.index??-1));
 const actualDep=first?.depTime??dep,actualArr=last?.arrTime??arr;
 const phase=+now<actualDep?'before':+now>=actualArr?'done':'running';
 const serviceStops=nodes.filter(n=>n.stop),origin=serviceStops[0],terminal=serviceStops.at(-1);
 const trainPhase=+now<(origin.depTime??origin.arrTime)?'before':+now>=(terminal.arrTime??terminal.depTime)?'done':'running';
 const next=serviceStops.find(n=>(n.arrTime??n.depTime)>+now);
 const current=serviceStops.find(n=>n.arrTime!==null&&n.depTime!==null&&n.arrTime<=+now&&+now<n.depTime);
 const label=trainPhase==='before'?'운행을 준비중인 열차입니다':trainPhase==='done'?'운행이 종료된 열차입니다':current?`${current.s}역에 정차 중입니다`:next?`${next.s}역으로 이동 중입니다`:'종착역으로 이동 중입니다';
 return {nodes,phase,trainPhase,label,next,current,delay,error,departure:actualDep,arrival:actualArr,
  fromIndex:first?.index??0,toIndex:last?.index??nodes.length-1,serviceDate,
  remaining:Math.max(0,Math.ceil((actualArr-+now)/60000)),now:+now};
}

// The entire train's run determines its position, independently of the booked segment.
// Timetable rows use stopping stations; map geometry also includes untimed pass points.
export function operationPosition(snapshot,nodes=snapshot.nodes){
 if(snapshot.trainPhase!=='running')return null;
 for(let i=0;i<nodes.length;i++){
  const n=nodes[i],arr=n.arrTime??n.interpolated??n.depTime,dep=n.depTime??arr;
  if(arr!=null&&arr<=snapshot.now&&snapshot.now<dep)return {index:i,nextIndex:i,fraction:0};
  if(i+1<nodes.length){
   const next=nodes[i+1],to=next.arrTime??next.interpolated??next.depTime;
   if(dep!=null&&to!=null&&dep<=snapshot.now&&snapshot.now<to)
    return {index:i,nextIndex:i+1,fraction:(snapshot.now-dep)/(to-dep)};
  }
 }
 return null;
}

function mapGeometry(snapshot){
 const points=snapshot.nodes.filter(n=>n.coord);
 if(points.length<2)return {points,xy:()=>[0,0]};
 const xs=points.map(n=>n.coord.lon),ys=points.map(n=>n.coord.lat),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(420/Math.max(.001,maxX-minX),300/Math.max(.001,maxY-minY));
 return {points,xy:n=>[310+(n.coord.lon-(minX+maxX)/2)*scale,190+((minY+maxY)/2-n.coord.lat)*scale]};
}
function mapPosition(snapshot){
 const {points,xy}=mapGeometry(snapshot),position=operationPosition(snapshot,points);
 if(!position)return null;
 const a=xy(points[position.index]),b=xy(points[position.nextIndex]);
 return [a[0]+(b[0]-a[0])*position.fraction,a[1]+(b[1]-a[1])*position.fraction];
}
export function operationMap(snapshot,color,esc){
 const {points,xy}=mapGeometry(snapshot);
 if(points.length<2)return '<p class="brd-map-empty">이 경로의 좌표가 충분하지 않습니다.</p>';
 const selected=n=>n.index>=snapshot.fromIndex&&n.index<=snapshot.toIndex;
 const position=mapPosition(snapshot);
 const lines=points.slice(1).map((n,i)=>{
  const a=xy(points[i]),b=xy(n);
  return `<line class="${selected(points[i])&&selected(n)?'selected':'muted'}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
 }).join('');
 const stops=points.map((n,i)=>{
  if(!n.stop)return '';
  const [x,y]=xy(n),endpoint=n.index===snapshot.fromIndex||n.index===snapshot.toIndex;
  return `<g class="${selected(n)?'selected':'muted'}${endpoint?' endpoint':''}"><circle cx="${x}" cy="${y}" r="${endpoint?7:4}"/><text x="${x+(i%2?-11:11)}" y="${y+4}" text-anchor="${i%2?'end':'start'}">${esc(n.s)}</text></g>`;
 }).join('');
 return `<div class="brd-route-map" style="--route-grade:${esc(color)}"><div class="brd-map-key"><span><i class="selected"></i>승차 구간</span><span><i></i>전체 운행 구간</span><span><i class="live"></i>현재 위치</span></div><div class="brd-map-canvas"><svg class="operation-map" viewBox="0 0 620 380" role="img" aria-label="전체 운행 경로, 승차 구간과 시간표 기반 열차 현재 위치">${lines}${stops}<g class="brd-map-live-train" style="${position?'transform:translate('+position[0]+'px,'+position[1]+'px)':'display:none'}"><title>열차 현재 위치</title><circle r="13"/><g transform="translate(-9,-10) scale(.75)">${trainGlyph}</g></g></svg></div><p>시간표·지연 모형 기준 추정 위치 · 등록 좌표를 연결한 운행 개략도</p></div>`;
}

export function openOperation({model,train,query,showDialog,dialog,esc}){
 const snapshot=()=>operationSnapshot(model,train,query),initial=snapshot(),stops=initial.nodes.filter(n=>n.stop);
 const color=model.data.colors[train.grade]||'#1168ad';
 const dateLabel=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(new Date(midnight(query.date)));
 const rows=stops.map((n,i)=>{
  const board=n.index===initial.fromIndex,alight=n.index===initial.toIndex,inRide=n.index>=initial.fromIndex&&n.index<=initial.toIndex;
  const platform=model.data.platform?.(train.no,n.s);
  return `<div class="brd-stop ${inRide?'ride':n.index<initial.fromIndex?'before':'after'}${board?' board':''}${alight?' alight':''}" data-ops-row="${i}" data-station="${esc(n.s)}"><div class="brd-rail"><i></i></div><div class="brd-station">${board||alight?`<span class="brd-stop-badge ${board?'board':'alight'}">${board?'승차':'하차'}</span>`:''}<strong>${esc(n.s)}</strong>${platform!=null?`<span>${esc(platform)}번 승강장</span>`:''}</div><time class="brd-arr"><span>${esc(displayClock(n.arr||'—'))}</span><small></small></time><time class="brd-dep"><span>${esc(displayClock(n.dep||'—'))}</span><small></small></time></div>`;
 }).join('');
 showDialog('열차 운행 정보',`<section class="book-route-detail-sheet open" style="--brd-grade:${esc(color)}"><header class="brd-header"><div class="brd-head-info"><small id="ops-label">운행 정보</small><h2 id="ops-title"><span>${esc(train.grade)}</span><b>${esc(train.no)}</b></h2></div><div class="brd-head-actions"><button type="button" id="ops-close" class="brd-close" aria-label="닫기">✕</button></div></header><div class="brd-summary"><time>${esc(dateLabel)}</time><strong>${esc(query.from)} <span>${esc(displayClock(stops.find(n=>n.index===initial.fromIndex)?.dep||'—'))}</span><i>→</i>${esc(query.to)} <span>${esc(displayClock(stops.find(n=>n.index===initial.toIndex)?.arr||'—'))}</span></strong><small id="ops-status" class="brd-operation-state" role="status"><b></b><span></span></small></div><div class="brd-view-tabs" role="tablist" aria-label="운행 정보 보기"><button class="brd-view-tab active" role="tab" id="ops-time-tab" aria-controls="ops-time" aria-selected="true" data-ops-tab="time">시간표</button><button class="brd-view-tab" role="tab" id="ops-map-tab" aria-controls="ops-map" aria-selected="false" tabindex="-1" data-ops-tab="map">지도</button></div><div id="ops-time" class="brd-view brd-schedule-view active" role="tabpanel" aria-labelledby="ops-time-tab"><div class="brd-columns"><span>역명</span><span>도착</span><span>출발</span></div><div class="brd-stop-list" tabindex="0" aria-label="전체 정차역 시간표">${rows}</div></div><div id="ops-map" class="brd-view brd-map-view" role="tabpanel" aria-labelledby="ops-map-tab" hidden>${operationMap(initial,color,esc)}</div><p class="ops-note">게임 시간표·지연 모형 기준 추정 위치</p></section>`);
 const q=s=>dialog.querySelector(s);
 dialog.classList.add('operations-dialog');
 q('.dialog-head').remove();
 dialog.setAttribute('aria-labelledby','ops-label ops-title');
 q('#ops-close').id='close-dialog';q('#close-dialog').onclick=()=>dialog.close();q('#close-dialog').focus();
 const selectTab=tab=>{
  dialog.querySelectorAll('[data-ops-tab]').forEach(b=>{
   const selected=b.dataset.opsTab===tab;b.setAttribute('aria-selected',selected);b.tabIndex=selected?0:-1;b.classList.toggle('active',selected);
  });
  ['time','map'].forEach(name=>{const panel=q('#ops-'+name);panel.hidden=name!==tab;panel.classList.toggle('active',name===tab);});
  placeMarkers(latest);
 };
 dialog.querySelectorAll('[data-ops-tab]').forEach(b=>{
  b.onclick=()=>selectTab(b.dataset.opsTab);
  b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
   e.preventDefault();const next=e.key==='Home'?'time':e.key==='End'?'map':b.dataset.opsTab==='time'?'map':'time';
   selectTab(next);q('#ops-'+next+'-tab').focus();
  }};
 });
 const marker=document.createElement('span');marker.className='brd-live-marker';marker.setAttribute('role','img');marker.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${trainGlyph}</svg>`;
 const rowElements=[...dialog.querySelectorAll('[data-ops-row]')];
 const placeMarkers=s=>{
  const serviceStops=s.nodes.filter(n=>n.stop),position=operationPosition(s,serviceStops);
  rowElements.forEach((row,i)=>{row.classList.toggle('live',serviceStops[i]===s.current||serviceStops[i]===s.next);row.classList.toggle('live-marker-row',i===position?.index);});
  if(position){
   const row=rowElements[position.index],next=rowElements[position.nextIndex],rail=row.querySelector('.brd-rail');
   const moved=marker.parentElement!==rail;marker.style.transition=moved?'none':'';
   const travel=next.offsetTop-row.offsetTop+(next.offsetHeight-row.offsetHeight)/2;
   marker.style.setProperty('--brd-live-top',row.offsetHeight/2+travel*position.fraction+'px');
   if(moved)rail.append(marker);
   marker.setAttribute('aria-label','열차 현재 위치: '+s.label);marker.title=s.label;
  }else marker.remove();
  const mapMarker=q('.brd-map-live-train'),mapPoint=mapPosition(s);
  if(mapMarker){mapMarker.style.display=mapPoint?'':'none';if(mapPoint)mapMarker.style.transform=`translate(${mapPoint[0]}px,${mapPoint[1]}px)`;}
 };
 let latest=initial,lastMinute=-1,timer;
 const update=()=>{
  if(!dialog.open||!q('#ops-status'))return;
  try{
   const now=Date.now(),minute=Math.floor(now/60000);
   if(minute!==lastMinute){
    latest=snapshot();lastMinute=minute;
    q('#ops-status b').textContent=latest.label;
    const eta=latest.current?`약 ${Math.max(0,Math.ceil((latest.current.depTime-now)/60000))}분 후 출발 예정`:latest.trainPhase==='running'&&latest.next?`약 ${Math.max(0,Math.ceil(((latest.next.arrTime??latest.next.depTime)-now)/60000))}분 후 도착 예정`:'';
    q('#ops-status span').textContent=[eta,latest.error].filter(Boolean).join(' · ');
    latest.nodes.filter(n=>n.stop).forEach((n,i)=>{
     rowElements[i].querySelector('.brd-arr small').textContent=n.arrTime!==null&&n.arrivalDelay>0?`(${displayClock(clockAt(n.arrTime))})`:'';
     rowElements[i].querySelector('.brd-dep small').textContent=n.depTime!==null&&n.delay>0?`(${displayClock(clockAt(n.depTime))})`:'';
    });
   }
   latest={...latest,now};placeMarkers(latest);
  }catch(error){q('#ops-status b').textContent=error.message;}
  timer=setTimeout(update,1000-Date.now()%1000);
 };
 update();
 const list=q('.brd-stop-list'),board=q('.brd-stop.board');
 if(board)list.scrollTop=Math.max(0,board.offsetTop-list.clientHeight/2+board.clientHeight/2);
 const resize=new ResizeObserver(()=>placeMarkers(latest));resize.observe(list);
 dialog.addEventListener('close',()=>{clearTimeout(timer);resize.disconnect();dialog.classList.remove('operations-dialog');dialog.setAttribute('aria-labelledby','dialog-title');},{once:true});
}
