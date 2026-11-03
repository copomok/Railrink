import {addDays,kstDate} from './model.js';
import {operationPosition,operationSnapshot} from './operations.js';
import {railServiceDate} from './railway-time.js';

const networkCache=new WeakMap(),routingGraphCache=new WeakMap();
const validCoord=value=>value&&Number.isFinite(+value.lat)&&Number.isFinite(+value.lon)&&Math.abs(+value.lat)<=85&&Math.abs(+value.lon)<=180;
const cleanName=value=>String(value||'').replace(/역$/,'').trim();
const edgeKey=(a,b)=>a<b?`${a}\u0000${b}`:`${b}\u0000${a}`;
const distanceKm=(a,b)=>{const lat=(a.lat+b.lat)*Math.PI/360,x=(b.lon-a.lon)*Math.cos(lat),y=b.lat-a.lat;return Math.hypot(x,y)*111.195;};
// Representative paths came from an older display-only extractor. Some station
// throats contain a short excursion that returns to the same place. Erase only
// those closed excursions, retaining a subsequence of the supplied rail shape.
// Exact save topology is never changed here.
function representativeGeometry(raw){
 let points=(raw||[]).map(([lon,lat])=>({lat:+lat,lon:+lon})).filter(validCoord);if(points.length<4)return points;
 let changed=true;while(changed){changed=false;let best=null;const along=[0];for(let i=1;i<points.length;i++)along[i]=along[i-1]+distanceKm(points[i-1],points[i]);
  for(let i=0;i<points.length-2;i++)for(let j=i+2;j<points.length;j++){const gap=distanceKm(points[i],points[j]),travel=along[j]-along[i],saving=travel-gap;if(gap<=.75&&travel>=2&&travel>=Math.max(gap*4,2)&&(!best||saving>best.saving))best={i,j,saving};}
  if(best){points=[...points.slice(0,best.i+1),...points.slice(best.j)];changed=true;}
 }
 return points;
}
// Station coordinates may describe a platform beside the running line. When
// both neighboring rail points are almost the same, drawing the platform as a
// mandatory vertex creates a visible out-and-back spur. Keep the stop metadata
// while placing that vertex on the verified running line between its neighbors.
function smoothStationApproaches(path){
 const points=path.map(point=>({...point,coord:{...point.coord}}));
 for(let index=1;index<points.length-1;index++){const point=points[index];if(!point.name)continue;const before=points[index-1].coord,after=points[index+1].coord,incoming=distanceKm(before,point.coord),outgoing=distanceKm(point.coord,after),gap=distanceKm(before,after),travel=incoming+outgoing;if(incoming>.8||outgoing>.8||gap>.3||travel<gap*2+.05)continue;point.coord={lat:(before.lat+after.lat)/2,lon:(before.lon+after.lon)/2};}
 return points;
}
const stationAliases=new Map([
 ['고성','고성(강원)'],['신동','신동(태백)'],['춘양','춘양(영동선)'],['장흥','장흥(경전선)']
]),routingAliases=new Map([['은산읍','은산']]),routingName=value=>routingAliases.get(cleanName(value))||cleanName(value);

function stationFor(network,name,coord){
 name=cleanName(name);let station=network.stationByName?.get(stationAliases.get(name))||network.stationByName?.get(name);
 if(station||!validCoord(coord))return station||null;
 let nearest=null,best=Infinity;for(const candidate of network.stations){const current=distanceKm(coord,candidate.coord);if(current<best){best=current;nearest=candidate;}}
 return best<=3?nearest:null;
}

/** Build the NIMBY Rail original mainline map as a station-to-station network. */
export function buildRailNetwork(model){
 if(networkCache.has(model))return networkCache.get(model);
 const stations=new Map(),edges=new Map(),lineCounts=new Map(),mainline=model.data.mainlineMap;
 const ensure=(name,coord,record={})=>{
  name=cleanName(name);if(!name||!validCoord(coord))return null;let station=stations.get(name);
  if(!station){station={name,id:record.id||'',sourceId:record.sourceId||'',coord:{lat:+coord.lat,lon:+coord.lon},lines:new Set(),grades:new Set(),services:0,stopping:false,mapOnly:record.mapOnly!==false,mainline:Boolean(record.mainline)};stations.set(name,station);}
  if(record.mapOnly===false)station.mapOnly=false;if(record.mainline)station.mainline=true;return station;
 };
 if(mainline?.routes?.length){
  for(const route of mainline.routes){let previous=null;for(const [index,raw] of (route.stations||[]).entries()){const station=ensure(raw.name,{lat:raw.lat,lon:raw.lon},{mainline:true});if(!station)continue;station.lines.add(route.line);if(previous&&previous!==station){const segment=(route.routeSegments?.[index-1]||route.segments?.[index-1]||[]).map(([lon,lat])=>({lat:+lat,lon:+lon})).filter(validCoord);if(segment.length>1){const key=edgeKey(previous.name,station.name);let edge=edges.get(key);if(!edge){edge={a:previous,b:station,lines:new Set(),grades:new Set(),services:0,geometry:segment,verified:true};edges.set(key,edge);}edge.lines.add(route.line);}}previous=station;}}
 }else{
  for(const record of model.stationRecords||[])ensure(record.name,record.coordinate,{...record,mapOnly:false});
 }
 let provisional={stations:[...stations.values()],stationByName:stations};
 for(const train of model.trains||[]){
  const line=String(train.line||'노선 미분류'),grade=String(train.grade||'열차');lineCounts.set(line,(lineCounts.get(line)||0)+1);let previous=null;
  for(const raw of train.stops||[]){const coord=model.data.coordinate?.(raw.geoKey||raw.s),station=stationFor(provisional,raw.geoKey||raw.s,coord)||stationFor(provisional,raw.s,coord)||(mainline?null:ensure(raw.s,coord,{mapOnly:false}));if(!station)continue;
   station.lines.add(line);station.grades.add(grade);station.mapOnly=false;if((raw.arr||raw.dep)&&!model.data.isPass?.(train,raw.s)){station.services++;station.stopping=true;}
   if(!mainline&&previous&&previous!==station){const key=edgeKey(previous.name,station.name);let edge=edges.get(key);if(!edge){edge={a:previous,b:station,lines:new Set(),grades:new Set(),services:0,geometry:[previous.coord,station.coord]};edges.set(key,edge);}edge.lines.add(line);edge.grades.add(grade);edge.services++;}previous=station;
  }
 }
 const rawGeometry=(model.data.latestMap?.tracks||[]).filter(path=>Array.isArray(path)&&path.length>1),geometry=[];
 if(rawGeometry.length)geometry.push(...rawGeometry);else for(const route of mainline?.routes||[]){let current=[];for(const raw of route.displaySegments||route.segments||[]){const segment=(raw||[]).filter(([lon,lat])=>Number.isFinite(+lon)&&Number.isFinite(+lat));if(segment.length<2){if(current.length>1)geometry.push(current);current=[];continue;}const joined=current.length&&current.at(-1)[0]===segment[0][0]&&current.at(-1)[1]===segment[0][1];if(current.length&&!joined){geometry.push(current);current=[];}current.push(...(current.length?segment.slice(1):segment));}if(current.length>1)geometry.push(current);}
 const topologyGeometry=(mainline?.topologyLinks||[]).map(link=>link.geometry).filter(path=>Array.isArray(path)&&path.length>1),renderGeometry=topologyGeometry.length?[...geometry,...topologyGeometry]:geometry;
 const result={stations:[...stations.values()],edges:[...edges.values()],geometry,renderGeometry,topologyGeometry,stationByName:stations,
  lines:[...lineCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).map(([name,services])=>({name,services})),
  source:mainline?.source?{...mainline.source,mainlineOnly:false,routeSelectionMainlineOnly:true,exactTrackGeometry:Boolean(rawGeometry.length),rawTrackCount:rawGeometry.length,trainCount:model.trains.length,renderedStationCount:stations.size,linkedStationCount:[...stations.values()].filter(station=>!station.mapOnly).length}:{kind:'timetable-coordinate-topology',mainlineOnly:false,exactTrackGeometry:false,trainCount:model.trains.length,stationCount:stations.size,linkedStationCount:[...stations.values()].filter(station=>!station.mapOnly).length}
 };
 networkCache.set(model,result);return result;
}

export function trainGeoPath(model,train){
 const network=buildRailNetwork(model),path=[];
 for(const raw of train?.stops||[]){const original=model.data.coordinate?.(raw.geoKey||raw.s),routeName=cleanName(raw.geoKey||raw.s)==='은산'&&String(train?.line||'').split('·').includes('만포선')?'은산읍':raw.geoKey||raw.s,station=stationFor(network,routeName,original)||stationFor(network,raw.s,original),coord=station?.coord||original;if(!validCoord(coord))continue;
  const point={name:cleanName(raw.s),stationName:station?.name||'',coord:{lat:+coord.lat,lon:+coord.lon},stop:Boolean(raw.arr||raw.dep)&&!model.data.isPass?.(train,raw.s),raw};if(!path.length||path.at(-1).name!==point.name)path.push(point);
 }
 return path;
}

function stationRoute(model,from,to,line='',grade=''){
 const network=buildRailNetwork(model),start=stationFor(network,from.stationName||from.name,from.coord),end=stationFor(network,to.stationName||to.name,to.coord);if(!start||!end||start===end)return null;
 const variants=[...(model.data.mainlineMap?.routeVariants||[]).filter(item=>item.grade===grade),...(model.data.mainlineMap?.passThroughVariants||[]).filter(item=>item.grades?.includes(grade))].filter(item=>((cleanName(item.from)===start.name&&cleanName(item.to)===end.name)||(cleanName(item.from)===end.name&&cleanName(item.to)===start.name)));
 if(variants.length){const unique=[...new Map(variants.map(item=>[JSON.stringify(item.geometry),item])).values()];if(unique.length!==1)return null;const item=unique[0],forward=cleanName(item.from)===start.name,geometry=(forward?item.geometry:[...item.geometry].reverse()).map(([lon,lat])=>({lat:+lat,lon:+lon}));return {geometry,line:item.grade||item.grades?.join('·')||line,confirmed:true,signature:`variant:${item.sourceVersion}:${item.id||item.lineEntityIds?.join(',')||''}`};}
 const wanted=new Set(String(line).split('·').map(value=>value.trim()).filter(Boolean)),candidates=[];
 for(const route of model.data.mainlineMap?.routes||[]){const names=route.stations.map(station=>cleanName(station.name)),starts=names.flatMap((name,index)=>name===start.name?[index]:[]),ends=names.flatMap((name,index)=>name===end.name?[index]:[]);for(const a of starts)for(const b of ends){if(a===b)continue;const low=Math.min(a,b),high=Math.max(a,b),kinds=route.representativeKinds||[],raw=route.segments.slice(low,high).map((segment,index)=>route.routeSegments?.[low+index]||segment||(kinds[low+index]==='representative'?route.displaySegments?.[low+index]:null));if(raw.length!==high-low||raw.some(segment=>!segment||segment.length<2))continue;const representative=kinds.slice(low,high).some(kind=>kind==='representative')||route.segments.slice(low,high).some((segment,index)=>!segment&&!route.routeSegments?.[low+index]),confirmed=kinds.slice(low,high).some(kind=>kind==='route-confirmed');let segments=raw.map((segment,index)=>kinds[low+index]==='representative'?representativeGeometry(segment):segment.map(([lon,lat])=>({lat:+lat,lon:+lon})));if(a>b)segments=segments.reverse().map(segment=>[...segment].reverse());let geometry=[];for(const segment of segments){if(geometry.length&&(geometry.at(-1).lon!==segment[0].lon||geometry.at(-1).lat!==segment[0].lat)){if(!representative&&!confirmed){geometry=[];break;}segment[0]=geometry.at(-1);}geometry.push(...(geometry.length?segment.slice(1):segment));}if(geometry.length>1)candidates.push({geometry,line:route.line,span:high-low,representative,confirmed,signature:confirmed?`route-confirmed:${route.id}:${low}:${high}`:representative?`representative:${JSON.stringify(geometry)}`:JSON.stringify((a>b?[...route.segmentSources.slice(low,high)].reverse():route.segmentSources.slice(low,high)))});}}
 const confirmed=candidates.filter(candidate=>candidate.confirmed&&!candidate.representative),basis=confirmed.length?confirmed:candidates,preferred=basis.filter(candidate=>wanted.has(candidate.line)),matching=preferred.length?preferred:basis,minSpan=Math.min(...matching.map(candidate=>candidate.span)),pool=matching.filter(candidate=>candidate.span===minSpan),unique=[...new Map(pool.map(candidate=>[JSON.stringify(candidate.geometry),candidate])).values()];if(unique.length===1)return unique[0];if(candidates.length)return null;return graphStationRoute(model,start,end,wanted);
}

function routingGraph(model){
 if(routingGraphCache.has(model))return routingGraphCache.get(model);const adjacency=new Map(),cache=new Map(),add=(name,edge)=>{if(!adjacency.has(name))adjacency.set(name,[]);adjacency.get(name).push(edge);};
 for(const route of model.data.mainlineMap?.routes||[])for(let index=0;index<route.stations.length-1;index++){const kind=route.representativeKinds?.[index]||(route.segments?.[index]?'exact':'unavailable'),raw=route.routeSegments?.[index]||route.segments?.[index]||(kind==='representative'?route.displaySegments?.[index]:null);if(!raw?.length||raw.length<2)continue;const from=routingName(route.stations[index].name),to=routingName(route.stations[index+1].name),geometry=kind==='representative'?representativeGeometry(raw):raw.map(([lon,lat])=>({lat:+lat,lon:+lon})),length=geometry.slice(1).reduce((sum,point,i)=>sum+distanceKm(geometry[i],point),0),base={line:route.line,representative:kind==='representative',confirmed:kind==='route-confirmed',length};add(from,{...base,to,geometry});add(to,{...base,to:from,geometry:[...geometry].reverse()});}
 for(const item of model.data.mainlineMap?.bypassSegments||[]){const geometry=item.geometry.map(([lon,lat])=>({lat:+lat,lon:+lon})),length=geometry.slice(1).reduce((sum,point,i)=>sum+distanceKm(geometry[i],point),0),from=routingName(item.from),to=routingName(item.to),base={line:item.line,representative:false,confirmed:true,length};add(from,{...base,to,geometry});add(to,{...base,to:from,geometry:[...geometry].reverse()});}
 const graph={adjacency,cache};routingGraphCache.set(model,graph);return graph;
}

function graphStationRoute(model,start,end,wanted){
 const graph=routingGraph(model),lines=[...wanted].sort(),startName=routingName(start.name),endName=routingName(end.name),key=`${startName}\0${endName}\0${lines.join('·')}`;if(graph.cache.has(key))return graph.cache.get(key);const reverseKey=`${endName}\0${startName}\0${lines.join('·')}`;if(graph.cache.has(reverseKey)){const known=graph.cache.get(reverseKey),value=known?{...known,geometry:[...known.geometry].reverse()}:null;graph.cache.set(key,value);return value;}
 const costs=new Map([[startName,0]]),previous=new Map(),queue=[[0,startName]];while(queue.length){queue.sort((a,b)=>a[0]-b[0]);const [cost,current]=queue.shift();if(cost!==costs.get(current))continue;if(current===endName)break;for(const edge of graph.adjacency.get(current)||[]){const penalty=wanted.size&&!wanted.has(edge.line)?4:1,next=cost+edge.length*penalty;if(next>= (costs.get(edge.to)??Infinity))continue;costs.set(edge.to,next);previous.set(edge.to,{from:current,edge});queue.push([next,edge.to]);}}
 if(!Number.isFinite(costs.get(endName))){graph.cache.set(key,null);return null;}const edges=[];for(let current=endName;current!==startName;){const step=previous.get(current);if(!step){graph.cache.set(key,null);return null;}edges.push(step.edge);current=step.from;}edges.reverse();const total=edges.reduce((sum,edge)=>sum+edge.length,0),direct=distanceKm(start.coord,end.coord);if(total>Math.max(direct*3,direct+30)){graph.cache.set(key,null);return null;}const geometry=[];let representative=false,confirmed=false;for(const edge of edges){const part=edge.geometry.map(point=>({...point}));representative||=edge.representative;confirmed||=edge.confirmed;if(geometry.length)part[0]=geometry.at(-1);geometry.push(...(geometry.length?part.slice(1):part));}const value=geometry.length>1?{geometry,line:lines.join('·'),representative,confirmed,signature:`graph:${key}`}:null;graph.cache.set(key,value);return value;
}

export function trainTrackRoute(model,train){
 const waypoints=trainGeoPath(model,train),network=buildRailNetwork(model),rawMapped=[];
 for(const waypoint of waypoints){const station=stationFor(network,waypoint.stationName||waypoint.name,waypoint.coord);if(station&&rawMapped.at(-1)?.station!==station)rawMapped.push({...waypoint,station,stationName:station.name,coord:station.coord});}
 const shortcuts=[...(model.data.mainlineMap?.passThroughVariants||[]),...(model.data.mainlineMap?.bypassSegments||[])].filter(item=>!item.grades||item.grades.includes(train?.grade)),mapped=[...rawMapped];
 for(const item of shortcuts){const allowed=new Set((Array.isArray(item.via)?item.via:[item.via]).filter(Boolean).map(cleanName));for(let index=0;index<mapped.length-2;index++){const from=mapped[index].station.name,forward=cleanName(item.from)===from,target=forward?cleanName(item.to):cleanName(item.from);if(!forward&&cleanName(item.to)!==from)continue;let end=index+1;while(end<mapped.length&&mapped[end].station.name!==target&&allowed.has(mapped[end].station.name)&&!mapped[end].stop)end++;if(end>index+1&&mapped[end]?.station.name===target)mapped.splice(index+1,end-index-1);}}
 if(mapped.length<2)return {paths:[],missingSegments:Math.max(0,waypoints.length-1),fallbackSegments:0,matched:false,verified:false,waypoints};
 const paths=[];let current=[],missingSegments=0,fallbackSegments=0,confirmedSegments=0;for(let index=1;index<mapped.length;index++){const from=mapped[index-1],to=mapped[index],route=stationRoute(model,from,to,train?.line,train?.grade);if(!route){missingSegments++;if(current.length>1)paths.push(current);current=[];continue;}if(route.representative)fallbackSegments++;if(route.confirmed)confirmedSegments++;const points=route.geometry.map(coord=>({coord,stop:false,name:''}));points[0]={...points[0],stop:from.stop,name:from.name};points.at(-1).stop=to.stop;points.at(-1).name=to.name;const sameStation=current.length&&current.at(-1).name===points[0].name;if(sameStation)points[0].coord=current.at(-1).coord;const joined=sameStation||(current.length&&current.at(-1).coord.lon===points[0].coord.lon&&current.at(-1).coord.lat===points[0].coord.lat);if(current.length&&!joined){paths.push(current);current=[];}current.push(...(current.length?points.slice(1):points));}if(current.length>1)paths.push(current);
 const smoothedPaths=paths.map(smoothStationApproaches);return {paths:smoothedPaths,missingSegments,fallbackSegments,confirmedSegments,matched:paths.length>0&&missingSegments===0,verified:paths.length>0&&missingSegments===0&&fallbackSegments===0,waypoints};
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
 const selected=trainSnapshotAt(model,train,now);return selected?.snapshot.trainPhase==='running'?selected:null;
}

export function trainSnapshotAt(model,train,now=new Date()){
 const today=kstDate(now),service=railServiceDate(now),dates=[service,today,addDays(service,-1),addDays(today,-1)].filter((date,index,all)=>all.indexOf(date)===index),runs=[];
 for(const date of dates){const query=trainRunQuery(model,train,date);if(!query)continue;try{runs.push({snapshot:operationSnapshot(model,train,query,now),query});}catch{}}
 return runs.find(run=>run.snapshot.trainPhase==='running')||runs.filter(run=>run.snapshot.trainPhase==='before').sort((a,b)=>a.snapshot.departure-b.snapshot.departure)[0]||runs.sort((a,b)=>b.snapshot.arrival-a.snapshot.arrival)[0]||null;
}

export function snapshotCoordinate(snapshot){
 const points=snapshot.nodes.filter(node=>validCoord(node.coord)),position=operationPosition(snapshot,points);
 if(!position)return null;
 const a=points[position.index]?.coord,b=points[position.nextIndex]?.coord;if(!a||!b)return null;
 return {lat:a.lat+(b.lat-a.lat)*position.fraction,lon:a.lon+(b.lon-a.lon)*position.fraction};
}

export function snapshotTrackCoordinate(model,train,snapshot){
 const nodes=snapshot.nodes.filter(node=>validCoord(node.coord)),position=operationPosition(snapshot,nodes);if(!position)return null;
 const a=nodes[position.index],b=nodes[position.nextIndex];if(!a||!b)return null;if(a===b||position.index===position.nextIndex){const network=buildRailNetwork(model),station=stationFor(network,a.s,a.coord);if(!station)return null;const matches=[];for(const route of model.data.mainlineMap?.routes||[]){for(const [index,raw] of route.stations.entries()){if(cleanName(raw.name)!==station.name)continue;const before=route.segments?.[index-1],after=route.segments?.[index];if(before?.length>1)matches.push(before.at(-1));if(after?.length>1)matches.push(after[0]);}}const unique=[...new Map(matches.map(([lon,lat])=>[`${lon},${lat}`,{lat:+lat,lon:+lon}])).values()];return unique.length===1?unique[0]:null;}
 const route=stationRoute(model,{name:a.s,coord:a.coord},{name:b.s,coord:b.coord},train?.line,train?.grade)?.geometry;if(!route?.length)return null;
 const lengths=[];let total=0;for(let index=1;index<route.length;index++){total+=distanceKm(route[index-1],route[index]);lengths.push(total);}const target=total*position.fraction,index=lengths.findIndex(value=>value>=target);if(index<0)return route.at(-1);const before=index?lengths[index-1]:0,span=lengths[index]-before||1,fraction=(target-before)/span,from=route[index],to=route[index+1];return {lat:from.lat+(to.lat-from.lat)*fraction,lon:from.lon+(to.lon-from.lon)*fraction};
}

export function activeTrainMarkers(model,now=new Date(),grades=[]){
 const allowed=new Set(grades),markers=[];
 for(const train of model.trains){
  if(allowed.size&&!allowed.has(train.grade))continue;
  const active=estimatedTrainSnapshot(model,train,now);if(!active)continue;
  const coord=snapshotTrackCoordinate(model,train,active.snapshot);markers.push({coord,train,query:active.query,snapshot:active.snapshot,color:model.data.colors?.[train.grade]||'#176cf4',label:`${train.grade} ${train.no}`,pathAvailable:Boolean(coord)});
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
 tiles.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement)event.target.remove();},true);
 let frame=0,destroyed=false,pointer=null,moved=false,geometryZoom=-1,geometrySource=null,projectedGeometry=[];
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(render);};
 const screen=(coord,center,width,height)=>{const p=mercatorPoint(coord,state.zoom);return {x:p.x-center.x+width/2,y:p.y-center.y+height/2};};
 const geometry=()=>{const source=state.network.renderGeometry||state.network.geometry;if(geometryZoom!==state.zoom||geometrySource!==source){geometryZoom=state.zoom;geometrySource=source;projectedGeometry=(geometrySource||[]).map(path=>path.map(([lon,lat])=>mercatorPoint({lat,lon},state.zoom)));}return projectedGeometry;};
 function render(){
  if(destroyed)return;const width=host.clientWidth||540,height=host.clientHeight||620,center=mercatorPoint(state.center,state.zoom),tileSize=256,worldTiles=2**state.zoom;
  host.style.setProperty('--rail-track-width',`${state.zoom<=6?2:state.zoom<=9?3:4.2}px`);host.style.setProperty('--rail-selected-width',`${state.zoom<=6?5.5:state.zoom<=9?6.5:7.5}px`);
  if(state.settings.background){
   const minX=Math.floor((center.x-width/2)/tileSize),maxX=Math.floor((center.x+width/2)/tileSize),minY=Math.floor((center.y-height/2)/tileSize),maxY=Math.floor((center.y+height/2)/tileSize),html=[];
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){if(y<0||y>=worldTiles)continue;const tx=(x%worldTiles+worldTiles)%worldTiles,left=x*tileSize-(center.x-width/2),top=y*tileSize-(center.y-height/2);html.push(`<img src="https://tile.openstreetmap.org/${state.zoom}/${tx}/${y}.png" alt="" loading="lazy" style="left:${left}px;top:${top}px" referrerpolicy="no-referrer">`);}
   tiles.innerHTML=html.join('');tiles.hidden=false;host.querySelector('.rail-map-attribution').hidden=false;
  }else{tiles.innerHTML='';tiles.hidden=true;host.querySelector('.rail-map-attribution').hidden=true;}
  const visible=point=>point.x>-30&&point.y>-30&&point.x<width+30&&point.y<height+30,parts=[],labelCells=new Set(),labelCell=point=>`${Math.floor(point.x/88)},${Math.floor(point.y/34)}`;
  if(state.settings.tracks&&state.network.geometry?.length){const commands=[];for(const path of geometry()){if(path.length<2)continue;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const point of path){const x=point.x-center.x+width/2,y=point.y-center.y+height/2;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(maxX<-30||minX>width+30||maxY<-30||minY>height+30)continue;commands.push(path.map((point,index)=>`${index?'L':'M'}${(point.x-center.x+width/2).toFixed(1)} ${(point.y-center.y+height/2).toFixed(1)}`).join(''));}if(commands.length)parts.push(`<path class="rail-source-track" d="${commands.join('')}"><title>NIMBY Rails 원본 일반철도 노선도</title></path>`);}
  else if(state.settings.tracks)for(const edge of state.network.edges){const a=screen(edge.a.coord,center,width,height),b=screen(edge.b.coord,center,width,height);if(!visible(a)&&!visible(b)&&((a.x<0&&b.x<0)||(a.x>width&&b.x>width)||(a.y<0&&b.y<0)||(a.y>height&&b.y>height)))continue;const primary=[...edge.lines][0];parts.push(`<line class="rail-network-edge" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" style="--line-color:${lineColor(primary)}"><title>${escapeHtml([...edge.lines].join(' · '))}</title></line>`);}
  for(const path of state.paths){const points=path.points.map(point=>screen(point.coord,center,width,height));if(points.length<2)continue;const color=escapeHtml(path.color||'#176cf4');parts.push(`<polyline class="rail-selected-path" points="${points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" style="--train-color:${color}"></polyline>`);const stops=path.points.map((point,index)=>({point,screen:points[index]})).filter(item=>item.point.stop),labelEvery=Math.max(1,Math.ceil(stops.length/8));stops.forEach((item,index)=>{const show=index===0||index===stops.length-1||index%labelEvery===0;if(!visible(item.screen))return;if(show)labelCells.add(labelCell(item.screen));parts.push(`<g class="rail-route-stop" style="--train-color:${color}"><circle cx="${item.screen.x.toFixed(1)}" cy="${item.screen.y.toFixed(1)}" r="${show?5:3}"></circle>${show?`<text x="${(item.screen.x+8).toFixed(1)}" y="${(item.screen.y-7).toFixed(1)}">${escapeHtml(item.point.name)}</text>`:''}</g>`);});}
  const stationThreshold=state.zoom<=6?100:state.zoom===7?120:state.zoom===8?60:state.zoom===9?20:state.zoom===10?5:0;
  for(const station of state.network.stations){if(station.mapOnly)continue;const p=screen(station.coord,center,width,height);if(!visible(p)||(!station.stopping&&state.zoom<9))continue;const major=station.stopping&&(stationThreshold===0||station.services>=stationThreshold);if(!major&&state.zoom<9)continue;const cell=labelCell(p),showName=state.settings.stationNames&&(major||state.zoom>=11)&&!labelCells.has(cell);if(showName)labelCells.add(cell);parts.push(`<g class="rail-station${major?' major':''}" data-map-station="${escapeHtml(station.name)}" tabindex="0" role="button" aria-label="${escapeHtml(station.name)}역 정보"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${major?5:3}"></circle>${showName?`<text x="${(p.x+8).toFixed(1)}" y="${(p.y-7).toFixed(1)}">${escapeHtml(station.name)}</text>`:''}<title>${escapeHtml(station.name)}역</title></g>`);}
  for(const marker of state.markers){const p=screen(marker.coord,center,width,height);if(!visible(p))continue;parts.push(`<g class="rail-train-marker${marker.selected?' selected':''}" style="--marker-color:${escapeHtml(marker.color||'#176cf4')}" data-map-train="${escapeHtml(marker.key||'')}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" tabindex="0" role="button" aria-label="${escapeHtml(marker.label||'열차 위치')}"><circle r="${marker.selected?15:11}"></circle><path d="M-5-7h10v12H-5zM-3-4h6v4h-6zM-3 8l-3 4M3 8l3 4"></path><title>${escapeHtml(marker.label||'시간표 기반 열차 위치')}</title></g>`);}
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
 return {update(next){state={...state,...next,settings:{...state.settings,...next.settings}};schedule();},focus(coord,zoom=Math.max(state.zoom,9)){if(validCoord(coord)){state.center={lat:+coord.lat,lon:+coord.lon};state.zoom=zoom;schedule();}},fit(coords,padding={top:120,right:40,bottom:220,left:40}){const valid=coords.filter(validCoord);if(!valid.length)return;const base=valid.map(coord=>mercatorPoint(coord,0)),minX=Math.min(...base.map(point=>point.x)),maxX=Math.max(...base.map(point=>point.x)),minY=Math.min(...base.map(point=>point.y)),maxY=Math.max(...base.map(point=>point.y)),width=Math.max(120,host.clientWidth-padding.left-padding.right),height=Math.max(120,host.clientHeight-padding.top-padding.bottom),zoom=Math.max(5,Math.min(11,Math.floor(Math.log2(Math.min(width/Math.max(.000001,maxX-minX),height/Math.max(.000001,maxY-minY))))));state.zoom=zoom;state.center=mercatorCoordinate({x:(minX+maxX)/2*2**zoom,y:(minY+maxY)/2*2**zoom},zoom);schedule();},destroy(){destroyed=true;cancelAnimationFrame(frame);observer.disconnect();host.innerHTML='';host.classList.remove('rail-map-engine');}};
}
