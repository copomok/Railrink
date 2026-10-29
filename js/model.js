// Booking state belongs to RailLink; all railway rules are injected from NIMBY Rail.
export const STORE_KEY = 'raillink.v1';
export const kstDate = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul', year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const dayMs = 86400000;
export const addDays = (date, days) => new Date(Date.parse(date+'T12:00:00+09:00') + days*dayMs).toISOString().slice(0,10);
const check = (ok, message) => {if(!ok) throw new Error(message);};
export function createModel(data, storage, now = () => new Date()) {
  const trains = data.trains;
  const stations = [...new Set(trains.flatMap(t=>data.stops(t).map(s=>s.s)))].sort((a,b)=>a.localeCompare(b,'ko'));
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
    const stops=data.stops(train);
    for(let i=0;i<stops.length;i++) if(stops[i].s===from && stops[i].dep) {
      for(let j=i+1;j<stops.length;j++) if(stops[j].s===to && stops[j].arr) return {from,to,dep:stops[i].dep,arr:stops[j].arr,fi:i,ti:j,stops};
    }
    return null;
  }
  function validateQuery(q) {
    check(stations.includes(q.from)&&stations.includes(q.to), '목록에 있는 출발역과 도착역을 선택하세요.');
    check(q.from!==q.to, '출발역과 도착역을 다르게 선택하세요.');
    check(/^\d{4}-\d{2}-\d{2}$/.test(q.date) && addDays(q.date,0)===q.date && q.date>=kstDate(now()) && q.date<=addDays(kstDate(now()),30), '날짜는 오늘부터 30일 이내로 선택하세요.');
    check(Number.isInteger(+q.pax)&&+q.pax>=1&&+q.pax<=6, '인원은 1명부터 6명까지 선택하세요.');
    check(['general','special','premium'].includes(q.cls), '지원되는 좌석 등급을 선택하세요.');
  }
  function departure(seg,date) {return new Date(`${date}T${seg.dep.padStart(5,'0')}:00+09:00`);}
  function search(q) {
    validateQuery(q);
    return trains.flatMap(t=> {
      const seg=segment(t,q.from,q.to);
      if(!seg || (q.grade&&q.grade!=='all'&&q.grade!==t.grade))return [];
      const cars=data.classCars(data.cars(data.formation(t.grade,t.no)),q.cls);
      if(!cars.length) return [];
      const departed=departure(seg,q.date)<=now();
      if(q.after&&seg.dep.padStart(5,'0')<q.after)return [];
      return [{key:key(t),train:t,seg,departed,fare:data.fare(t,q.from,q.to,q.cls),duration:data.duration(seg.dep,seg.arr)}];
    }).sort((a,b)=>q.sort==='fare'?a.fare-b.fare:q.sort==='duration'?a.duration-b.duration:departure(a.seg,q.date)-departure(b.seg,q.date));
  }
  function serviceDate(t,q) {
    let previous=-1,offset=0;
    for(const s of t.stops){const clock=s.dep||s.arr;if(!/^\d{1,2}:\d{2}$/.test(clock||''))continue;const [h,m]=clock.split(':').map(Number),minute=h*60+m;if(previous>=0&&minute<previous-60)offset++;previous=minute;if(s.s===q.from&&s.dep)return addDays(q.date,-offset);}return q.date;
  }
  function availability(t,q) {return data.inventory(t,q.from,q.to,serviceDate(t,q),q.cls);}
  function seats(t,q) {
    const cars=data.classCars(data.cars(data.formation(t.grade,t.no)),q.cls);
    data.virtualSeats(t.no,serviceDate(t,q),cars,q.from,q.to,q.cls);
    const blocked=data.bookedSeats(t.no,serviceDate(t,q),q.from,q.to,q.cls);
    return cars.map(car=>({...car,seats:Array.from({length:car.rows},(_,i)=>i+1).flatMap(row=>(car.cols||[]).filter(col=>!(car.missingSeats||[]).includes(`${row}${col}`)).map(col=>({id:data.seatId(car,row,col),row,col,blocked:blocked.has(data.seatId(car,row,col)),reverse:row<=(car.revRows||0)})))}));
  }
  function book(draft, replaceId) {
    validateQuery(draft.q);
    const train=byKey.get(draft.key), q=draft.q;
    check(train,'열차가 변경되었습니다. 다시 조회하세요.');
    const seg=segment(train,q.from,q.to);
    check(seg && departure(seg,q.date)>now(),'이미 출발한 열차는 예약할 수 없습니다.');
    const state=read();
    const old=replaceId?state.tickets.find(t=>t.id===replaceId):null;
    if(replaceId) check(old?.status==='active' && new Date(old.departure)>now(),'변경할 예약을 찾을 수 없거나 이미 출발했습니다.');
    check(draft.names?.length===+q.pax && draft.names.every(n=>typeof n==='string'&&n.trim().length>0&&n.trim().length<=30),'승객별 별칭을 1~30자로 입력하세요.');
    check(draft.discount in data.discounts,'할인 유형을 확인하세요.');
    check(new Set(draft.seats).size===+q.pax,'인원수에 맞게 서로 다른 좌석을 선택하세요.');
    // Re-read local reservations and shared inventory immediately before saving.
    data.invalidate();
    const free=new Set(seats(train,q).flatMap(c=>c.seats).filter(s=>!s.blocked).map(s=>s.id));
    check(draft.seats.every(s=>free.has(s)) && availability(train,q).available>=+q.pax,'좌석 상태가 변경되었습니다. 좌석을 다시 선택하세요.');
    const perPerson=data.discount(data.fare(train,q.from,q.to,q.cls),draft.discount);
    const ticket={id:'RL-'+crypto.randomUUID(),key:draft.key,trainNo:train.no,grade:train.grade,fromStn:q.from,toStn:q.to,travelDate:q.date,serviceDate:serviceDate(train,q),seatClass:q.cls,seats:[...draft.seats],passengerCount:+q.pax,names:draft.names.map(n=>n.trim()),discount:draft.discount,totalFare:perPerson*+q.pax,status:'active',departure:departure(seg,q.date).toISOString(),dep:seg.dep,arr:seg.arr,createdAt:now().toISOString(),prototype:true};
    if(old) {old.status='changed';old.replacedBy=ticket.id;ticket.replaces=old.id;}
    state.tickets.push(ticket);save(state);return ticket;
  }
  function cancel(id) {
    const state=read(), t=state.tickets.find(t=>t.id===id);
    check(t?.status==='active','이미 취소되었거나 변경된 예약입니다.');
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
  return {data,trains,stations,key,byKey,read,save,search,segment,availability,seats,book,cancel,watch,departure,validateQuery};
}
