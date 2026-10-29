import {dateAt,clockAt,minuteOf} from './railway-time.js';
import {HOME_GREETINGS} from './greeting-data.js';
import {greetingHolidayAt} from './greeting-holidays.js';
export const GREETING_STORAGE_KEY='raillink.greeting.last';
export function greetingContext(now=new Date()){
 const date=dateAt(now),[year,month,day]=date.split('-').map(Number),minutes=minuteOf(clockAt(now));
 const timeBand=minutes>=90&&minutes<=290?'overnight':minutes<300?'dawn':minutes<600?'morning':minutes<720?'lateMorning':minutes<1020?'afternoon':minutes<1260?'evening':'night';
 return {date,year,month,day,minutes,timeBand,weekday:new Date(date+'T12:00:00Z').getUTCDay(),daysInMonth:new Date(Date.UTC(year,month,0)).getUTCDate(),season:month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter',key:date+'|'+timeBand};
}
export function greetingCandidates(context,{data=HOME_GREETINGS,holidayAt=greetingHolidayAt}={}){
 // This branch is exclusive, including on New Year, festivals and holidays.
 if(context.timeBand==='overnight')return data.filter(g=>g.category==='overnight');
 const holiday=holidayAt(context.date);
 return data.filter(({category,condition:c})=>{
  if(category==='overnight')return false;
  if(c.timeBand)return c.timeBand===context.timeBand;
  if(c.weekdays)return c.weekdays.includes(context.weekday);
  if(c.monthEdge)return c.monthEdge==='start'?context.day<=5:context.day>=context.daysInMonth-4;
  if(c.season)return c.season===context.season;
  if(c.period)return c.period==='newYear'?context.month===1&&context.day<=3:context.month===12&&context.day>=24;
  if(c.holiday)return holiday?.isHoliday===true&&(c.holiday==='period'?holiday.period===true:c.holiday===holiday.kind);
  return false;
 });
}
export function selectGreeting(candidates,previousId,random=Math.random){
 if(!candidates.length)throw Error('적용 가능한 인사말이 없습니다.');
 const alternatives=candidates.filter(g=>g.id!==Number(previousId)),pool=alternatives.length?alternatives:candidates;
 return pool[Math.min(pool.length-1,Math.max(0,Math.floor(random()*pool.length)))];
}
// One instance per document/app launch, NOT sessionStorage: reload creates a new
// draw; SPA navigation and ordinary render calls keep the same in-memory value.
export function createGreetingSession({now=()=>new Date(),random=Math.random,storage,holidayAt=greetingHolidayAt,data=HOME_GREETINGS}={}){
 let current=null,key=null;
 const store=()=>storage===undefined?globalThis.localStorage:storage;
 return {get(){
  const context=greetingContext(now());if(current&&key===context.key)return current;
  let previous=current?.id;try{previous??=store()?.getItem(GREETING_STORAGE_KEY);}catch{/* Private mode/quota must not block the home screen. */}
  current=selectGreeting(greetingCandidates(context,{data,holidayAt}),previous,random);key=context.key;
  try{store()?.setItem(GREETING_STORAGE_KEY,String(current.id));}catch{/* Session stability still works without persistent preferences. */}
  return current;
 }};
}
export function updateHomeGreeting(root,session){
 const title=root.querySelector('[data-greeting-title]'),subtitle=root.querySelector('[data-greeting-subtitle]');
 if(!title||!subtitle)return;
 const greeting=session.get(),heading=title.parentElement;
 if(heading.dataset.greetingId===String(greeting.id))return;
 title.textContent=greeting.title;subtitle.textContent=greeting.subtitle;heading.dataset.greetingId=String(greeting.id);
}
