import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {runtimeSource,sharedFiles,sourceRoot,tokenSource} from '../tools/source.mjs';
import {createModel,kstDate,addDays,STORE_KEY} from '../js/model.js';
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
  assert.ok(sharedFiles().includes('js/shared/nimbi_rail_domain.js'));
  assert.ok(sharedFiles().includes('data/nimbi_global_schedule_revision.js'));
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
  assert.ok(model.search({...q,grade:'SRT'}).every(r=>r.train.grade==='SRT'));
  assert.equal(model.segment({stops:[{s:'A',dep:'08:00'},{s:'B',arr:'08:20',dep:null},{s:'C',arr:'09:00'}]},'A','B'),null);
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
  assert.throws(()=>broken.save(broken.read()),/저장 공간/);
  memory.set(STORE_KEY,'broken');assert.throws(()=>model.read(),/읽을 수/);assert.equal(memory.get(STORE_KEY),'broken');reset();
});
test('wait records do not create tickets or imaginary queue positions',()=>{
  reset();const r=candidate();model.watch(r.key,q);model.watch(r.key,q);
  assert.equal(model.read().watches.length,1);assert.equal(model.read().tickets.length,0);assert.equal(model.read().watches[0].queuePosition,undefined);
});
test('same-day search excludes departures at or before the Korean current instant',()=>{
 reset();const r=model.search(q)[0],fixed=new Date(`${q.date}T${r.seg.dep.padStart(5,'0')}:00+09:00`),atDeparture=createModel(context.RailData,storage,()=>fixed);
 const rows=atDeparture.search(q);assert.ok(rows.length>0);assert.ok(rows.every(x=>atDeparture.departure(x.seg,q.date)>fixed));assert.ok(!rows.some(x=>x.key===r.key));
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
 const broken=createModel(context.RailData,{getItem:()=>null,setItem(){throw Error('Quota');}});assert.throws(()=>broken.bookMany([first]),/저장 공간/);assert.equal(model.read().tickets.length,0);
});
test('per-passenger discounts, automatic seats and pass records use canonical rules',()=>{
 reset();const pairQ={...q,pax:2},a=candidate(pairQ),assignment=model.autoAssign(a.train,pairQ,'window');assert.equal(assignment.seats.length,2);assert.equal(new Set(assignment.seats).size,2);
 const draft={...draftFor(a,pairQ),seats:assignment.seats,discounts:['none','child']};const [ticket]=model.bookMany([draft],{type:'pass',pass:{name:'주간 일정'}});
 assert.equal(ticket.totalFare,a.fare+context.RailData.discount(a.fare,'child'));assert.equal(model.read().passes[0].id,ticket.passId);assert.equal(ticket.groupId,undefined);
 assert.throws(()=>model.removeHistory(ticket.id),/예정된/);
});
