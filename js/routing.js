import {matchesFamily} from './train-families.js';
import {dateAt,minuteOf} from './railway-time.js';
// Uses the canonical service stops and fare engine. No copied route database.
export function findTransfers(model,q,now) {
 const min=Number(q.minWait??3),max=Number(q.maxWait??60),limit=Number(q.transferLimit??20);
 if(!Number.isInteger(min)||!Number.isInteger(max)||min<3||max<min||max>180||!Number.isInteger(limit)||limit<1||limit>20)throw Error('환승 대기는 3~180분, 결과는 1~20건 범위로 지정하세요.');
 const first=[],byStation=new Map(),after=minuteOf(q.after),before=minuteOf(q.before);
 for(const train of model.trains){
  if(q.grade&&q.grade!=='all'&&q.grade!==train.grade)continue;
  if(!matchesFamily(train.grade,q.family))continue;
  if(!model.supportsClass(train,q.cls))continue;
  const {stops,timeline}=model.timetable(train),origin=stops.findIndex(s=>s.s===q.from&&s.dep),dest=stops.findIndex(s=>s.s===q.to&&s.arr);
  if(origin<0&&dest<0)continue;
  const segment=(fromIndex,toIndex)=>({from:stops[fromIndex].s,to:stops[toIndex].s,dep:stops[fromIndex].dep,arr:stops[toIndex].arr,fi:fromIndex,ti:toIndex,stops,departureMinutes:timeline[fromIndex].departure,arrivalMinutes:timeline[toIndex].arrival,duration:timeline[toIndex].arrival-timeline[fromIndex].departure});
  if(origin>=0){
   for(let i=origin+1;i<stops.length;i++){const stop=stops[i];
    if(!stop.arr||stop.s===q.to||stop.s===q.from)continue;
    const seg=segment(origin,i);
    const dep=+model.departure(seg,q.date),depMinute=minuteOf(seg.dep);
    const outside=after!==null&&before!==null?(after<=before?(depMinute<after||depMinute>before):(depMinute<after&&depMinute>before)):after!==null?depMinute<after:before!==null&&depMinute>before;
    if(dep<=+now||outside)continue;
    first.push({train,seg,dep,arr:dep+seg.duration*60000});
   }
  }
  if(dest>=0)for(let i=0;i<dest;i++){const stop=stops[i];
   if(!stop.dep||stop.s===q.from)continue;
   const seg=segment(i,dest);
   const entries=byStation.get(stop.s)||[];entries.push({train,seg,minute:minuteOf(seg.dep)});byStation.set(stop.s,entries);
  }
 }
 first.sort((a,b)=>a.dep-b.dep);for(const entries of byStation.values())entries.sort((a,b)=>a.minute-b.minute);
 const paths=[],seen=new Set(),lowerBound=(items,value)=>{let low=0,high=items.length;while(low<high){const mid=(low+high)>>1;if(items[mid].minute<value)low=mid+1;else high=mid;}return low;};
 const compare=(a,b)=>q.sort==='fare'?a.fare-b.fare:q.sort==='arrival'?a.arrival-b.arrival:q.sort==='departure-desc'?b.departure-a.departure:q.sort==='departure'?a.departure-b.departure||a.duration-b.duration:a.duration-b.duration;
 const addPath=path=>{let low=0,high=paths.length;while(low<high){const mid=(low+high)>>1;if(compare(paths[mid],path)<=0)low=mid+1;else high=mid;}paths.splice(low,0,path);if(paths.length>limit)paths.pop();};
 for(const a of first){
  if(q.sort==='departure'&&paths.length===limit&&a.dep>paths.at(-1).departure)break;
  const entries=byStation.get(a.seg.to)||[],startOfDay=Date.parse(dateAt(a.arr)+'T00:00:00+09:00'),arrivalMinute=(a.arr-startOfDay)/60000,low=arrivalMinute+min,high=arrivalMinute+max;
  for(const offset of [0,1440]){
   const rangeStart=Math.max(0,low-offset),rangeEnd=Math.min(1439,high-offset);if(rangeStart>rangeEnd)continue;
   for(let entryIndex=lowerBound(entries,rangeStart);entryIndex<entries.length&&entries[entryIndex].minute<=rangeEnd;entryIndex++){const b=entries[entryIndex];
  if(a.train===b.train)continue;
  const dep=startOfDay+(b.minute+offset)*60000;
  const wait=(dep-a.arr)/60000;if(wait<min||wait>max||dateAt(dep)>dateAt(+now+30*86400000))continue;
  const firstDate=dateAt(a.dep),secondDate=dateAt(dep),firstKey=model.key(a.train),secondKey=model.key(b.train),pathKey=`${firstKey}${firstDate}${q.from}${a.seg.to}|${secondKey}${secondDate}${a.seg.to}${q.to}`;if(seen.has(pathKey))continue;seen.add(pathKey);
  const arrival=dep+b.seg.duration*60000,duration=(arrival-a.dep)/60000,rank={departure:a.dep,duration,fare:0};
  if(q.sort!=='fare'&&paths.length===limit&&compare(rank,paths.at(-1))>=0)continue;
  const legs=[{...a,key:firstKey,q:{...q,to:a.seg.to,date:firstDate},fare:model.quoteFare(a.train,q.from,a.seg.to,q.cls)},{...b,key:secondKey,dep,arr:arrival,q:{...q,from:a.seg.to,date:secondDate},fare:model.quoteFare(b.train,a.seg.to,q.to,q.cls)}];
  addPath({key:pathKey,legs,via:a.seg.to,wait,duration,fare:legs[0].fare+legs[1].fare,departure:a.dep,arrival});
   }
  }
 }
 return paths;
}
