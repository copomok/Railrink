import test from 'node:test';
import assert from 'node:assert/strict';
import {createModel} from '../js/model.js';
import {operationSnapshot,operationPosition,operationMap} from '../js/operations.js';
const train={no:'night',grade:'무궁화호',stops:[{s:'시발',dep:'23:40'},{s:'경유',geoKey:'경유좌표',pass:true},{s:'승차',arr:'0:10',dep:'0:12'},{s:'하차',arr:'0:30',dep:'0:32'},{s:'종착',arr:'0:50'}]};
const data={trains:[train],stops:t=>t.stops.filter(s=>!s.pass),coordinate:s=>({lat:35,lon:{시발:126,경유좌표:126.5,승차:127,하차:128,종착:129}[s]}),isPass:(t,s)=>t.stops.find(n=>n.s===s)?.pass};
const make=extra=>createModel({...data,...extra},{getItem:()=>null});
const query={from:'승차',to:'하차',date:'2026-10-30'};
const at=(time,model=make())=>operationSnapshot(model,train,query,new Date('2026-10-30T'+time+':00+09:00'));
test('position follows the whole run before boarding and after alighting',()=>{
 const s=at('00:00');assert.equal(s.serviceDate,'2026-10-29');assert.equal(s.phase,'before');assert.equal(s.trainPhase,'running');assert.match(s.label,/승차역으로 이동/);
 const position=operationPosition(s,s.nodes.filter(n=>n.stop));assert.equal(position.index,0);assert.equal(position.nextIndex,1);assert.ok(Math.abs(position.fraction-2/3)<.001);
 assert.equal(s.nodes[1].coord.lon,126.5);assert.ok(operationPosition(s));
 const after=at('00:40');assert.equal(after.phase,'done');assert.equal(after.trainPhase,'running');assert.match(after.label,/종착역/);assert.ok(operationPosition(after));
 const map=operationMap(s,'#ff6600',String);assert.ok(map.includes('brd-map-live-train'));assert.ok(map.includes('class="muted"'));assert.ok(map.includes('class="selected"'));
});
test('dwell and exact service boundaries do not start another day’s run',()=>{
 const dwell=at('00:11'),p=operationPosition(dwell,dwell.nodes.filter(n=>n.stop));assert.equal(p.index,1);assert.equal(p.nextIndex,1);assert.match(dwell.label,/정차 중/);
 const departing=operationPosition(at('00:12'),at('00:12').nodes.filter(n=>n.stop));assert.equal(departing.index,1);assert.equal(departing.nextIndex,2);assert.equal(departing.fraction,0);
 assert.equal(operationPosition(at('00:50')),null);assert.equal(at('00:50').trainPhase,'done');
 const before=operationSnapshot(make(),train,query,new Date('2026-10-29T23:39:59+09:00'));assert.equal(before.trainPhase,'before');assert.equal(operationPosition(before),null);
 const tomorrow=operationSnapshot(make(),train,query,new Date('2026-10-31T00:00:00+09:00'));assert.equal(tomorrow.trainPhase,'done');assert.equal(operationPosition(tomorrow),null);
});
test('upstream arrival and departure delays retain a held train at its station',()=>{
 const model=make({delayState:()=>({phase:'running',serviceDate:'2026-10-29',current:7}),delayAt:()=>7,delayPair:()=>({arr:1,dep:7})});
 const now=new Date('2026-10-30T00:15:00+09:00');now.getTimezoneOffset=()=>-540;
 const s=operationSnapshot(model,train,query,now);assert.equal(s.current.s,'승차');assert.equal(s.nodes[2].arrivalDelay,1);assert.equal(s.nodes[2].delay,7);assert.equal(s.departure,Date.parse('2026-10-30T00:19:00+09:00'));
 assert.equal(operationPosition(s,s.nodes.filter(n=>n.stop)).nextIndex,1);
 const stale=operationSnapshot(make({delayState:()=>({phase:'running',serviceDate:'2026-10-30'}),delayPair:()=>({arr:60,dep:60})}),train,query,now);assert.equal(stale.nodes[2].delay,0);
});
