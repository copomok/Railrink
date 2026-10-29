import test from 'node:test';import assert from 'node:assert/strict';
import {createModel} from '../js/model.js';import {serviceTimeline,stationId} from '../js/railway-time.js';
import {operationSnapshot} from '../js/operations.js';
const trains=[
 {no:'A',grade:'KTX',line:'test',dest:'환승',stops:[{s:'출발',dep:'23:40'},{s:'통과',pass:true},{s:'환승',arr:'0:05',dep:'0:06'}]},
 {no:'B',grade:'KTX',line:'test',dest:'도착',stops:[{s:'환승',dep:'0:10'},{s:'도착',arr:'0:40'}]},
 {no:'C',grade:'KTX',line:'test',dest:'도착',stops:[{s:'환승',dep:'0:06'},{s:'도착',arr:'0:30'}]}
];
const data={trains,stops:t=>t.stops.filter(s=>!s.pass),classCars:c=>c,cars:()=>[{}],formation:()=>'',fare:()=>1000,coordinate:s=>({lon:{출발:0,통과:1,환승:2,도착:3}[s],lat:0}),isPass:(t,s)=>t.stops.find(n=>n.s===s)?.pass};
const model=createModel(data,{getItem:()=>null},()=>new Date('2026-10-29T03:00:00Z'));
const q={from:'출발',to:'도착',date:'2026-10-29',pax:1,cls:'general',minWait:3,maxWait:60,sort:'duration'};
test('transfer search crosses midnight with valid wait, both arrival times, and separate service dates',()=>{
 const rows=model.transfers(q);assert.equal(rows.length,1);const r=rows[0];assert.equal(r.wait,5);assert.equal(r.duration,60);assert.equal(r.legs[0].seg.arr,'0:05');assert.equal(r.legs[1].q.date,'2026-10-30');assert.equal(model.serviceDate(r.legs[0].train,r.legs[0].q),'2026-10-29');assert.equal(model.serviceDate(r.legs[1].train,r.legs[1].q),'2026-10-30');assert.equal(r.fare,2000);
 assert.equal(model.transfers({...q,minWait:6,maxWait:60}).length,0);
 assert.throws(()=>model.transfers({...q,minWait:60,maxWait:3}),/환승 대기/);
});
test('cumulative railway time handles arrival-before-midnight/departure-after-midnight dwell',()=>{
 const [a,b]=serviceTimeline([{s:'A',arr:'23:59',dep:'0:02'},{s:'B',arr:'0:15',dep:'0:16'}]);assert.equal(a.arrival,1439);assert.equal(a.departure,1442);assert.equal(b.arrival,1455);
 assert.notEqual(stationId('장흥(교외선)'),stationId('장흥(경전선)'));
});
test('operation state uses fixed service day, interpolates untimed pass point and never restarts next day',()=>{
 const query={...q,to:'환승'},during=operationSnapshot(model,trains[0],query,new Date('2026-10-29T15:00:00Z'));
 assert.equal(during.phase,'running');assert.equal(during.nodes[1].stop,false);assert.ok(during.nodes[1].interpolated>during.departure);assert.ok(during.nodes[1].interpolated<during.arrival);
 assert.equal(operationSnapshot(model,trains[0],query,new Date('2026-10-30T15:00:00Z')).phase,'done');
});
test('mixed seated/standing runs retain calendar rollover and save with atomic validation',()=>{
 let stored=null;const storage={getItem:()=>stored,setItem:(k,v)=>stored=v};
 const train={no:'M',grade:'KTX',line:'fixture',dest:'C',stops:[{s:'A',dep:'23:50'},{s:'B',arr:'0:10',dep:'0:12'},{s:'C',arr:'0:30'}]};
 const model=createModel({...data,trains:[train],stops:t=>t.stops,cars:()=>[{car:1,rows:1,cols:['A','B']}],seatId:(c,r,col)=>`${c.car}호차 ${r}${col}`,virtualSeats(){},bookedSeats:()=>new Set(),invalidate(){},discounts:{none:{}},discount:fare=>fare,inventory:(t,from,to,date,cls)=>({eligible:cls==='standing'?from==='B':true,available:from==='A'&&to==='B'&&cls==='general'||from==='B'&&cls==='standing'?2:0})},storage,()=>new Date('2026-10-29T03:00:00Z'));
 const runs=model.mixed(train,{from:'A',to:'C',date:'2026-10-30',pax:1,cls:'general'});assert.equal(runs.length,2);assert.equal(runs[1].q.cls,'standing');assert.equal(runs[1].q.date,'2026-10-31');
 const drafts=runs.map(r=>({...r,seats:r.q.cls==='standing'?[]:['1호차 1A'],names:['검증'],discount:'none'}));const tickets=model.bookMany(drafts,{type:'mixed'});assert.equal(tickets[0].groupId,tickets[1].groupId);assert.equal(tickets[0].serviceDate,tickets[1].serviceDate);assert.equal(tickets[1].seats.length,0);
});
