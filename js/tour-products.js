import {addDays} from './model.js';

const step=(time,title,description,kind='place')=>({time,title,description,kind});

export const tourProducts=[
 {
  id:'tour-gyeongju',name:'천년의 시간, 경주 여행',shortName:'경주 여행',category:'역사·문화',icon:'history',
  summary:'유적과 오래된 골목이 이어지는 도시, 경주',description:'대릉원과 황리단길을 걸으며 신라의 시간을 만나고, 첨성대·월정교로 이어지는 도심 유적을 둘러보는 여행입니다.',
  routeLabel:'서울 ↔ 경주 권역',fromCandidates:['서울'],toCandidates:['경주'],attractions:['황리단길','대릉원','첨성대','월정교','동궁과 월지','불국사'],
  durations:[{id:'day',label:'당일',days:0},{id:'stay',label:'1박 2일',days:1}],defaultDuration:'day',
  outbound:{start:'07:00',end:'09:00'},returns:{day:{start:'18:00',end:'21:00'},stay:{start:'17:00',end:'21:00'}},
  schedules:{
   day:[step('07:00~09:00','서울 출발','선택한 출발역에서 경주행 열차 검색','train'),step('10:00~12:00','경주 도착·이동','황리단길과 대릉원 산책'),step('12:00~13:30','점심','현지 식사와 휴식','meal'),step('13:30~16:30','첨성대·교촌마을·월정교','도심 역사 탐방과 자유시간','history'),step('16:30~18:00','역으로 이동','교통편과 열차 시각을 고려해 이동','route'),step('18:00~21:00','경주 출발','조회 결과에서 복귀편 선택','train')],
   stay:[step('1일차 07:00~09:00','서울 출발','경주행 열차 검색','train'),step('1일차 낮','도심 역사유적 탐방','황리단길·대릉원·첨성대·월정교','history'),step('1일차 저녁','동궁과 월지','야경 관람 후 개별 숙박'),step('2일차 09:00~12:00','불국사 등 외곽 유적','별도 교통편으로 이동','history'),step('2일차 13:00~16:00','박물관 또는 보문권','여행 취향에 맞춰 선택'),step('2일차 17:00~21:00','경주 출발','조회 결과에서 복귀편 선택','train')]
  },notes:['경주 시내와 경주권 철도역 사이 이동에는 별도 교통수단이 필요할 수 있습니다.']
 },
 {
  id:'tour-gangneung',name:'바다와 커피, 강릉 하루',shortName:'강릉 하루',category:'바다·카페',icon:'coffee',
  summary:'바다 산책과 커피 향을 한 번에 만나는 하루',description:'경포와 안목의 바다를 걷고 커피거리와 중앙시장을 둘러보는 당일 여행입니다. 해변 방문 순서는 자유롭게 바꿀 수 있습니다.',
  routeLabel:'서울 ↔ 강릉',fromCandidates:['서울'],toCandidates:['강릉'],attractions:['경포호','경포해변','강문해변','안목해변','강릉 커피거리','중앙시장'],
  durations:[{id:'day',label:'당일',days:0}],defaultDuration:'day',outbound:{start:'06:30',end:'09:00'},returns:{day:{start:'18:00',end:'21:30'}},
  schedules:{day:[step('06:30~09:00','서울 출발','강릉행 열차 검색','train'),step('10:00~12:00','경포호·경포해변','호수와 해변 산책'),step('12:00~13:30','점심','현지 식사와 휴식','meal'),step('13:30~16:00','안목해변·커피거리','해변 산책과 카페 자유시간','coffee'),step('16:00~17:30','중앙시장 또는 자유시간','취향에 맞춰 방문'),step('18:00~21:30','강릉 출발','조회 결과에서 복귀편 선택','train')]},
  notes:['해변과 강릉역 사이 이동에는 별도 교통수단이 필요할 수 있습니다.']
 },
 {
  id:'tour-jeonju',name:'맛과 멋의 도시, 전주',shortName:'전주 여행',category:'미식·전통',icon:'food',
  summary:'한옥 골목과 전통의 맛을 천천히 즐기는 여행',description:'전주한옥마을과 경기전, 전동성당을 둘러보고 시장과 전통 먹거리를 즐기는 여행입니다.',
  routeLabel:'서울 ↔ 전주',fromCandidates:['서울'],toCandidates:['전주'],attractions:['전주한옥마을','경기전','전동성당','남부시장','전통문화 체험 공간'],
  durations:[{id:'day',label:'당일',days:0},{id:'stay',label:'1박 2일',days:1}],defaultDuration:'day',outbound:{start:'06:30',end:'09:30'},returns:{day:{start:'18:00',end:'21:00'},stay:{start:'17:00',end:'21:00'}},
  schedules:{
   day:[step('06:30~09:30','서울 출발','전주행 열차 검색','train'),step('10:00~12:00','한옥마을·경기전','전통 골목 산책','history'),step('12:00~13:30','전주 음식 체험','개별 식사','meal'),step('13:30~15:30','전동성당·공예 체험','원하는 체험을 직접 선택'),step('15:30~17:30','남부시장·자유시간','시장 방문 후 역으로 이동'),step('18:00~21:00','전주 출발','조회 결과에서 복귀편 선택','train')],
   stay:[step('1일차 오전','서울 출발','전주행 열차 검색','train'),step('1일차 낮','한옥마을과 전통 먹거리','경기전·전동성당과 골목 탐방','history'),step('1일차 저녁','야간 골목 산책','숙박은 개별 예약'),step('2일차 오전','전통문화 체험','원하는 체험을 직접 선택'),step('2일차 오후','시장과 카페','남부시장과 주변 자유시간'),step('2일차 17:00~21:00','전주 출발','조회 결과에서 복귀편 선택','train')]
  },notes:['한복 체험, 음식과 숙박은 상품에 포함되지 않으며 직접 선택합니다.']
 },
 {
  id:'tour-pyongyang',name:'평양, 도시의 시간을 걷다',shortName:'평양 도시 여행',category:'북부 도시·문화',icon:'city',
  summary:'NIMBIRAIL 세계관 속 북부 도시 문화 여행',description:'대동강 주변과 도시 건축, 역사·문화를 둘러보는 NIMBIRAIL 가상 철도 세계관의 1박 2일 여행입니다.',
  routeLabel:'서울 ↔ 평양',fromCandidates:['서울'],toCandidates:['평양'],attractions:['대동강 주변','도시 건축 탐방','역사·문화 탐방','전시·시티투어'],
  durations:[{id:'stay',label:'1박 2일',days:1}],defaultDuration:'stay',outbound:{start:'07:00',end:'10:00'},returns:{stay:{start:'17:00',end:'21:00'}},
  schedules:{stay:[step('1일차 07:00~10:00','서울 출발','평양행 열차 또는 환승 경로 검색','train'),step('1일차 12:00~13:30','점심','개별 식사','meal'),step('1일차 13:30~17:00','대동강·도시 건축 탐방','가상 도시 문화 코스','city'),step('1일차 18:00~20:30','야경·저녁','숙박은 개별 준비'),step('2일차 09:00~12:00','역사·문화 탐방','도시의 역사 공간 둘러보기','history'),step('2일차 13:30~16:00','전시·시티투어·자유시간','취향에 맞춰 선택'),step('2일차 17:00~21:00','평양 출발','조회 결과에서 복귀편 선택','train')]},
  notes:['이 상품은 NIMBIRAIL 가상 철도 세계관의 여행 안내이며 실제 남북 관광 상품이 아닙니다.','해당 날짜에 DB에 등록된 열차 또는 환승 경로가 있을 때만 조회됩니다.']
 },
 {
  id:'tour-sunrise',name:'동해의 첫 햇살',shortName:'동해 일출 여행',category:'일출·자연',icon:'sun',
  summary:'정동진 권역에서 맞이하는 동해의 아침',description:'저녁 열차로 강릉·정동진 권역에 이동해 숙박한 뒤 해변의 일출과 해안 산책을 즐기는 여행입니다.',
  routeLabel:'서울 ↔ 정동진 권역',fromCandidates:['서울'],toCandidates:['정동진','강릉'],attractions:['정동진 해변','모래시계공원','동해안 해안 산책로'],
  durations:[{id:'stay',label:'1박 2일',days:1}],defaultDuration:'stay',outbound:{start:'17:00',end:'22:00'},returns:{stay:{start:'16:00',end:'21:00'}},
  schedules:{stay:[step('1일차 17:00~22:00','서울 출발','목적지 권역 열차 검색','train'),step('2일차 일출 무렵','정동진 해변','여행 날짜의 일출 정보를 별도로 확인','sun'),step('08:00~10:00','아침·휴식','개별 식사','meal'),step('10:00~13:00','정동진·모래시계공원','해변 주변 산책'),step('13:00~15:30','해안 산책 또는 자유시간','복귀 이동시간 확인'),step('16:00~21:00','목적지 권역 출발','조회 결과에서 복귀편 선택','train')]},
  notes:['정동진역이 DB에 없으면 실제 열차가 조회되는 가까운 권역역을 사용하며 이후 이동은 별도입니다.','일출 시각과 숙박은 포함되지 않으므로 여행 날짜에 맞춰 직접 확인합니다.']
 },
 {
  id:'tour-rail-loop',name:'철길 따라 전국 일주',shortName:'전국 일주',category:'철도 자유여행',icon:'route',
  summary:'도시와 도시를 열차로 잇는 3박 4일 자유여행',description:'서울에서 강릉·안동·경주·부산을 거쳐 돌아오는 제안 코스입니다. 각 구간의 실제 열차와 환승 경로를 차례로 조회합니다.',
  routeLabel:'서울 → 강릉 → 안동 → 경주 → 부산 → 서울',fromCandidates:['서울'],toCandidates:['강릉'],attractions:['강릉 해안','안동 전통문화','경주 역사유적','부산 도심·해안'],
  durations:[{id:'loop',label:'3박 4일',days:3}],defaultDuration:'loop',outbound:{start:'06:00',end:'10:00'},returns:{loop:{start:'17:00',end:'21:00'}},
  schedules:{loop:[step('1일차 06:00~10:00','서울 → 강릉','강릉 해안·도심, 개별 숙박','train'),step('2일차 08:00~12:00','강릉 → 안동','안동 전통문화, 개별 숙박','train'),step('3일차 08:00~12:00','안동 → 경주','경주 역사유적, 개별 숙박','train'),step('4일차 07:00~11:00','경주 → 부산','부산 도심·해안','train'),step('4일차 17:00~21:00','부산 → 서울','마지막 귀가 구간','train')]},
  segments:[
   {day:0,from:'서울',to:'강릉',start:'06:00',end:'10:00'},
   {day:1,from:'강릉',to:'안동',start:'08:00',end:'12:00'},
   {day:2,from:'안동',to:'경주',start:'08:00',end:'12:00'},
   {day:3,from:'경주',to:'부산',start:'07:00',end:'11:00'},
   {day:3,from:'부산',to:'서울',start:'17:00',end:'21:00'}
  ],notes:['각 구간은 실제 DB에서 개별 조회·예매합니다. 일부 구간 예매만으로 전체 여정이 완료되지는 않습니다.','직통편이 없으면 환승 경로를 함께 확인하며, 경로가 없으면 도시 순서나 날짜를 조정해야 합니다.']
 }
];

export const tourProductById=id=>tourProducts.find(product=>product.id===id);

export function resolveProductRoute(product,model){
 const find=candidates=>candidates.find(name=>model.stations.includes(name))||'';
 const from=find(product.fromCandidates),to=find(product.toCandidates);
 const record=name=>model.stationRecords.find(station=>station.name===name);
 return {from,to,fromId:record(from)?.id||'',toId:record(to)?.id||'',available:Boolean(from&&to)};
}

export function tourDuration(product,id){return product.durations.find(duration=>duration.id===id)||product.durations.find(duration=>duration.id===product.defaultDuration)||product.durations[0];}

export function buildTourPlan(product,{date,durationId,from,to,pax=1,cls='general',includeTransfer=true}={}){
 const duration=tourDuration(product,durationId),segments=product.segments?.map((segment,index)=>({...segment,...(index===0?{from:from||segment.from,to:to||segment.to}:{}),index,date:addDays(date,segment.day),booked:false}))||[
  {index:0,date,from,to,start:product.outbound.start,end:product.outbound.end,direction:'outbound',booked:false},
  {index:1,date:addDays(date,duration.days),from:to,to:from,start:product.returns[duration.id].start,end:product.returns[duration.id].end,direction:'return',booked:false}
 ];
 return {version:1,productId:product.id,date,durationId:duration.id,pax:+pax,cls,includeTransfer:Boolean(includeTransfer),activeSegment:0,segments};
}

export function tourSegmentQuery(plan,index=plan.activeSegment){
 const segment=plan.segments[index];
 return {from:segment.from,to:segment.to,date:segment.date,pax:plan.pax,cls:plan.cls,grade:'all',family:'all',sort:'departure',after:segment.start,before:segment.end,transfer:false,includeTransfer:plan.includeTransfer,tourProductId:plan.productId,tourSegmentIndex:index};
}

export function markTourSegmentBooked(plan,index,ticketIds=[]){
 return {...plan,activeSegment:Math.min(index+1,plan.segments.length-1),segments:plan.segments.map((segment,i)=>i===index?{...segment,booked:true,ticketIds:[...ticketIds]}:segment)};
}

export function nextUnbookedTourSegment(plan){return plan.segments.findIndex(segment=>!segment.booked);}
