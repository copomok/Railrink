export const SETTINGS_KEY='raillink.settings.v1';
export const SETTINGS_VERSION=1;

export const defaultSettings=()=>({
 version:SETTINGS_VERSION,
 search:{fromStationId:'',toStationId:'',timeMode:'current',fixedTime:'08:00',pax:1,cls:'general',family:'all',routeMode:'both',routeOrder:'direct',sort:'departure',showSoldOut:true,hideDeparted:true},
 seat:{position:'none',direction:'none',adjacent:true,allowAlternative:true},
 transfer:{include:true,directFirst:true,minWait:15,maxWait:60,riskAlerts:true},
 notifications:{enabled:true,system:false,departure:[60,30,10],delay:true,cancel:true,platform:true,arrival:false,transferRisk:true},
 boarding:{countdown:true,nextStop:true,arrivalTime:true,platform:true},
 map:{tracks:true,stationNames:true,allTrains:false,selectedTrain:true,background:true,grades:[]},
 appearance:{theme:'light',fontSize:'medium',highContrast:false,reduceMotion:false,timeFormat:'24',dateFormat:'korean',duration:true,delayHighlight:true}
});

const clone=value=>JSON.parse(JSON.stringify(value));
const bool=(value,fallback)=>typeof value==='boolean'?value:fallback;
const oneOf=(value,items,fallback)=>items.includes(value)?value:fallback;
const integer=(value,min,max,fallback)=>Number.isInteger(+value)&&+value>=min&&+value<=max?+value:fallback;
const stationId=(value,model)=>typeof value==='string'&&model.stationRecords.some(station=>station.id===value)?value:'';

export function sanitizeSettings(value,model){
 const d=defaultSettings(),v=value&&typeof value==='object'?value:{};
 const search=v.search||{},seat=v.seat||{},transfer=v.transfer||{},notifications=v.notifications||{},boarding=v.boarding||{},map=v.map||{},appearance=v.appearance||{};
 const departure=Array.isArray(notifications.departure)?[...new Set(notifications.departure.map(Number).filter(n=>[60,30,10].includes(n)))].sort((a,b)=>b-a):d.notifications.departure;
 const trainGrades=new Set((model.trains||model.data.trains||[]).map(train=>train.grade));
 return {
  version:SETTINGS_VERSION,
  search:{
   fromStationId:stationId(search.fromStationId,model),toStationId:stationId(search.toStationId,model),
   timeMode:oneOf(search.timeMode,['current','fixed','any'],d.search.timeMode),fixedTime:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(search.fixedTime||'')?search.fixedTime:d.search.fixedTime,
   pax:integer(search.pax,1,6,d.search.pax),cls:oneOf(search.cls,Object.keys(model.data.classes),d.search.cls),family:oneOf(search.family,['all','ktx','chun','itx','mugunghwa'],d.search.family),routeMode:oneOf(search.routeMode,['both','direct','transfer'],transfer.include===false?'direct':d.search.routeMode),routeOrder:oneOf(search.routeOrder,['direct','transfer'],transfer.directFirst===false?'transfer':d.search.routeOrder),
   sort:oneOf(search.sort,['departure','departure-desc','arrival','duration','fare'],d.search.sort),showSoldOut:bool(search.showSoldOut,d.search.showSoldOut),hideDeparted:bool(search.hideDeparted,d.search.hideDeparted)
  },
  seat:{position:oneOf(seat.position,['none','window','aisle'],d.seat.position),direction:oneOf(seat.direction,['none','forward','reverse'],d.seat.direction),adjacent:bool(seat.adjacent,d.seat.adjacent),allowAlternative:bool(seat.allowAlternative,d.seat.allowAlternative)},
  transfer:{include:bool(transfer.include,d.transfer.include),directFirst:bool(transfer.directFirst,d.transfer.directFirst),minWait:integer(transfer.minWait,3,180,d.transfer.minWait),maxWait:integer(transfer.maxWait,3,180,d.transfer.maxWait),riskAlerts:bool(transfer.riskAlerts,d.transfer.riskAlerts)},
  notifications:{enabled:bool(notifications.enabled,d.notifications.enabled),system:bool(notifications.system,d.notifications.system),departure,delay:bool(notifications.delay,d.notifications.delay),cancel:bool(notifications.cancel,d.notifications.cancel),platform:bool(notifications.platform,d.notifications.platform),arrival:bool(notifications.arrival,d.notifications.arrival),transferRisk:bool(notifications.transferRisk,d.notifications.transferRisk)},
  boarding:{countdown:bool(boarding.countdown,d.boarding.countdown),nextStop:bool(boarding.nextStop,d.boarding.nextStop),arrivalTime:bool(boarding.arrivalTime,d.boarding.arrivalTime),platform:bool(boarding.platform,d.boarding.platform)},
  map:{tracks:bool(map.tracks,d.map.tracks),stationNames:bool(map.stationNames,d.map.stationNames),allTrains:bool(map.allTrains,d.map.allTrains),selectedTrain:bool(map.selectedTrain,d.map.selectedTrain),background:bool(map.background,d.map.background),grades:Array.isArray(map.grades)?[...new Set(map.grades.filter(grade=>trainGrades.has(grade)))]:[]},
  appearance:{theme:oneOf(appearance.theme,['system','light','dark'],d.appearance.theme),fontSize:oneOf(appearance.fontSize,['small','medium','large'],d.appearance.fontSize),highContrast:bool(appearance.highContrast,d.appearance.highContrast),reduceMotion:bool(appearance.reduceMotion,d.appearance.reduceMotion),timeFormat:oneOf(appearance.timeFormat,['12','24'],d.appearance.timeFormat),dateFormat:oneOf(appearance.dateFormat,['korean','dot','iso'],d.appearance.dateFormat),duration:bool(appearance.duration,d.appearance.duration),delayHighlight:bool(appearance.delayHighlight,d.appearance.delayHighlight)}
 };
}

export function createSettingsStore({model,storage=globalThis.localStorage,legacyStorage=globalThis.localStorage}={}){
 let recovered=false,current;
 try{
  const raw=storage.getItem(SETTINGS_KEY);
  if(raw){const parsed=JSON.parse(raw);recovered=parsed?.version!==SETTINGS_VERSION;current=sanitizeSettings(parsed,model);}
  else {current=defaultSettings();const theme=legacyStorage?.getItem?.('raillink.theme');if(['system','light','dark'].includes(theme))current.appearance.theme=theme;current.notifications.system=legacyStorage?.getItem?.('raillink.systemAlerts')==='1';current=sanitizeSettings(current,model);}
 }catch{current=sanitizeSettings(defaultSettings(),model);recovered=true;}
 const write=value=>{
  const next=sanitizeSettings(value,model);if(next.transfer.maxWait<next.transfer.minWait)throw Error('최대 환승 대기시간은 최소 대기시간 이상이어야 합니다.');
  const failed=error=>{throw new Error(error?.name==='QuotaExceededError'?'설정 저장 공간이 부족합니다.':'설정을 저장하지 못했습니다. 브라우저 저장 권한을 확인하세요.',{cause:error});};
  const saved=()=>{current=next;try{legacyStorage?.setItem?.('raillink.theme',next.appearance.theme);legacyStorage?.setItem?.('raillink.systemAlerts',next.notifications.system?'1':'0');}catch{}return clone(current);};
  let result;try{result=storage.setItem(SETTINGS_KEY,JSON.stringify(next));}catch(error){return failed(error);}
  return result?.then?result.then(saved,failed):saved();
 };
 return {get:()=>clone(current),save:write,reset:()=>write(defaultSettings()),get recovered(){return recovered;}};
}

export function stationName(model,id){return model.stationRecords.find(station=>station.id===id)?.name||'';}
export function stationIdFor(model,name){return model.stationRecords.find(station=>station.name===name)?.id||'';}
export function currentKstClock(now=new Date()){
 return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
}
export function queryFromSettings(settings,model,date,now=new Date()){
 const s=settings.search,t=settings.transfer;
 return {from:stationName(model,s.fromStationId),to:stationName(model,s.toStationId),date,pax:s.pax,cls:s.cls,grade:'all',family:s.family,sort:s.sort,after:s.timeMode==='current'?currentKstClock(now):s.timeMode==='fixed'?s.fixedTime:'',defaultTimeMode:s.timeMode,transfer:s.routeMode==='transfer',includeTransfer:s.routeMode==='both',minWait:t.minWait,maxWait:t.maxWait,transferLimit:20,showSoldOut:s.showSoldOut,hideDeparted:s.hideDeparted,directFirst:s.routeOrder!=='transfer'};
}
export function seatOptions(settings){return {position:settings.seat.position,direction:settings.seat.direction,adjacent:settings.seat.adjacent,allowAlternative:settings.seat.allowAlternative};}
export function formatClock(value,mode='24'){
 if(mode!=='12'||!value)return value;
 const match=String(value).match(/^(\d{1,2}):(\d{2})$/);if(!match)return value;
 const hour=+match[1]%24;return `${hour<12?'오전':'오후'} ${hour%12||12}:${match[2]}`;
}
