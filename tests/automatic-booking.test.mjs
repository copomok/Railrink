import test from 'node:test';
import assert from 'node:assert/strict';
import {createModel} from '../js/model.js';
const train={no:'test',grade:'KTX',stops:[{s:'서울',dep:'10:00'},{s:'부산',arr:'12:00'}]};
const car={car:1,rows:3,cols:['A','B','C','D'],revRows:1,missingSeats:['2A']};
const query={from:'서울',to:'부산',date:'2026-10-30',pax:2,cls:'general'};
let blocked=new Set(['1호차 1A','1호차 3D']);
const model=createModel({trains:[train],stops:t=>t.stops,formation:()=>'',cars:()=>[car],classCars:cars=>cars,virtualSeats(){},bookedSeats:()=>blocked,seatId:(c,r,col)=>`${c.car}호차 ${r}${col}`},{getItem:()=>null});
test('quick random assignment uses actual remaining seats and varies across rows',()=>{
 const random=Math.random;try{
  Math.random=()=>0;const a=model.autoAssign(train,query,'random');
  Math.random=()=>.99999;const b=model.autoAssign(train,query,'random');
  assert.notDeepEqual(a.seats,b.seats);
  for(const assignment of [a,b]){assert.equal(assignment.seats.length,2);assert.equal(new Set(assignment.seats).size,2);assert.ok(assignment.seats.every(id=>!blocked.has(id)&&id!=='1호차 2A'));assert.equal(assignment.split,false);}
 }finally{Math.random=random;}
});
test('split and insufficient allocations remain explicit, never substitute unavailable seats',()=>{
 const all=model.seats(train,query).flatMap(c=>c.seats).map(s=>s.id);blocked=new Set(all.filter(id=>!['1호차 1B','1호차 3C'].includes(id)));
 const split=model.autoAssign(train,query,'random');assert.equal(split.split,true);assert.deepEqual(new Set(split.seats),new Set(['1호차 1B','1호차 3C']));
 blocked.add('1호차 3C');assert.throws(()=>model.autoAssign(train,query,'random'),/부족/);
});
