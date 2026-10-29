import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_GREETINGS} from '../js/greeting-data.js';
import {greetingContext,greetingCandidates,selectGreeting,createGreetingSession,GREETING_STORAGE_KEY} from '../js/greetings.js';
import {createGreetingCalendar,greetingHolidayAt} from '../js/greeting-holidays.js';
const at=(date,time='12:00')=>new Date(`${date}T${time}:00+09:00`);
const candidates=(date,time='12:00',options)=>greetingCandidates(greetingContext(at(date,time)),options);
const has=(items,category)=>items.some(g=>g.category===category);
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('all 110 supplied greetings have unique IDs, classification and applicability',()=>{
 assert.equal(HOME_GREETINGS.length,110);assert.deepEqual(HOME_GREETINGS.map(g=>g.id),Array.from({length:110},(_,i)=>i+1));
 assert.equal(new Set(HOME_GREETINGS.map(g=>g.category)).size,23);
 for(const g of HOME_GREETINGS){assert.ok(g.title&&g.subtitle);assert.equal(Object.keys(g.condition).length,1);}
 assert.deepEqual(HOME_GREETINGS.filter(g=>g.category==='overnight').map(g=>g.id),[101,102,103,104,105,106,107,108,109,110]);
 assert.equal(HOME_GREETINGS[0].title,'아직 고요한 새벽이에요');assert.equal(HOME_GREETINGS[109].subtitle,'새로운 여정을 차분히 계획해 보세요.');
});
test('every KST time boundary respects the inclusive exclusive-night interval',()=>{
 const boundaries={'00:00':'dawn','01:29':'dawn','01:30':'overnight','03:00':'overnight','04:50':'overnight','04:51':'dawn','04:59':'dawn','05:00':'morning','09:59':'morning','10:00':'lateMorning','11:59':'lateMorning','12:00':'afternoon','16:59':'afternoon','17:00':'evening','20:59':'evening','21:00':'night','23:59':'night'};
 for(const [time,band] of Object.entries(boundaries)){
  const context=greetingContext(at('2026-01-01',time));assert.equal(context.timeBand,band,time);
  const items=greetingCandidates(context);
  if(band==='overnight'){assert.equal(items.length,10);assert.ok(items.every(g=>g.id>=101),time);}
  else{assert.equal(items.filter(g=>g.category===band).length,6);assert.ok(items.every(g=>g.id<=100),time);}
 }
 assert.equal(greetingContext(new Date('2026-01-01T04:50:59.999+09:00')).timeBand,'overnight');
 assert.equal(greetingContext(new Date('2026-01-01T04:51:00+09:00')).timeBand,'dawn');
 assert.equal(greetingContext(new Date('2025-12-31T16:30:00Z')).timeBand,'overnight');
 assert.deepEqual(candidates('2026-01-01','03:00',{holidayAt:()=>{throw Error('Must not consult holidays overnight');}}).map(g=>g.id),[101,102,103,104,105,106,107,108,109,110]);
});
test('Korean date and weekday are independent of device timezone',()=>{
 const previous=process.env.TZ;
 try{for(const timezone of ['UTC','America/Los_Angeles','Asia/Seoul']){process.env.TZ=timezone;const c=greetingContext(new Date('2026-10-29T16:30:00Z'));assert.equal(c.date,'2026-10-30');assert.equal(c.weekday,5);assert.equal(c.minutes,90);}}
 finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('all weekday groups and both edges of each month, including leap February',()=>{
 const dates=['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01'];
 dates.forEach((date,i)=>assert.ok(has(candidates(date),['monday','weekday','weekday','weekday','friday','saturday','sunday'][i])));
 for(const [prefix,last] of [['2026-01',31],['2026-04',30],['2026-02',28],['2024-02',29]]){
  for(const day of [1,5])assert.ok(has(candidates(`${prefix}-0${day}`),'monthStart'));
  assert.ok(!has(candidates(prefix+'-06'),'monthStart'));
  for(let day=last-4;day<=last;day++)assert.ok(has(candidates(`${prefix}-${day}`),'monthEnd'));
  assert.ok(!has(candidates(`${prefix}-${last-5}`),'monthEnd'));
 }
});
test('seasons and New Year/year-end ranges change on the correct date',()=>{
 for(let month=1;month<=12;month++){
  const date=`2026-${String(month).padStart(2,'0')}-01`,season=month<3||month===12?'winter':month<6?'spring':month<9?'summer':'autumn';
  assert.equal(greetingContext(at(date)).season,season);assert.equal(candidates(date).filter(g=>g.category===season).length,6);
 }
 for(const day of [24,31])assert.ok(has(candidates(`2026-12-${day}`),'yearEnd'));
 assert.ok(!has(candidates('2026-12-23'),'yearEnd'));
 for(const day of [1,2,3])assert.ok(has(candidates(`2027-01-0${day}`),'newYear'));
 assert.ok(!has(candidates('2027-01-04'),'newYear'));assert.ok(!has(candidates('2027-01-01'),'yearEnd'));
});
test('holiday copy requires a known solar holiday or reviewed exact-date record',()=>{
 for(const date of ['2026-01-01','2026-03-01','2026-05-05','2026-06-06','2026-08-15','2026-10-03','2026-10-09','2026-12-25'])assert.ok(candidates(date).some(g=>g.id===99));
 assert.equal(greetingHolidayAt('2026-01-02'),null);assert.ok(!has(candidates('2026-01-02'),'holiday'));
 // Synthetic registry contract fixtures, NOT a real lunar holiday calendar.
 const base={name:'검증용 가상 날짜',source:'https://example.test/calendar-fixture',verifiedOn:'2026-10-29',verified:true};
 const holidayAt=createGreetingCalendar([{...base,date:'2099-02-10',kind:'lunarNewYear'},{...base,date:'2099-09-10',kind:'chuseok'},{...base,date:'2099-06-10',kind:'other',period:true},{...base,date:'2099-06-11',kind:'other',verified:false},{...base,date:'2099-06-12',kind:'other',source:''},{...base,date:'2099-02-30',kind:'other'}]);
 for(const [date,category] of [['2099-02-10','lunarNewYear'],['2099-09-10','chuseok']]){
  const items=candidates(date,'12:00',{holidayAt});assert.ok(has(items,category));assert.ok(items.some(g=>g.id===93));assert.ok(!items.some(g=>g.id===99));
  assert.ok(candidates(date,'03:00',{holidayAt}).every(g=>g.category==='overnight'));
 }
 assert.ok(candidates('2099-06-10','12:00',{holidayAt}).some(g=>g.id===99));
 for(const date of ['2099-02-09','2099-02-11','2099-06-11','2099-06-12','2099-02-30'])assert.equal(holidayAt(date),null);
 assert.ok(!has(candidates('2026-02-17'),'lunarNewYear'),'Do not guess lunar festivals without reviewed source records');
});
test('new document sessions redraw without consecutive repeats, renders do not draw',()=>{
 const storage=memory();let calls=0,seed=17;const random=()=>{calls++;seed=(seed*48271)%2147483647;return seed/2147483647;},seen=[];
 for(let i=0;i<30;i++){
  const session=createGreetingSession({now:()=>at('2026-10-30'),random,storage});const greeting=session.get(),count=calls;
  for(let j=0;j<10;j++)assert.strictEqual(session.get(),greeting);
  assert.equal(calls,count);assert.notEqual(greeting.id,seen.at(-1));seen.push(greeting.id);
 }
 assert.ok(new Set(seen).size>6);assert.equal(storage.getItem(GREETING_STORAGE_KEY),String(seen.at(-1)));
 const single=[HOME_GREETINGS[0]];assert.strictEqual(selectGreeting(single,1,()=>0),single[0]);
});
test('session refreshes only on KST date/time-band change and tolerates unavailable storage',()=>{
 let current=at('2026-12-31','01:29'),draws=0;
 const broken={getItem(){throw Error('denied');},setItem(){throw Error('full');}};
 const session=createGreetingSession({now:()=>current,random:()=>{draws++;return 0;},storage:broken});
 assert.equal(session.get().category,'dawn');current=at('2026-12-31','01:30');assert.equal(session.get().category,'overnight');
 const late=session.get();current=at('2026-12-31','04:50');assert.strictEqual(session.get(),late);
 current=at('2026-12-31','04:51');assert.equal(session.get().category,'dawn');current=at('2026-12-31','05:00');assert.equal(session.get().category,'morning');
 current=at('2026-12-31','09:59');session.get();assert.equal(draws,4);
 current=at('2026-12-31','23:59');assert.equal(session.get().category,'night');current=at('2027-01-01','00:00');assert.equal(session.get().category,'dawn');assert.equal(draws,6);
});
