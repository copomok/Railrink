import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {runtimeSource,sharedFiles,sourceRoot,tokenSource,ticketExcludedFiles} from '../tools/source.mjs';
import {createModel,kstDate,addDays,STORE_KEY} from '../js/model.js';
import {buildRailNetwork,trainTrackRoute} from '../js/rail-map.js';
const memory=new Map();
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const context={console,localStorage:storage,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){}};
context.window=context;
vm.createContext(context);
vm.runInContext(runtimeSource(),context);
const model=createModel(context.RailData,storage);
context.loadTickets=()=>model.read().tickets.map(t=>({...t,travelDate:t.serviceDate||t.travelDate}));
const q={from:'서울',to:'부산',date:addDays(kstDate(),1),pax:1,cls:'general',grade:'all',sort:'departure',after:''};
const reset=()=>{memory.clear();context.RailData.invalidate();};
const candidate=(query=q)=>model.search(query).find(r=>!r.departed&&model.availability(r.train,query).available>=+query.pax);
function draftFor(r,query=q) {return {key:r.key,q:{...query},seats:model.seats(r.train,query).flatMap(c=>c.seats).filter(s=>!s.blocked).slice(0,+query.pax).map(s=>s.id),names:Array(+query.pax).fill('테스트'),discount:'none'};}
test('both apps consume the original files and one shared railway domain',()=>{
  assert.ok(context.RailData.trains.length>1800);
  assert.deepEqual(model.stationRecords.find(station=>station.name==='서울').coordinate,context.RailData.coordinate('서울'));
  assert.ok(sharedFiles().includes('js/shared/nimbi_rail_domain.js'));
  assert.ok(sharedFiles().includes('data/nimbi_global_schedule_revision.js'));
  assert.ok(ticketExcludedFiles.every(file=>!sharedFiles().includes(file)));
  assert.ok(sharedFiles().length<30);
  assert.ok(sharedFiles().includes('data/nimbi_mainline_map.js'));
  assert.ok(sharedFiles().includes('data/nimbi_latest_map.js'));
  assert.ok(fs.statSync(path.join(sourceRoot,'data/nimbi_mainline_map.js')).size<288*1024);
  assert.ok(sharedFiles().reduce((bytes,file)=>bytes+fs.statSync(path.join(sourceRoot,file)).size,0)<6*1024*1024);
  const network=buildRailNetwork(model);assert.equal(network.source.kind,'nimby-map-lines-exact-topology');assert.equal(network.source.mainlineOnly,false);assert.equal(network.source.routeSelectionMainlineOnly,true);assert.equal(network.source.routeCount,56);assert.equal(network.source.rawTrackCount,12980);assert.equal(network.source.exactTrackGeometry,true);assert.equal(network.source.syntheticEdgeCount,0);assert.equal(network.source.verifiedTopologyLinkCount,8);assert.equal(network.source.verifiedBypassCount,2);assert.equal(network.source.passThroughVariantCount,1);assert.equal(network.source.verifiedSegments,176);assert.equal(network.source.routeConfirmedSegments,28);assert.equal(network.source.representativeSegments,271);assert.equal(network.geometry.length,12980);assert.equal(network.topologyGeometry.length,8);assert.equal(network.renderGeometry.length,12988);
  assert.ok(context.RailData.mainlineMap.routes.every(route=>!/(도시철도|광주1호선|서울[1-9]호선)/.test(route.line)));
  for(const number of ['2038','8039','1142','1198']){const train=model.trains.find(item=>String(item.no)===number),route=trainTrackRoute(model,train);assert.equal(route.paths.length,1,number);assert.equal(route.missingSegments,0,number);assert.ok(route.fallbackSegments>0,number);assert.equal(route.verified,false,number);}
  const busanExpress=model.trains.find(train=>['KTX','KTX-산천','SRT'].some(grade=>String(train.grade).startsWith(grade))&&train.stops.some((stop,index)=>stop.s==='청도'&&train.stops[index+1]?.s==='부산'));assert.ok(busanExpress,'청도-부산 고속열차가 필요합니다.');const busanRoute=trainTrackRoute(model,busanExpress),points=busanRoute.paths[0],cheongdo=points.findIndex(point=>point.name==='청도'),busan=points.findIndex((point,index)=>index>cheongdo&&point.name==='부산'),highSpeed=points.slice(cheongdo,busan+1).map(point=>point.coord);assert.ok(highSpeed.some(point=>Math.abs(point.lon-129.006082)<1e-6&&Math.abs(point.lat-35.395952)<1e-6));assert.ok(!highSpeed.some(point=>point.lon<128.85&&point.lat>35.47&&point.lat<35.53),'청도-부산 고속열차가 밀양 정차축을 사용합니다.');
  const routePoints=no=>trainTrackRoute(model,model.trains.find(train=>String(train.no)===no)).paths.flat().map(point=>point.coord),has=(points,lon,lat)=>points.some(point=>Math.abs(point.lon-lon)<1e-6&&Math.abs(point.lat-lat)<1e-6);
  const gangneung=routePoints('1234');assert.ok(has(gangneung,128.885778,37.739533));assert.ok(!has(gangneung,128.894021,37.758135));
  const yeongdong=routePoints('1503');assert.ok(has(yeongdong,127.793238,36.171838));assert.ok(!has(yeongdong,127.780379,36.174695));
  const daegu=routePoints('1117');assert.ok(has(daegu,128.963829,35.806281));assert.ok(!has(daegu,128.979131,35.834494));
  const pyeongchang=routePoints('698');assert.ok(has(pyeongchang,128.462296,37.464555));assert.ok(!has(pyeongchang,128.460107,37.495142));
  const seoulCity=routePoints('501'),hangangOrigin=routePoints('221');assert.ok(has(seoulCity,126.917462,37.501305));assert.ok(!has(seoulCity,126.87936,37.498845));assert.ok(has(hangangOrigin,126.87936,37.498845));assert.ok(!has(hangangOrigin,126.917462,37.501305));
  const mapoSeoul=routePoints('701');assert.ok(has(mapoSeoul,126.9714,37.557301));assert.ok(has(mapoSeoul,126.971424,37.540727));assert.ok(has(mapoSeoul,126.979654,37.535017));assert.ok(!has(mapoSeoul,126.973871,37.556136));assert.ok(!has(mapoSeoul,126.980917,37.554249));
  const jungang=routePoints('1062');assert.ok(has(jungang,128.705686,36.178511));assert.ok(!has(jungang,128.721492,36.170502));assert.ok(!has(jungang,128.696073,36.115641));
  const northbound=routePoints('8022');assert.ok(has(northbound,126.896959,37.376851));assert.ok(!has(northbound,126.891416,37.376859));assert.ok(!has(northbound,126.90716,37.371245));assert.ok(!has(northbound,126.904294,37.574218));
  const boeun=routePoints('1241');for(const [lon,lat] of [[127.734514,36.480797],[127.748419,36.479987],[127.760575,36.480469],[127.781009,36.471328]])assert.ok(has(boeun,lon,lat),`1241 보은-장안 복구 좌표 ${lon},${lat}`);
  const distance=(a,b)=>Math.hypot((a.lon-b.lon)*88,(a.lat-b.lat)*111);for(const train of model.trains){const route=trainTrackRoute(model,train);assert.equal(route.paths.length,1,`${train.grade} ${train.no}`);assert.equal(route.missingSegments,0,`${train.grade} ${train.no}`);for(const path of route.paths)for(let index=1;index<path.length-1;index++){if(!path[index].name)continue;const incoming=distance(path[index-1].coord,path[index].coord),outgoing=distance(path[index].coord,path[index+1].coord),gap=distance(path[index-1].coord,path[index+1].coord);assert.ok(incoming>.8||outgoing>.8||gap>.3||incoming+outgoing<gap*2+.05,`${train.no} ${path[index].name} 역 진입 왕복`);}}
  const html=fs.readFileSync(path.join(sourceRoot,'index.html'),'utf8');
  assert.match(html,/src="js\/shared\/nimbi_rail_domain.js/);
  const original=fs.readFileSync(path.join(sourceRoot,'js/nimbi_rail.js'),'utf8');
  assert.doesNotMatch(original,/function getCarComposition\(/);
  assert.match(tokenSource(),/--c-ktx:#3b82f6/);
  assert.equal(context.RailData.cars('itx-sm')[2].totalSeats,46);
  assert.ok(context.RailData.cars('itx-sm')[2].facilities.start.some(f=>f.label==='AED'));
});
test('search rejects invalid dates, same stations and unsupported classes',()=>{
  for(const change of [{from:'없는 역'},{to:'서울'},{date:'2026-02-31'},{date:addDays(kstDate(),31)},{pax:0},{pax:7},{cls:'unknown'}]) assert.throws(()=>model.search({...q,...change}));
  assert.equal(kstDate(new Date('2026-10-29T16:00:00Z')),'2026-10-30');
});
test('search respects direction, timed service stops, grade and sort',()=>{
  const results=model.search(q);assert.ok(results.length>0);
  for(const r of results) {assert.ok(r.seg.fi<r.seg.ti);assert.equal(r.seg.stops[r.seg.fi].s,q.from);assert.equal(r.seg.stops[r.seg.ti].s,q.to);}
  const fares=Array.from(model.search({...q,sort:'fare'}),r=>r.fare);assert.deepEqual(fares,[...fares].sort((a,b)=>a-b));
  const late=Array.from(model.search({...q,sort:'departure-desc'}),r=>r.departure);assert.deepEqual(late,[...late].sort((a,b)=>b-a));
  const arrivals=Array.from(model.search({...q,sort:'arrival'}),r=>r.arrival);assert.deepEqual(arrivals,[...arrivals].sort((a,b)=>a-b));
  assert.ok(model.search({...q,grade:'SRT'}).every(r=>r.train.grade==='SRT'));
  assert.equal(model.segment({stops:[{s:'A',dep:'08:00'},{s:'B',arr:'08:20',dep:null},{s:'C',arr:'09:00'}]},'A','B'),null);
});
test('search applies an inclusive recommended departure window',()=>{
 const rows=model.search({...q,after:'10:00',before:'12:00'});assert.ok(rows.length>0);assert.ok(rows.every(row=>{const [hour,minute]=row.seg.dep.split(':').map(Number),value=hour*60+minute;return value>=600&&value<=720;}));
 assert.throws(()=>model.search({...q,before:'25:00'}),/종료 시각/);
});
test('seat layout preserves missing seats and real numbering',()=>{
  const cars=context.RailData.cars('itx-sm');assert.equal(cars[0].missingSeats.length,2);
  assert.equal(context.RailData.seatId(context.RailData.cars('mgh')[0],1,'1'),'1호차 3번');
  const r=candidate();const seats=model.seats(r.train,q).flatMap(c=>c.seats);assert.equal(new Set(seats.map(s=>s.id)).size,seats.length);
});
test('booking persists separately, rejects duplicate seats and cancels without money',()=>{
  reset();const r=candidate(),draft=draftFor(r),ticket=model.book(draft);
  assert.equal(model.read().tickets.length,1);assert.equal(ticket.paymentMode,'virtual');assert.equal('names' in ticket,false);assert.equal(memory.has('nimbi_tickets'),false);
  assert.throws(()=>model.book(draft),/좌석 상태/);
  model.cancel(ticket.id);assert.equal(model.read().tickets[0].status,'cancelled');
  assert.equal(model.read().tickets[0].refund,ticket.totalFare);
  assert.throws(()=>model.cancel(ticket.id),/이미/);
});
test('change is atomic and keeps the original if replacement validation fails',()=>{
  reset();const a=candidate(),ticket=model.book(draftFor(a));
  const b=model.search(q).find(r=>r.key!==a.key&&model.availability(r.train,q).available>0);
  const replacement=draftFor(b);assert.throws(()=>model.book({...replacement,seats:['invalid']},ticket.id));
  assert.equal(model.read().tickets[0].status,'active');
  const next=model.book(replacement,ticket.id);assert.equal(model.read().tickets[0].status,'changed');assert.equal(next.replaces,ticket.id);
});
test('anonymous booking, discounts, read-only storage and corrupted storage fail honestly',()=>{
  reset();const r=candidate(),draft=draftFor(r);
  assert.throws(()=>model.book({...draft,discount:'fake'}),/할인/);
  const ticket=model.book({...draft,discount:'child'});assert.equal(ticket.totalFare,context.RailData.discount(r.fare,'child'));
  const broken=createModel(context.RailData,{getItem:()=>null,setItem(){throw Error('Quota exceeded');}});
  assert.throws(()=>broken.save(broken.read()),/예약을 저장하지 못했습니다/);
  memory.set(STORE_KEY,'broken');assert.throws(()=>model.read(),/읽을 수/);assert.equal(memory.get(STORE_KEY),'broken');reset();
});
test('wait records do not create tickets or imaginary queue positions',()=>{
  reset();const r=candidate();model.watch(r.key,q);model.watch(r.key,q);
  assert.equal(model.read().watches.length,1);assert.equal(model.read().tickets.length,0);assert.equal(model.read().watches[0].queuePosition,undefined);
});
test('same-day search excludes departures at or before the Korean current instant',()=>{
 reset();const r=model.search(q)[0],fixed=new Date(`${q.date}T${r.seg.dep.padStart(5,'0')}:00+09:00`),atDeparture=createModel(context.RailData,storage,()=>fixed);
 const rows=atDeparture.search(q);assert.ok(rows.length>0);assert.ok(rows.every(x=>atDeparture.departure(x.seg,q.date)>fixed));assert.ok(!rows.some(x=>x.key===r.key));
 const withDeparted=atDeparture.search({...q,hideDeparted:false});assert.ok(withDeparted.some(x=>x.key===r.key&&x.departed));
 const tomorrow={...q,date:addDays(q.date,1)};assert.ok(atDeparture.search(tomorrow).some(x=>x.key===r.key));
 const justBefore=createModel(context.RailData,storage,()=>new Date(+fixed-1000));assert.ok(justBefore.search(q).some(x=>x.key===r.key));
});
test('multi-leg booking writes once, validates all legs first and cancels as a group',()=>{
 reset();const a=candidate(),backQ={...q,from:q.to,to:q.from,date:addDays(q.date,1)},b=candidate(backQ),first=draftFor(a),second=draftFor(b,backQ);
 assert.throws(()=>model.bookMany([first,{...second,seats:['invalid']}],{type:'roundtrip'}),/좌석/);assert.equal(model.read().tickets.length,0);
 const group=model.bookMany([first,second],{type:'roundtrip'});assert.equal(group.length,2);assert.equal(group[0].groupId,group[1].groupId);assert.equal(group[0].groupType,'roundtrip');assert.ok(group[0].fromStationId.startsWith('nimby:'));assert.equal(group[0].fromStationId,model.stationRecords.find(s=>s.name===q.from).id);assert.ok(group[0].arrival);
 model.cancel(group[1].id);assert.ok(model.read().tickets.every(t=>t.status==='cancelled'));
 model.removeHistory(group[0].id);assert.equal(model.read().tickets.length,0);
});
test('overlapping legs and readonly storage never leave a partial journey',()=>{
 reset();const a=candidate(),first=draftFor(a);
 assert.throws(()=>model.bookMany([first,{...first}]),/겹칩니다/);assert.equal(model.read().tickets.length,0);
 const broken=createModel(context.RailData,{getItem:()=>null,setItem(){throw Error('Quota');}});assert.throws(()=>broken.bookMany([first]),/예약을 저장하지 못했습니다/);assert.equal(model.read().tickets.length,0);
});
test('per-passenger discounts, automatic seats and pass records use canonical rules',()=>{
 reset();const pairQ={...q,pax:2},a=candidate(pairQ),assignment=model.autoAssign(a.train,pairQ,'window');assert.equal(assignment.seats.length,2);assert.equal(new Set(assignment.seats).size,2);
 const draft={...draftFor(a,pairQ),seats:assignment.seats,discounts:['none','child']};const [ticket]=model.bookMany([draft],{type:'pass',pass:{name:'주간 일정'}});
 assert.equal(ticket.totalFare,a.fare+context.RailData.discount(a.fare,'child'));assert.equal(model.read().passes[0].id,ticket.passId);assert.equal(ticket.groupId,undefined);
 assert.throws(()=>model.removeHistory(ticket.id),/예정된/);
});
