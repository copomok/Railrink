// Calendar dates are Korean local dates. Timetables use cumulative service minutes.
export const minuteOf = value => {
 const m=/^(\d{1,2}):([0-5]\d)$/.exec(String(value));
 return m && +m[1]<24 ? +m[1]*60 + +m[2] : null;
};
export function serviceTimeline(stops) {
 let previous=null;
 return stops.map((stop,index)=>{
  const read=value=>{const raw=minuteOf(value);if(raw===null)return null;let time=raw+(previous===null?0:Math.floor(previous/1440)*1440);if(previous!==null&&time<previous)time+=1440;previous=time;return time;};
  const arrival=read(stop.arr),departure=read(stop.dep);
  return {...stop,index,arrival,departure,dayOffset:Math.floor((departure??arrival??0)/1440)};
 });
}
export const midnight = date => Date.parse(`${date}T00:00:00+09:00`);
export const dateAt = value => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const clockAt = value => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
export const displayClock = value => String(value).replace(/^0(?=\d:)/,'');
export const stationId = name => 'nimby:station:'+encodeURIComponent(name.normalize('NFC'));
