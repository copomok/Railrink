import {serviceTimeline,minuteOf,stationId} from './railway-time.js';
import {findTransfers} from './routing.js';
// Booking state belongs to RailLink; all railway rules are injected from NIMBY Rail.
export const STORE_KEY = 'raillink.v1';
export const kstDate = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul', year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const dayMs = 86400000;
export const addDays = (date, days) => new Date(Date.parse(date+'T12:00:00+09:00') + days*dayMs).toISOString().slice(0,10);
const check = (ok, message) => {if(!ok) throw new Error(message);};
export function createModel(data, storage, now = () => new Date()) {
  const trains = data.trains;
  const stations = [...new Set(trains.flatMap(t=>data.stops(t).map(s=>s.s)))].sort((a,b)=>a.localeCompare(b,'ko'));
  const stationRecords=stations.map(name=>{const meta=data.stationDB?.[name]||data.stationDB?.[name+'역'];return {name,id:meta?.sourceId?'nimby:source:'+meta.sourceId:stationId(name),sourceId:meta?.sourceId||'',region:/\(([^)]+)\)/.exec(name)?.[1]||'',coordinate:data.coordinate?.(name)||null};});
  const stationIdentity=name=>stationRecords.find(s=>s.name===name)?.id||stationId(name);
  const key = t => JSON.stringify([t.no,t.line,t.stops[0]?.s,t.stops[0]?.dep,t.dest]);
  const byKey = new Map(trains.map(t=>[key(t),t]));
  const blank = () => ({version:1,tickets:[],watches:[],routes:[],notifications:true});
  function read() {
    const raw = storage.getItem(STORE_KEY);
    if (!raw) return blank();
    let value;
    try {value=JSON.parse(raw);} catch {throw new Error('저장한 예약 정보를 읽을 수 없습니다. 마이 화면에서 데이터를 내보낸 후 초기화해 주세요.');}
    check(value?.version===1 && ['tickets','watches','routes'].every(k=>Array.isArray(value[k])), '저장 정보 형식이 올바르지 않습니다. 기존 데이터는 보존했습니다.');
    return value;
  }
  function save(value) {
    try {storage.setItem(STORE_KEY,JSON.stringify(value));} catch {throw new Error('브라우저 저장 공간을 사용할 수 없습니다. 저장 허용 여부를 확인하세요.');}
    data.invalidate();
  }
  function segment(train, from, to) {
    const stops=data.stops(train),timeline=serviceTimeline(stops);
    for(let i=0;i<stops.length;i++) if(stops[i].s===from && stops[i].dep) {
      for(let j=i+1;j<stops.length;j++) if(stops[j].s===to && stops[j].arr) return {from,to,dep:stops[i].dep,arr:stops[j].arr,fi:i,ti:j,stops,departureMinutes:timeline[i].departure,arrivalMinutes:timeline[j].arrival,duration:timeline[j].arrival-timeline[i].departure};
    }
    return null;
  }
  function validateQuery(q) {
    check(stations.includes(q.from)&&stations.includes(q.to), '목록에 있는 출발역과 도착역을 선택하세요.');
    check(!q.after||minuteOf(q.after)!==null,'출발 기준 시각을 확인하세요.');
    check(q.from!==q.to, '출발역과 도착역을 다르게 선택하세요.');
    check(/^\d{4}-\d{2}-\d{2}$/.test(q.date) && addDays(q.date,0)===q.date && q.date>=kstDate(now()) && q.date<=addDays(kstDate(now()),30), '날짜는 오늘부터 30일 이내로 선택하세요.');
    check(Number.isInteger(+q.pax)&&+q.pax>=1&&+q.pax<=6, '인원은 1명부터 6명까지 선택하세요.');
    check(['general','special','premium','standing'].includes(q.cls), '지원되는 좌석 등급을 선택하세요.');
  }
  function departure(seg,date) {return new Date(`${date}T${seg.dep.padStart(5,'0')}:00+09:00`);}
  function search(q) {
    validateQuery(q);
    return trains.flatMap(t=> {
      const seg=segment(t,q.from,q.to);
      if(!seg || (q.grade&&q.grade!=='all'&&q.grade!==t.grade))return [];
      const cars=data.classCars(data.cars(data.formation(t.grade,t.no)),q.cls);
      if(!cars.length && q.cls!=='standing') return [];
      const departed=departure(seg,q.date)<=now();
      if(departed)return [];
      if(q.after&&minuteOf(seg.dep)<minuteOf(q.after))return [];
      return [{key:key(t),train:t,seg,departed,fare:data.fare(t,q.from,q.to,q.cls),duration:seg.duration}];
    }).sort((a,b)=>q.sort==='fare'?a.fare-b.fare:q.sort==='duration'?a.duration-b.duration:departure(a.seg,q.date)-departure(b.seg,q.date));
  }
  function serviceDate(t,q) {
    const seg=segment(t,q.from,q.to);
    return seg?addDays(q.date,-Math.floor(seg.departureMinutes/1440)):q.date;
  }

  function availability(t,q) {return data.inventory(t,q.from,q.to,serviceDate(t,q),q.cls);}
  function seats(t,q) {
    const cars=data.classCars(data.cars(data.formation(t.grade,t.no)),q.cls);
    data.virtualSeats(t.no,serviceDate(t,q),cars,q.from,q.to,q.cls);
    const blocked=data.bookedSeats(t.no,serviceDate(t,q),q.from,q.to,q.cls);
    return cars.map(car=>({...car,seats:Array.from({length:car.rows},(_,i)=>i+1).flatMap(row=>(car.cols||[]).filter(col=>!(car.missingSeats||[]).includes(`${row}${col}`)).map(col=>({id:data.seatId(car,row,col),row,col,blocked:blocked.has(data.seatId(car,row,col)),reverse:row<=(car.revRows||0)})))}));
  }
  function prepareTicket(draft, state, replaceId) {
    validateQuery(draft.q);
    const train=byKey.get(draft.key), q=draft.q;
    check(train,'열차가 변경되었습니다. 다시 조회하세요.');
    const seg=segment(train,q.from,q.to);
    check(seg && departure(seg,q.date)>now(),'이미 출발한 열차는 예약할 수 없습니다.');
    const old=replaceId?state.tickets.find(t=>t.id===replaceId):null;
    if(replaceId)check(!old?.groupId,'통합 여정은 전체 취소 후 다시 예약하세요.');
    if(replaceId) check(old?.status==='active' && new Date(old.departure)>now(),'변경할 예약을 찾을 수 없거나 이미 출발했습니다.');
    check(draft.names?.length===+q.pax && draft.names.every(n=>typeof n==='string'&&n.trim().length>0&&n.trim().length<=30),'승객별 별칭을 1~30자로 입력하세요.');
    const discounts=draft.discounts||Array(+q.pax).fill(draft.discount);
    check(discounts.length===+q.pax&&discounts.every(d=>d in data.discounts),'할인 유형을 확인하세요.');
    check(q.cls==='standing'?draft.seats.length===0:new Set(draft.seats).size===+q.pax,'인원수에 맞게 서로 다른 좌석을 선택하세요.');
    // Re-read local reservations and shared inventory immediately before saving.
    data.invalidate();
    const free=new Set((q.cls==='standing'?[]:seats(train,q)).flatMap(c=>c.seats).filter(s=>!s.blocked).map(s=>s.id));
    check(draft.seats.every(s=>free.has(s)) && availability(train,q).eligible && availability(train,q).available>=+q.pax,'좌석 상태가 변경되었습니다. 좌석을 다시 선택하세요.');
    const baseFare=data.fare(train,q.from,q.to,q.cls),totalFare=discounts.reduce((sum,d)=>sum+data.discount(baseFare,d),0);
    const ticket={id:'RL-'+crypto.randomUUID(),key:draft.key,trainNo:train.no,grade:train.grade,fromStn:q.from,toStn:q.to,travelDate:q.date,serviceDate:serviceDate(train,q),seatClass:q.cls,seats:[...draft.seats],passengerCount:+q.pax,names:draft.names.map(n=>n.trim()),discount:discounts[0],discounts,totalFare,baseFare,fromStationId:stationIdentity(q.from),toStationId:stationIdentity(q.to),trainId:draft.key,departureServiceMinutes:seg.departureMinutes,arrivalServiceMinutes:seg.arrivalMinutes,arrival:new Date(+departure(seg,q.date)+seg.duration*60000).toISOString(),status:'active',departure:departure(seg,q.date).toISOString(),dep:seg.dep,arr:seg.arr,createdAt:now().toISOString(),prototype:true};
    if(old) {old.status='changed';old.replacedBy=ticket.id;ticket.replaces=old.id;}
    state.tickets.push(ticket);return ticket;
  }
  function bookMany(drafts,options={}) {
    check(navigatorOnline(),'오프라인에서는 새 예약을 저장할 수 없습니다.');
    check(Array.isArray(drafts)&&drafts.length>0&&drafts.length<=60,'예약 구간을 확인하세요.');
    const state=read(),created=[];
    check(!options.replaceId||drafts.length===1,'여정 변경은 구간별 재예약 후 전체 확인이 필요합니다.');
    for(const draft of drafts){
      const ticket=prepareTicket(draft,state,options.replaceId);
      for(const prior of created){
        check(!(Date.parse(ticket.departure)<Date.parse(prior.arrival)&&Date.parse(prior.departure)<Date.parse(ticket.arrival)),'선택한 여정 시간이 겹칩니다. 오는 편이나 환승 열차를 다시 선택하세요.');
      }
      created.push(ticket);
    }
    if(created.length>1&&options.type!=='pass'){const groupId='J-'+crypto.randomUUID();created.forEach((t,i)=>Object.assign(t,{groupId,groupType:options.type||'journey',groupSequence:i,groupTotal:created.length}));}
    if(options.pass){const id='P-'+crypto.randomUUID();state.passes=[...(state.passes||[]),{...options.pass,id,createdAt:now().toISOString()}];created.forEach(t=>t.passId=id);}
    save(state);return created;
  }
  function navigatorOnline(){return typeof navigator==='undefined'||navigator.onLine!==false;}
  function book(draft,replaceId){return bookMany([draft],{replaceId})[0];}
  function cancelGroup(id){
    const state=read(),selected=state.tickets.find(t=>t.id===id);
    check(selected,'예약을 찾을 수 없습니다.');
    const tickets=selected.groupId?state.tickets.filter(t=>t.groupId===selected.groupId):[selected];
    check(tickets.every(t=>t.status==='active'&&Date.parse(t.departure)>+now()),'이미 시작되거나 취소된 여정은 전체 취소할 수 없습니다.');
    tickets.forEach(t=>Object.assign(t,{status:'cancelled',cancelledAt:now().toISOString(),refund:t.totalFare}));save(state);
  }
  function removeHistory(id){
    const state=read(),selected=state.tickets.find(t=>t.id===id);check(selected,'기록을 찾을 수 없습니다.');
    const items=selected.groupId?state.tickets.filter(t=>t.groupId===selected.groupId):[selected];
    check(items.every(t=>t.status!=='active'||Date.parse(t.arrival||new Date(Date.parse(t.departure)+data.duration(t.dep,t.arr)*60000).toISOString())<=+now()),'진행 중이거나 예정된 예약은 기록을 삭제할 수 없습니다.');
    state.tickets=state.tickets.filter(t=>!items.includes(t));save(state);
  }
  function autoAssign(train,q,preference='together'){
    const cars=seats(train,q),count=+q.pax;
    const match=(s,c)=>preference==='window'?s.col===c.cols[0]||s.col===c.cols.at(-1):preference==='aisle'?s.col!==c.cols[0]&&s.col!==c.cols.at(-1):preference==='forward'?!s.reverse:preference==='reverse'?s.reverse:true;
    const candidates=cars.flatMap(c=>c.seats.filter(s=>!s.blocked).map(s=>({...s,car:c.car,preferred:match(s,c)})));
    for(const car of cars)for(let row=1;row<=car.rows;row++){
      const same=candidates.filter(s=>s.car===car.car&&s.row===row&&s.preferred);
      if(same.length>=count)return {seats:same.slice(0,count).map(s=>s.id),split:false,preferenceMet:true};
    }
    const sorted=[...candidates].sort((a,b)=>Number(b.preferred)-Number(a.preferred));
    check(sorted.length>=count,'자동 배정할 좌석이 부족합니다.');
    const chosen=sorted.slice(0,count);
    return {seats:chosen.map(s=>s.id),split:count>1,preferenceMet:chosen.every(s=>s.preferred)};
  }
  function mixed(train,q){
    validateQuery(q);const seg=segment(train,q.from,q.to);check(seg,'선택 구간을 찾을 수 없습니다.');
    const runs=[];
    for(let i=seg.fi;i<seg.ti;i++){
      const from=seg.stops[i].s,to=seg.stops[i+1].s,part=segment(train,from,to);
      const offset=Math.floor(part.departureMinutes/1440)-Math.floor(seg.departureMinutes/1440);
      const query={...q,from,to,date:addDays(q.date,offset)};
      const seated=availability(train,query);let cls=q.cls;
      if(!seated.eligible||seated.available<+q.pax){cls='standing';const standing=availability(train,{...query,cls});if(!standing.eligible||standing.available<+q.pax)return [];}
      const prior=runs.at(-1),combined=prior&&{...prior.q,to};
      if(prior&&prior.q.cls===cls&&availability(train,combined).available>=+q.pax){prior.q.to=to;}
      else runs.push({key:key(train),q:{...query,cls}});
    }
    if(runs.length<2)return [];
    return runs;
  }
  function cancel(id) {
    const state=read(), t=state.tickets.find(t=>t.id===id);
    check(t?.status==='active','이미 취소되었거나 변경된 예약입니다.');
    if(t.groupId)return cancelGroup(id);
    check(new Date(t.departure)>now(),'출발한 예약은 시제품에서 취소할 수 없습니다.');
    t.status='cancelled';t.cancelledAt=now().toISOString();t.refund=t.totalFare;save(state);
  }
  function watch(trainKey,q) {
    validateQuery(q);const t=byKey.get(trainKey),seg=t&&segment(t,q.from,q.to);
    check(seg&&departure(seg,q.date)>now(),'출발 전 열차만 대기 목록에 담을 수 있습니다.');
    const state=read();
    if(!state.watches.some(w=>w.key===trainKey&&JSON.stringify(w.q)===JSON.stringify(q))) state.watches.push({id:crypto.randomUUID(),key:trainKey,q:{...q}});
    save(state);
  }
  const model={data,trains,stations,stationRecords,key,byKey,read,save,search,segment,serviceDate,availability,seats,book,bookMany,cancel,cancelGroup,removeHistory,autoAssign,mixed,watch,departure,validateQuery};
  model.transfers=q=>{validateQuery(q);return findTransfers(model,q,now());};
  return model;
}
