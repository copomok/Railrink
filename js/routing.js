import {midnight,dateAt,minuteOf} from './railway-time.js';
// Uses the canonical service stops and fare engine. No copied route database.
export function findTransfers(model,q,now) {
 const min=Number(q.minWait??3),max=Number(q.maxWait??60),limit=Number(q.transferLimit??5);
 if(!Number.isInteger(min)||!Number.isInteger(max)||min<3||max<min||max>180||!Number.isInteger(limit)||limit<1||limit>20)throw Error('환승 대기는 3~180분, 결과는 1~20건 범위로 지정하세요.');
 const first=[],byStation=new Map(),base=midnight(q.date),after=minuteOf(q.after)??0;
 for(const train of model.trains){
  if(q.grade&&q.grade!=='all'&&q.grade!==train.grade)continue;
  if(q.family==='ktx'&&!train.grade.startsWith('KTX')||q.family==='regional'&&(train.grade.startsWith('KTX')||train.grade==='SRT'))continue;
  if(q.cls!=='standing'&&!model.data.classCars(model.data.cars(model.data.formation(train.grade,train.no)),q.cls).length)continue;
  const stops=model.data.stops(train),origin=stops.findIndex(s=>s.s===q.from&&s.dep),dest=stops.findIndex(s=>s.s===q.to&&s.arr);
  if(origin>=0){
   for(const stop of stops.slice(origin+1)){
    if(!stop.arr||stop.s===q.to||stop.s===q.from)continue;
    const seg=model.segment(train,q.from,stop.s);if(!seg)continue;
    const dep=+model.departure(seg,q.date);if(dep<=+now||dep<base+after*60000)continue;
    first.push({train,seg,dep,arr:dep+seg.duration*60000});
   }
  }
  if(dest>=0)for(const stop of stops.slice(0,dest)){
   if(!stop.dep||stop.s===q.from)continue;
   const seg=model.segment(train,stop.s,q.to);if(!seg)continue;
   const entries=byStation.get(stop.s)||[];entries.push({train,seg});byStation.set(stop.s,entries);
  }
 }
 const paths=[],seen=new Set();
 for(const a of first)for(const b of byStation.get(a.seg.to)||[]){
  if(a.train===b.train)continue;
  const startOfDay=midnight(dateAt(a.arr));let dep=startOfDay+minuteOf(b.seg.dep)*60000;
  if(dep<a.arr+min*60000)dep+=86400000;
  const wait=(dep-a.arr)/60000;if(wait<min||wait>max||dateAt(dep)>dateAt(+now+30*86400000))continue;
  const legs=[{...a,q:{...q,to:a.seg.to,date:dateAt(a.dep)}},{...b,dep,arr:dep+b.seg.duration*60000,q:{...q,from:a.seg.to,date:dateAt(dep)}}].map(l=>({...l,key:model.key(l.train),fare:model.data.fare(l.train,l.q.from,l.q.to,l.q.cls)}));
  const key=legs.map(l=>l.key+l.q.date+l.q.from+l.q.to).join('|');if(seen.has(key))continue;seen.add(key);
  paths.push({key,legs,via:a.seg.to,wait,duration:(legs[1].arr-a.dep)/60000,fare:legs.reduce((n,l)=>n+l.fare,0),departure:a.dep,arrival:legs[1].arr});
 }
 return paths.sort((a,b)=>q.sort==='fare'?a.fare-b.fare:q.sort==='departure'?a.departure-b.departure||a.duration-b.duration:a.duration-b.duration).slice(0,limit);
}
