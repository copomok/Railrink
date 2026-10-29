import {serviceTimeline,midnight,displayClock,dateAt} from './railway-time.js';
export function operationSnapshot(model,train,query,now=new Date()){
 const seg=model.segment(train,query.from,query.to);if(!seg)throw Error('선택 구간이 현재 시간표에 없습니다.');
 const serviceDate=model.serviceDate(train,query),base=midnight(serviceDate),timed=serviceTimeline(train.stops);
 let delay={phase:'none',current:0},error='';
 // The upstream simulation uses local Date getters. Never reinterpret another timezone as KST.
 if(now.getTimezoneOffset()===-540&&model.data.delayState){try{delay=model.data.delayState(train,serviceDate);}catch{error='공통 지연 모형을 읽지 못했습니다.';}}
 const nodes=timed.map((s,i)=>{
  let delta=0;if(delay.phase!=='none'){try{const timedIndex=timed.slice(0,i+1).filter(n=>n.arrival!==null||n.departure!==null).length-1;delta=model.data.delayAt(train,timedIndex,serviceDate)||0;}catch{}}
  return {...s,coord:model.data.coordinate?.(s.s),stop:!model.data.isPass?.(train,s.s)&&model.data.stops(train).some(n=>n.s===s.s),plannedArrival:s.arrival===null?null:base+s.arrival*60000,plannedDeparture:s.departure===null?null:base+s.departure*60000,arrTime:s.arrival===null?null:base+(s.arrival+delta)*60000,depTime:s.departure===null?null:base+(s.departure+delta)*60000,delay:delta};
 });
 const distance=(a,b)=>a&&b?Math.hypot((a.lon-b.lon)*Math.cos((a.lat+b.lat)*Math.PI/360),a.lat-b.lat):0;
 for(let i=0;i<nodes.length;i++)if(nodes[i].arrTime===null&&nodes[i].depTime===null){
  let start=i-1,end=i+1;while(start>=0&&nodes[start].depTime===null&&nodes[start].arrTime===null)start--;while(end<nodes.length&&nodes[end].arrTime===null&&nodes[end].depTime===null)end++;
  if(start<0||end>=nodes.length)continue;
  let total=0,partial=0;for(let j=start+1;j<=end;j++){const d=distance(nodes[j-1].coord,nodes[j].coord);total+=d;if(j<=i)partial+=d;}
  const a=nodes[start].depTime??nodes[start].arrTime,b=nodes[end].arrTime??nodes[end].depTime;
  nodes[i].interpolated=a+(b-a)*(total?partial/total:(i-start)/(end-start));
 }
 const dep=+model.departure(seg,query.date),arr=dep+seg.duration*60000;
 const first=nodes.find(n=>n.s===query.from&&n.depTime!==null),last=nodes.find(n=>n.s===query.to&&n.arrTime!==null&&n.arrTime>(first?.depTime??0));
 const actualDep=first?.depTime??dep,actualArr=last?.arrTime??arr;
 const phase=+now<actualDep?'before':+now>=actualArr?'done':'running';
 const serviceStops=nodes.filter(n=>n.stop),next=serviceStops.find(n=>(n.arrTime??n.depTime)>+now),current=serviceStops.find(n=>n.arrTime!==null&&n.depTime!==null&&n.arrTime<=+now&&+now<n.depTime);
 const label=phase==='before'?`${query.from} 출발 예정`:phase==='done'?`${query.to} 도착 완료`:current?`${current.s} 정차 중`:next?`${next.s}역으로 이동 중`:'목적지 도착 준비';
 return {nodes,phase,label,next,current,delay,error,departure:actualDep,arrival:actualArr,serviceDate,remaining:Math.max(0,Math.ceil((actualArr-+now)/60000)),now:+now};
}
export function operationMap(snapshot,color,esc){
 const points=snapshot.nodes.filter(n=>n.coord);if(points.length<2)return '<p class="empty">이 경로의 좌표가 충분하지 않습니다.</p>';
 const xs=points.map(n=>n.coord.lon),ys=points.map(n=>n.coord.lat),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(360/Math.max(.001,maxX-minX),380/Math.max(.001,maxY-minY));
 const xy=n=>[50+(n.coord.lon-minX)*scale,35+(maxY-n.coord.lat)*scale];
 const coordinates=points.map(xy);let position=null;
 for(let i=0;i<points.length;i++){
  const n=points[i],arr=n.arrTime??n.interpolated,dep=n.depTime??arr;
  if(arr!==null&&arr<=snapshot.now&&snapshot.now<=dep)position=coordinates[i];
  if(i<points.length-1){const next=points[i+1],to=next.arrTime??next.interpolated??next.depTime;if(dep!=null&&to!=null&&dep<=snapshot.now&&snapshot.now<to){const f=(snapshot.now-dep)/Math.max(1,to-dep),a=coordinates[i],b=coordinates[i+1];position=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];}}
 }
 return `<svg class="operation-map" viewBox="0 0 480 450" role="img" aria-label="등록 역 좌표를 연결한 운행 경로와 시간표 기반 추정 위치"><polyline points="${coordinates.map(p=>p.join(',')).join(' ')}" stroke="${esc(color)}" fill="none" stroke-width="3"/>${points.map((n,i)=>n.stop?`<circle cx="${coordinates[i][0]}" cy="${coordinates[i][1]}" r="5" fill="white" stroke="${esc(color)}"/><text x="${coordinates[i][0]+(i%2?-9:9)}" y="${coordinates[i][1]+4}" text-anchor="${i%2?'end':'start'}">${esc(n.s)}</text>`:'').join('')}${position&&snapshot.phase==='running'?`<circle class="train-marker" cx="${position[0]}" cy="${position[1]}" r="9" fill="${esc(color)}" stroke="white" stroke-width="3"><title>시간표·모형 기준 추정 위치</title></circle>`:''}</svg><p class="micro">등록된 역·통과 지점 좌표를 연결한 개략도입니다. 실제 선로 지도나 GPS 위치가 아닙니다.</p>`;
}
export function openOperation({model,train,query,showDialog,dialog,esc,grade}){
 showDialog('열차 운행 정보',`${grade(train)}<p>${esc(query.from)} → ${esc(query.to)} · ${esc(query.date)}</p><div class="segmented" role="tablist" aria-label="운행 정보 보기"><button role="tab" id="ops-time-tab" aria-controls="ops-time" aria-selected="true" data-ops-tab="time">시간표</button><button role="tab" id="ops-map-tab" aria-controls="ops-map" aria-selected="false" tabindex="-1" data-ops-tab="map">지도</button></div><div id="ops-status" role="status"></div><div id="ops-time" role="tabpanel" aria-labelledby="ops-time-tab"><ol class="stops"></ol></div><div id="ops-map" role="tabpanel" aria-labelledby="ops-map-tab" hidden></div><p class="notice">게임 시간표 및 선택한 지연 모형 기준 · 실제 운행 정보 아님</p>`);
 const q=s=>dialog.querySelector(s),snapshot=()=>operationSnapshot(model,train,query);
 const initial=snapshot();
 q('#ops-time ol').innerHTML=initial.nodes.filter(n=>n.stop).map((n,i)=>`<li data-ops-row="${i}"><span>${esc(n.s)} ${n.s===query.from?'<b>승차</b>':n.s===query.to?'<b>하차</b>':''}</span><span><span>${displayClock(n.arr||'—')} 도착 / ${displayClock(n.dep||'—')} 출발</span><small class="ops-actual"></small></span></li>`).join('');
 const selectTab=tab=>{dialog.querySelectorAll('[data-ops-tab]').forEach(b=>{const selected=b.dataset.opsTab===tab;b.setAttribute('aria-selected',selected);b.tabIndex=selected?0:-1;});q('#ops-time').hidden=tab!=='time';q('#ops-map').hidden=tab!=='map';};
 dialog.querySelectorAll('[data-ops-tab]').forEach(b=>{b.onclick=()=>selectTab(b.dataset.opsTab);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const next=b.dataset.opsTab==='time'?'map':'time';selectTab(next);q('#ops-'+next+'-tab').focus();}};});
 let timer;
 const update=()=>{if(!dialog.open||!q('#ops-status'))return;try{const s=snapshot(),stops=s.nodes.filter(n=>n.stop);q('#ops-status').textContent=`${s.label}${s.phase==='running'?` · 도착까지 약 ${s.remaining}분`:''} · ${s.delay.phase==='none'?'시간표 기준':`공통 모형 지연 ${s.delay.current}분`}${s.error?' · '+s.error:''}`;dialog.querySelectorAll('[data-ops-row]').forEach((el,i)=>{const n=stops[i];el.classList.toggle('selected',n===s.current||n===s.next);el.querySelector('.ops-actual').textContent=n.delay?`모형 지연 +${n.delay}분 · 예상 ${new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'numeric',minute:'2-digit',hourCycle:'h23'}).format(new Date(n.arrTime??n.depTime))}`:'';});q('#ops-map').innerHTML=operationMap(s,model.data.colors[train.grade]||'#1168ad',esc);}catch(error){q('#ops-status').textContent=error.message;}timer=setTimeout(update,60000-Date.now()%60000);};
 update();dialog.addEventListener('close',()=>clearTimeout(timer),{once:true});
}
