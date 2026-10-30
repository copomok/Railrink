import test from 'node:test';
import assert from 'node:assert/strict';
import {createModel} from '../js/model.js';
import {boardingState,boardingTickets,ticketTimes,activeLegIndex,transferGuidance,createBoardingService,calendarFile,safeJourneyText} from '../js/boarding.js';
import {boardingEvents} from '../js/boarding-notifications.js';
import {boardingView} from '../js/boarding-view.js';
import {ticketsView} from '../js/tickets.js';

const at=(time,date='2026-10-30')=>Date.parse(`${date}T${time}:00+09:00`);
const t={id:'private-booking-id',key:'train-key',status:'active',grade:'KTX',trainNo:'1',fromStn:'서울',toStn:'부산',dep:'08:00',arr:'10:00',departure:new Date(at('08:00')).toISOString(),arrival:new Date(at('10:00')).toISOString(),travelDate:'2026-10-30',serviceDate:'2026-10-30',seatClass:'general',seats:['5호차 12A']};
const snapshot={departure:at('08:00'),arrival:at('10:00'),fromIndex:0,toIndex:3,nodes:[
 {index:0,s:'서울',stop:true,arrTime:null,depTime:at('08:00'),platform:3},
 {index:1,s:'통과역',stop:false,arrTime:null,depTime:null},
 {index:2,s:'대전',stop:true,arrTime:at('09:00'),depTime:at('09:10')},
 {index:3,s:'부산',stop:true,arrTime:at('10:00'),depTime:null}]};
const state=(time,options={},ticket=t,snap=snapshot)=>boardingState(ticket,snap,at(time),options);
test('time-derived stages never assert actual departure, boarding or arrival',()=>{
 for(const [time,minutes] of [['06:00',120],['07:30',30],['07:55',5]]){const s=state(time);assert.equal(s.stage,'BEFORE_BOARDING');assert.equal(s.untilDeparture,minutes);}
 assert.equal(state('08:00').stage,'ON_BOARD');assert.equal(state('08:00').phase,'운행 안내');
 assert.equal(state('09:50').untilArrival,10);assert.equal(state('10:00').stage,'AFTER_ARRIVAL');assert.equal(state('10:00').arrived,false);assert.match(state('10:00').phase,/확인 중/);
 assert.equal(t.status,'active');
});
test('stop-aware progress holds at dwell, skips pass points and stays bounded',()=>{
 assert.equal(state('07:00').progress,0);assert.equal(state('09:00').progress,50);assert.equal(state('09:09').progress,50);assert.ok(state('09:30').progress>50);assert.equal(state('10:30').progress,100);
 assert.equal(state('08:20').next.s,'대전');assert.match(state('09:05').location,/대전 정차 예상/);assert.equal(state('09:05').next.s,'부산');
});
test('endpoint delays preserve booked times while exposing revised times and current position',()=>{
 const delayed={...snapshot,departure:at('08:04'),arrival:at('10:06'),nodes:snapshot.nodes.map(n=>n.s==='서울'?{...n,plannedDeparture:at('08:00'),depTime:at('08:04'),delay:4}:n.s==='대전'?{...n,plannedArrival:at('09:00'),plannedDeparture:at('09:10'),arrTime:at('09:04'),depTime:at('09:14'),arrivalDelay:4,delay:4}:n.s==='부산'?{...n,plannedArrival:at('10:00'),arrTime:at('10:06'),arrivalDelay:6}:n)};
 const s=state('08:30',{},t,delayed);assert.equal(s.plannedDeparture,at('08:00'));assert.equal(s.departure,at('08:04'));assert.equal(s.departureDelay,4);assert.equal(s.arrivalDelay,6);assert.equal(s.delayConfirmed,false);assert.ok(s.position);assert.equal(s.stops.length,3);
 const report={verified:true,trainKey:t.key,serviceDate:t.serviceDate,updatedAt:at('08:29'),status:'running',stops:[{station:'서울',departure:at('08:04')},{station:'부산',arrival:at('10:06')}]};
 assert.equal(state('08:30',{report},t,delayed).delayConfirmed,true);
});
test('assistant renders revised red times, every stop and a current-position marker',()=>{
 const delayed={...snapshot,departure:at('08:04'),arrival:at('10:06'),nodes:snapshot.nodes.map(n=>n.s==='서울'?{...n,plannedDeparture:at('08:00'),depTime:at('08:04'),delay:4}:n.s==='대전'?{...n,plannedArrival:at('09:00'),plannedDeparture:at('09:10'),arrTime:at('09:04'),depTime:at('09:14'),arrivalDelay:4,delay:4}:n.s==='부산'?{...n,plannedArrival:at('10:00'),arrTime:at('10:06'),arrivalDelay:6}:n)};
 const s=state('08:30',{},t,delayed),train={no:'1',grade:'KTX'};
 const model={byKey:new Map([[t.key,train]]),data:{colors:{KTX:'#123'},grades:{KTX:'KTX'},classes:{general:{label:'일반실'}}}};
 const html=boardingView({legs:[s],index:0,preview:null,manualLeg:null,model,esc:String,icon:()=>'<svg></svg>',seatDescription:'5호차 12A',shareSupported:true});
 assert.match(html,/class="delayed">08:04/);assert.match(html,/\(4분 지연 예상\)/);assert.match(html,/전체 정차역/);assert.equal((html.match(/<li /g)||[]).length,s.stops.length);assert.match(html,/boarding-train-position/);
});
test('ticket list keeps booked times and adds endpoint delay labels',()=>{
 const future={...t,departure:'2099-10-30T00:00:00.000Z',arrival:'2099-10-30T02:00:00.000Z',travelDate:'2099-10-30'};
 const model={read:()=>({tickets:[future]}),data:{colors:{KTX:'#123'}}};
 const html=ticketsView({model,esc:String,grade:String,won:String,icon:()=>'',delayState:()=>({departureDelay:4,arrivalDelay:6,delayConfirmed:false})});
 assert.match(html,/>08:00<\/b><small class="ticket-delay">\(4분 지연 예상\)/);assert.match(html,/>10:00<\/b><small class="ticket-delay">\(6분 지연 예상\)/);
});
test('matching verified feeds, stale data, missing data and cancellations remain distinct',()=>{
 const report={verified:true,trainKey:t.key,serviceDate:t.serviceDate,updatedAt:at('09:59'),status:'arrived',arrivalStation:'부산'};
 assert.equal(state('10:00',{report}).arrived,true);
 assert.equal(state('10:00',{report:{...report,arrivalStation:'서울'}}).arrived,false);
 assert.equal(state('10:00',{report:{...report,trainKey:'other'}}).arrived,false);
 assert.equal(state('10:10',{report}).stale,true);assert.equal(state('10:10',{report}).arrived,true);
 assert.equal(state('10:00',{report,offline:true}).arrived,true);
 assert.equal(state('10:00',{report:{...report,status:'cancelled'}}).cancelled,true);
 assert.equal(state('08:00',{}, {...t,status:'cancelled'}).cancelled,true);
 assert.equal(state('08:00',{},t,null).confidence,'운행 정보 확인 불가');
 const missing=boardingState({...t,departure:'bad',arrival:'bad',dep:'bad',arr:'bad'},null,at('08:00'));assert.equal(missing.hasTime,false);assert.equal(missing.progress,0);
 const noPlatform=state('08:00',{},t,{...snapshot,nodes:snapshot.nodes.map(n=>({...n,platform:null}))});assert.equal(noPlatform.platform,null);
});
test('verified revised times cross midnight and identify the correct service day',()=>{
 const night={...t,dep:'23:30',arr:'01:20',departure:new Date(at('23:30')).toISOString(),arrival:new Date(at('01:20','2026-10-31')).toISOString()};
 assert.equal(ticketTimes(night).arrival-ticketTimes(night).departure,110*60000);
 const s=boardingState(night,null,at('00:23','2026-10-31'));assert.equal(s.stage,'ON_BOARD');assert.equal(s.untilArrival,57);
 assert.equal(ticketTimes({...night,arrival:undefined}).arrival,ticketTimes(night).arrival);
 const report={verified:true,trainKey:t.key,serviceDate:t.serviceDate,updatedAt:at('23:50'),stops:[{station:'서울',departure:at('00:10','2026-10-31')},{station:'부산',arrival:at('02:10','2026-10-31')}]};
 const shifted=boardingState(t,snapshot,at('23:51'),{report});assert.equal(shifted.untilDeparture,19);assert.equal(shifted.stage,'BEFORE_BOARDING');
});
test('local ticket identity, cancellation, transfer grouping and roundtrip isolation',()=>{
 const first={...t,groupId:'group',groupType:'transfer'},second={...first,id:'second',departure:new Date(at('11:00')).toISOString()};
 assert.equal(boardingTickets([first,second],'other').length,0);assert.equal(boardingTickets([first,second],first.id).length,2);
 assert.equal(boardingTickets([first,{...second,status:'cancelled'}],'second').length,0);
 assert.equal(boardingTickets([{...first,groupType:'roundtrip'},second],first.id).length,1);
 assert.equal(boardingTickets([first,{...second,status:'cancelled'}],first.id).length,1);
});
test('transfer wait uses revised absolute arrival/departure and switches during the wait',()=>{
 const first=state('09:00'),second={...first,ticket:{...t,id:'second',fromStn:'부산'},departure:at('10:20'),arrival:at('12:00')};
 assert.equal(transferGuidance([first,second],0,at('09:00')).wait,20);assert.equal(activeLegIndex([first,second],at('09:00')),0);assert.equal(activeLegIndex([first,second],at('10:01')),1);
 const tight={...second,departure:at('10:05')};assert.equal(transferGuidance([first,tight],0,at('09:00')).risk,true);
 const delayed={...first,arrival:at('10:30')};assert.equal(transferGuidance([delayed,second],0).wait,-10);
 assert.match(transferGuidance([delayed,second],0).message,/遅|늦/);
 const overnight={...first,arrival:at('23:58')},after={...second,departure:at('00:18','2026-10-31')};assert.equal(transferGuidance([overnight,after],0).wait,20);
 assert.equal(transferGuidance([{...first,hasTime:false},second],0).wait,null);
 assert.match(transferGuidance([first,{...second,ticket:{...second.ticket,fromStn:'다른역'}}],0).message,/역간/);
});
test('canonical service uses previous-run service day, cached fallback, and running priority',()=>{
 const train={no:'night',grade:'KTX',stops:[{s:'시발',dep:'23:30'},{s:'서울',arr:'00:20',dep:'00:23'},{s:'부산',arr:'01:23'}]};
 let broken=false,calls=0;
 const model=createModel({trains:[train],stops:x=>x.stops,platform:()=>null},{getItem:()=>null});
 const key=[...model.byKey.keys()][0],seg=model.segment(train,'서울','부산');
 const booked={...t,key,dep:seg.dep,arr:seg.arr,departure:new Date(at('00:23')).toISOString(),arrival:new Date(at('01:23')).toISOString(),serviceDate:'2026-10-29'};
 const future={...booked,id:'future',travelDate:'2026-10-31',serviceDate:'2026-10-30',departure:new Date(at('00:23','2026-10-31')).toISOString(),arrival:new Date(at('01:23','2026-10-31')).toISOString()};
 model.read=()=>({tickets:[future,booked]});const original=model.segment;model.segment=(...args)=>{calls++;if(broken)throw Error();return original(...args);};
 const service=createBoardingService(model),s=service.journey(t.id,at('00:30'))[0];assert.equal(s.departure,at('00:23'));assert.equal(s.stops[0].s,'서울');assert.equal(service.upcoming(at('00:30'))[0].ticket.id,t.id);
 broken=true;assert.match(service.journey(t.id,at('00:31'))[0].error,/갱신 실패/);broken=false;
 service.journey(t.id,at('02:00'));const previous=calls;service.journey(t.id,at('03:00'));assert.equal(calls,previous);
});
test('notifications use narrow thresholds, revised versions, real platforms only and privacy-safe exports',()=>{
 const previous=new Map(),s=state('07:30'),events=boardingEvents([s],at('07:30'),previous);assert.equal(events.length,1);assert.match(events[0].key,/departure-30/);
 assert.equal(boardingEvents([state('07:55')],at('07:55'))[0].body.includes('5분'),true);
 const changed={...s,departure:s.departure+60000,delay:1,platform:7};const updates=boardingEvents([changed],at('07:30'),previous);assert.ok(updates.some(e=>e.key.includes('changed-time')));assert.ok(updates.some(e=>e.key.includes('platform')));
 assert.equal(boardingEvents([state('10:01')],at('10:01')).length,0);
 const text=safeJourneyText(s),ical=calendarFile(s);for(const secret of [t.id,t.seats[0]]){assert.ok(!text.includes(secret));assert.ok(!ical.includes(secret));}
 assert.match(ical,/DTSTART:20261029T230000Z/);assert.match(ical,/DTEND:20261030T010000Z/);
 for(const line of ical.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
