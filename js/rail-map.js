import {addDays,kstDate} from './model.js';
import {operationPosition,operationSnapshot} from './operations.js';

const networkCache=new WeakMap();
const validCoord=value=>value&&Number.isFinite(+value.lat)&&Number.isFinite(+value.lon)&&Math.abs(+value.lat)<=85&&Math.abs(+value.lon)<=180;
const cleanName=value=>String(value||'').replace(/역$/,'').trim();
const edgeKey=(a,b)=>a<b?`${a}\u0000${b}`:`${b}\u0000${a}`;

/**
 * Build a geographic topology exclusively from the timetable stop/pass order and
 * the station coordinates exposed by NIMBY Rail. Straight segments are a
 * coordinate connection, not a claim that they are the original game track.
 */
export function buildRailNetwork(model){
 if(networkCache.has(model))return networkCache.get(model);
 const stations=new Map(),edges=new Map(),lineCounts=new Map();
 const ensure=(name,coord,record={})=>{
  name=cleanName(name);if(!name||!validCoord(coord))return null;
  let station=stations.get(name);
  if(!station){station={name,id:record.id||'',sourceId:record.sourceId||'',coord:{lat:+coord.lat,lon:+coord.lon},lines:new Set(),grades:new Set(),services:0,stopping:false};stations.set(name,station);}
  if(!station.sourceId&&record.sourceId)station.sourceId=record.sourceId;
  return station;
 };
 for(const record of model.stationRecords||[])ensure(record.name,record.coordinate,record);
 for(const train of model.trains||[]){
  const line=String(train.line||'노선 미분류'),grade=String(train.grade||'열차');
  lineCounts.set(line,(lineCounts.get(line)||0)+1);
  let previous=null;
  for(const raw of train.stops||[]){
   const name=cleanName(raw.s),coord=model.data.coordinate?.(raw.geoKey||raw.s),station=ensure(name,coord);
   if(!station)continue;
   station.lines.add(line);station.grades.add(grade);
   if((raw.arr||raw.dep)&&!model.data.isPass?.(train,raw.s)){station.services++;station.stopping=true;}
   if(previous&&previous.name!==station.name){
    const key=edgeKey(previous.name,station.name);let edge=edges.get(key);
    if(!edge){edge={a:previous,b:station,lines:new Set(),grades:new Set(),services:0};edges.set(key,edge);}
    edge.lines.add(line);edge.grades.add(grade);edge.services++;
   }
   previous=station;
  }
 }
 const result={
  stations:[...stations.values()],edges:[...edges.values()],
  lines:[...lineCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).map(([name,services])=>({name,services})),
  source:{kind:'timetable-coordinate-topology',exactTrackGeometry:false,trainCount:model.trains.length,stationCount:stations.size,linkedStationCount:[...stations.values()].filter(s=>s.sourceId).length}
 };
 networkCache.set(model,result);return result;
}

export function trainGeoPath(model,train){
 const path=[];
 for(const raw of train?.stops||[]){
  const coord=model.data.coordinate?.(raw.geoKey||raw.s);if(!validCoord(coord))continue;
  const point={name:cleanName(raw.s),coord:{lat:+coord.lat,lon:+coord.lon},stop:Boolean(raw.arr||raw.dep)&&!model.data.isPass?.(train,raw.s),raw};
  if(!path.length||path.at(-1).name!==point.name)path.push(point);
 }
 return path;
}

export function stationServices(model,name){
 const normalized=cleanName(name),lines=new Set(),trains=[];
 for(const train of model.trains){
  if((train.stops||[]).some(stop=>cleanName(stop.s)===normalized&&(stop.arr||stop.dep)&&!model.data.isPass?.(train,stop.s))){lines.add(train.line||'노선 미분류');trains.push(train);}
 }
 return {lines:[...lines].sort((a,b)=>a.localeCompare(b,'ko')),trains};
}

export function stationTimetable(model,name){
 const normalized=cleanName(name),rows=[];
 for(const train of model.trains){
  const stops=model.data.stops(train),index=stops.findIndex(stop=>cleanName(stop.s)===normalized);
  if(index<0)continue;const stop=stops[index],origin=stops[0]?.s||'',destination=stops.at(-1)?.s||train.dest||'';
  rows.push({train,stop,origin,destination,line:train.line||'노선 미분류',departure:stop.dep||'',arrival:stop.arr||''});
 }
 const minutes=value=>{const match=String(value||'').match(/^(\d{1,2}):(\d{2})$/);return match?+match[1]*60+ +match[2]:9999;};
 return rows.sort((a,b)=>minutes(a.departure||a.arrival)-minutes(b.departure||b.arrival)||String(a.train.no).localeCompare(String(b.train.no),'ko'));
}

export function trainRunQuery(model,train,date=kstDate()){
 const stops=model.data.stops(train),first=stops.find(stop=>stop.dep),last=[...stops].reverse().find(stop=>stop.arr);
 return first&&last?{from:first.s,to:last.s,date}:null;
}

export function estimatedTrainSnapshot(model,train,now=new Date()){
 const today=kstDate(now);
 for(const date of [today,addDays(today,-1)]){
  const query=trainRunQuery(model,train,date);if(!query)continue;
  try{const snapshot=operationSnapshot(model,train,query,now);if(snapshot.trainPhase==='running')return {snapshot,query};}catch{}
 }
 return null;
}

export function snapshotCoordinate(snapshot){
 const points=snapshot.nodes.filter(node=>validCoord(node.coord)),position=operationPosition(snapshot,points);
 if(!position)return null;
 const a=points[position.index]?.coord,b=points[position.nextIndex]?.coord;if(!a||!b)return null;
 return {lat:a.lat+(b.lat-a.lat)*position.fraction,lon:a.lon+(b.lon-a.lon)*position.fraction};
}

export function activeTrainMarkers(model,now=new Date(),grades=[]){
 const allowed=new Set(grades),markers=[];
 for(const train of model.trains){
  if(allowed.size&&!allowed.has(train.grade))continue;
  const active=estimatedTrainSnapshot(model,train,now);if(!active)continue;
  const coord=snapshotCoordinate(active.snapshot);if(coord)markers.push({coord,train,query:active.query,label:`${train.grade} ${train.no}`});
 }
 return markers;
}

export function mercatorPoint(coord,zoom){
 const size=256*2**zoom,lat=Math.max(-85.05112878,Math.min(85.05112878,+coord.lat)),sin=Math.sin(lat*Math.PI/180);
 return {x:(+coord.lon+180)/360*size,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*size};
}

export function mercatorCoordinate(point,zoom){
 const size=256*2**zoom,lon=point.x/size*360-180,n=Math.PI-2*Math.PI*point.y/size;
 return {lat:180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n))),lon};
}

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lineColor=name=>{let hash=0;for(const char of String(name))hash=(hash*31+char.codePointAt(0))|0;return `hsl(${Math.abs(hash)%360} 62% 46%)`;};

export function mountRailMap(host,options){
 let state={center:options.center||{lat:36.1,lon:127.8},zoom:Math.max(5,Math.min(12,Math.round(options.zoom||6))),network:options.network,paths:options.paths||[],markers:options.markers||[],settings:{tracks:true,stationNames:true,background:true,...options.settings}};
 host.classList.add('rail-map-engine');host.innerHTML='<div class="rail-map-tiles" aria-hidden="true"></div><svg class="rail-map-overlay" role="img" aria-label="NIMBIRAIL 철도 지도"></svg><div class="rail-map-controls"><button type="button" data-map-zoom="in" aria-label="지도 확대">＋</button><button type="button" data-map-zoom="out" aria-label="지도 축소">−</button><button type="button" data-map-home aria-label="전국 보기">⌾</button></div><span class="rail-map-scale"></span><a class="rail-map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';
 const tiles=host.querySelector('.rail-map-tiles'),svg=host.querySelector('.rail-map-overlay'),scale=host.querySelector('.rail-map-scale');
 let frame=0,destroyed=false,pointer=null,moved=false;
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(render);};
 const screen=(coord,center,width,height)=>{const p=mercatorPoint(coord,state.zoom);return {x:p.x-center.x+width/2,y:p.y-center.y+height/2};};
 function render(){
  if(destroyed)return;const width=host.clientWidth||540,height=host.clientHeight||620,center=mercatorPoint(state.center,state.zoom),tileSize=256,worldTiles=2**state.zoom;
  if(state.settings.background){
   const minX=Math.floor((center.x-width/2)/tileSize),maxX=Math.floor((center.x+width/2)/tileSize),minY=Math.floor((center.y-height/2)/tileSize),maxY=Math.floor((center.y+height/2)/tileSize),html=[];
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){if(y<0||y>=worldTiles)continue;const tx=(x%worldTiles+worldTiles)%worldTiles,left=x*tileSize-(center.x-width/2),top=y*tileSize-(center.y-height/2);html.push(`<img src="https://tile.openstreetmap.org/${state.zoom}/${tx}/${y}.png" alt="" loading="lazy" style="left:${left}px;top:${top}px" referrerpolicy="no-referrer">`);}
   tiles.innerHTML=html.join('');tiles.hidden=false;host.querySelector('.rail-map-attribution').hidden=false;
  }else{tiles.innerHTML='';tiles.hidden=true;host.querySelector('.rail-map-attribution').hidden=true;}
  const visible=point=>point.x>-30&&point.y>-30&&point.x<width+30&&point.y<height+30,parts=[];
  if(state.settings.tracks)for(const edge of state.network.edges){const a=screen(edge.a.coord,center,width,height),b=screen(edge.b.coord,center,width,height);if(!visible(a)&&!visible(b)&&((a.x<0&&b.x<0)||(a.x>width&&b.x>width)||(a.y<0&&b.y<0)||(a.y>height&&b.y>height)))continue;const primary=[...edge.lines][0];parts.push(`<line class="rail-network-edge" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" style="--line-color:${lineColor(primary)}"><title>${escapeHtml([...edge.lines].join(' · '))}</title></line>`);}
  for(const path of state.paths){const points=path.points.map(point=>screen(point.coord,center,width,height));if(points.length<2)continue;const color=escapeHtml(path.color||'#176cf4');parts.push(`<polyline class="rail-selected-path" points="${points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" style="--train-color:${color}"></polyline>`);const stops=path.points.map((point,index)=>({point,screen:points[index]})).filter(item=>item.point.stop),labelEvery=Math.max(1,Math.ceil(stops.length/8));stops.forEach((item,index)=>{const show=index===0||index===stops.length-1||index%labelEvery===0;if(!visible(item.screen))return;parts.push(`<g class="rail-route-stop" style="--train-color:${color}"><circle cx="${item.screen.x.toFixed(1)}" cy="${item.screen.y.toFixed(1)}" r="${show?5:3}"></circle>${show?`<text x="${(item.screen.x+8).toFixed(1)}" y="${(item.screen.y-7).toFixed(1)}">${escapeHtml(item.point.name)}</text>`:''}</g>`);});}
  const stationThreshold=state.zoom<=6?80:state.zoom===7?100:state.zoom===8?30:0;
  for(const station of state.network.stations){const p=screen(station.coord,center,width,height);if(!visible(p)||(!station.stopping&&state.zoom<9))continue;const major=station.services>=stationThreshold;if(!major&&state.zoom<8)continue;parts.push(`<g class="rail-station${major?' major':''}" data-map-station="${escapeHtml(station.name)}" tabindex="0" role="button" aria-label="${escapeHtml(station.name)}역 정보"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${major?5:3}"></circle>${state.settings.stationNames&&major?`<text x="${(p.x+8).toFixed(1)}" y="${(p.y-7).toFixed(1)}">${escapeHtml(station.name)}</text>`:''}<title>${escapeHtml(station.name)}역</title></g>`);}
  for(const marker of state.markers){const p=screen(marker.coord,center,width,height);if(!visible(p))continue;parts.push(`<g class="rail-train-marker" data-map-train="${escapeHtml(marker.key||'')}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" tabindex="0" role="button" aria-label="${escapeHtml(marker.label||'열차 위치')}"><circle r="12"></circle><path d="M-5-7h10v12H-5zM-3-4h6v4h-6zM-3 8l-3 4M3 8l3 4"></path><title>${escapeHtml(marker.label||'시간표 기반 열차 위치')}</title></g>`);}
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.innerHTML=parts.join('');scale.textContent=`확대 ${state.zoom} · ${state.network.stations.length.toLocaleString('ko-KR')}개 좌표역`;
 }
 const zoom=delta=>{const next=Math.max(5,Math.min(12,state.zoom+delta));if(next!==state.zoom){state.zoom=next;schedule();}};
 host.querySelector('[data-map-zoom=in]').onclick=()=>zoom(1);host.querySelector('[data-map-zoom=out]').onclick=()=>zoom(-1);host.querySelector('[data-map-home]').onclick=()=>{state.center={lat:36.1,lon:127.8};state.zoom=6;schedule();};
 svg.addEventListener('click',event=>{if(moved)return;const station=event.target.closest('[data-map-station]'),train=event.target.closest('[data-map-train]');if(station)options.onStation?.(station.dataset.mapStation);if(train)options.onTrain?.(train.dataset.mapTrain);});
 svg.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;event.preventDefault();event.target.click();});
 host.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY<0?1:-1);},{passive:false});
 host.addEventListener('pointerdown',event=>{if(event.target.closest('button,a,[data-map-station],[data-map-train]'))return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY,center:mercatorPoint(state.center,state.zoom)};moved=false;host.setPointerCapture(event.pointerId);});
 host.addEventListener('pointermove',event=>{if(!pointer||pointer.id!==event.pointerId)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;moved=moved||Math.abs(dx)+Math.abs(dy)>5;state.center=mercatorCoordinate({x:pointer.center.x-dx,y:pointer.center.y-dy},state.zoom);schedule();});
 const end=event=>{if(pointer?.id===event.pointerId)pointer=null;setTimeout(()=>{moved=false;},0);};host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);
 const observer=new ResizeObserver(schedule);observer.observe(host);render();
 return {update(next){state={...state,...next,settings:{...state.settings,...next.settings}};schedule();},focus(coord,zoom=Math.max(state.zoom,9)){if(validCoord(coord)){state.center={lat:+coord.lat,lon:+coord.lon};state.zoom=zoom;schedule();}},destroy(){destroyed=true;cancelAnimationFrame(frame);observer.disconnect();host.innerHTML='';host.classList.remove('rail-map-engine');}};
}
