import test from 'node:test';import assert from 'node:assert/strict';
import {createModel} from '../js/model.js';
import {trainFamily,matchesFamily} from '../js/train-families.js';
const trains=[['A','10:00','12:00'],['B','11:00','11:30'],['C','9:00','13:00'],['D','12:00','13:00'],['N','23:30','0:30'],['M','0:15','1:00']].map(([no,dep,arr])=>({no,grade:'KTX',stops:[{s:'출발',dep},{s:'도착',arr}]}));
const data={trains,stops:t=>t.stops,cars:()=>[{car:1,rows:2,cols:['A','B']}],classCars:c=>c,formation:()=>'',seatId:(c,r,col)=>`${c.car}호차 ${r}${col}`,virtualSeats(){},bookedSeats:()=>new Set(),invalidate(){},fare:()=>1000,discount:f=>f,discounts:{none:{}},inventory:()=>({eligible:true,available:4})};
function setup(){let saved=null;const storage={getItem:()=>saved,setItem:(k,v)=>saved=v};const model=createModel(data,storage,()=>new Date('2026-10-29T03:00:00Z'));const draft=(i,date='2026-10-30')=>({key:model.key(trains[i]),q:{from:'출발',to:'도착',date,cls:'general',pax:1},seats:['1호차 1A'],discount:'none'});return {model,storage,draft};}
test('existing tickets block contained and enclosing overlaps; boundaries and cancelled tickets are allowed',()=>{
 const {model,draft}=setup();const a=model.book(draft(0));assert.equal('names' in a,false);assert.equal(a.paymentMode,'virtual');
 for(const i of [1,2])assert.throws(()=>model.book(draft(i)),/시간이 겹칩니다/);
 model.book(draft(3));assert.equal(model.read().tickets.length,2);model.cancel(a.id);model.book(draft(1));
});
test('overnight overlap and another tab are checked from stored tickets at commit',()=>{
 const {model,storage,draft}=setup();model.book(draft(4));
 const other=createModel(data,storage,()=>new Date('2026-10-29T03:00:00Z'));assert.throws(()=>other.book(draft(5,'2026-10-31')),/겹칩니다/);
 assert.equal(model.read().tickets.length,1);
});
test('replacement excludes only replaced ticket; batch failure preserves every original',()=>{
 const {model,draft}=setup();const old=model.book(draft(0));model.book(draft(3));
 assert.throws(()=>model.book(draft(2),old.id),/겹칩니다/);assert.equal(model.read().tickets[0].status,'active');
 const replacement=model.book(draft(1),old.id);assert.equal(replacement.replaces,old.id);
 const count=model.read().tickets.length;assert.throws(()=>model.bookMany([draft(4),draft(5,'2026-10-31')]),/겹칩니다/);assert.equal(model.read().tickets.length,count);
});
test('four train families classify all source grades including tourist trains',()=>{
 for(const grade of ['KTX','KTX-산천','KTX-이음','SRT'])assert.equal(trainFamily(grade),'ktx');
 assert.equal(trainFamily('ITX-청춘'),'chun');for(const grade of ['ITX-새마을','ITX-마음'])assert.equal(trainFamily(grade),'itx');
 for(const grade of ['무궁화호','남도해양','국악와인'])assert.equal(trainFamily(grade),'mugunghwa');assert.equal(matchesFamily('ITX-청춘','itx'),false);
});

test('fixed KTX facing boundary agrees with forward/reverse automatic assignment',()=>{
 for(const boundary of [8,4]){
  const source={...data,cars:()=>[{car:4,rows:15,cols:['A','B','C','D'],revRows:boundary}]};
  const model=createModel(source,{getItem:()=>null,setItem(){}},()=>new Date('2026-10-29T03:00:00Z'));
  const q={from:'출발',to:'도착',date:'2026-10-30',cls:'general',pax:1};
  const seats=model.seats(trains[0],q)[0].seats;
  for(const row of [1,boundary])assert.equal(seats.find(s=>s.row===row).reverse,false);
  for(const row of [boundary+1,15])assert.equal(seats.find(s=>s.row===row).reverse,true);
  for(const [preference,reverse] of [['forward',false],['reverse',true]]){
   const assigned=model.autoAssign(trains[0],q,preference);
   assert.equal(seats.find(s=>s.id===assigned.seats[0]).reverse,reverse);
  }
 }
 const source={...data,cars:()=>[{car:1,rows:2,cols:['A','B'],revRows:0}]};
 const model=createModel(source,{getItem:()=>null,setItem(){}});
 assert.ok(model.seats(trains[0],{from:'출발',to:'도착',date:'2026-10-30',cls:'general'}).every(c=>c.seats.every(s=>!s.reverse)));
});

test('async transfer storage waits for commit and failed transactions leave no tickets',async()=>{
 const {draft}=setup();let raw=null,release,fail=false;
 const storage={getItem:()=>raw,setItem:(k,value)=>new Promise((resolve,reject)=>{release=()=>{if(fail)reject(new DOMException('full','QuotaExceededError'));else{raw=value;resolve();}};})};
 const model=createModel(data,storage,()=>new Date('2026-10-29T03:00:00Z'));
 const pending=model.bookMany([draft(0),draft(3)],{type:'transfer'});
 assert.equal(model.read().tickets.length,0);release();const tickets=await pending;
 assert.equal(tickets.length,2);assert.equal(tickets[0].groupId,tickets[1].groupId);assert.equal(model.read().tickets.length,2);
 fail=true;const old=raw,p=model.bookMany([draft(4),draft(3,'2026-10-31')],{type:'transfer'});
 release();await assert.rejects(p,/용량이 부족/);assert.equal(raw,old);
});
