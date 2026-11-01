import test from 'node:test';import assert from 'node:assert/strict';
import {tourismGroups} from '../js/tourism.js';
import {tourProducts,resolveProductRoute,buildTourPlan,tourSegmentQuery,markTourSegmentBooked,nextUnbookedTourSegment} from '../js/tour-products.js';
test('tourism keeps every train under grade, service and separate direction',()=>{
 const train=(no,grade,from,to,dir,line='노선')=>({no,grade,line,dir,stops:[{s:from,dep:'10:00'},{s:to,arr:'12:00'}]});
 const trains=[train('1','국악와인','A','B','down'),train('3','국악와인','A','B','down'),train('2','국악와인','B','A','up'),train('5','국악와인','A','C','down'),train('7','남도해양','A','B','down'),train('9','KTX','A','B','down')];
 const groups=tourismGroups({trains,key:t=>t.no,data:{stops:t=>t.stops}});
 assert.equal(groups.length,2);const wine=groups.find(g=>g.grade==='국악와인');assert.equal(wine.systems.length,2);
 const ab=wine.systems.find(s=>s.endpoints.join('')==='AB');assert.deepEqual(ab.directions.find(d=>d.id==='down').trains.map(t=>t.train.no),['1','3']);assert.deepEqual(ab.directions.find(d=>d.id==='up').trains.map(t=>t.train.no),['2']);
 assert.equal(groups.flatMap(g=>g.systems.flatMap(s=>s.directions.flatMap(d=>d.trains))).length,5);
});
test('six regional products keep unique ids, schedules and database station identities',()=>{
 assert.equal(tourProducts.length,6);assert.equal(new Set(tourProducts.map(product=>product.id)).size,6);
 assert.ok(tourProducts.every(product=>product.durations.length&&product.schedules[product.defaultDuration]?.length&&product.outbound.start&&product.returns[product.defaultDuration]));
 const model={stations:['서울','경주','강릉','전주','평양','안동','부산'],stationRecords:[{name:'서울',id:'station:seoul'},{name:'경주',id:'station:gyeongju'}]};
 const route=resolveProductRoute(tourProducts[0],model);assert.deepEqual(route,{from:'서울',to:'경주',fromId:'station:seoul',toId:'station:gyeongju',available:true});
 const sunrise=resolveProductRoute(tourProducts.find(product=>product.id==='tour-sunrise'),model);assert.equal(sunrise.to,'강릉');
});
test('tour plans preserve round trips and mark rail-loop segments independently',()=>{
 const gyeongju=tourProducts.find(product=>product.id==='tour-gyeongju'),roundTrip=buildTourPlan(gyeongju,{date:'2026-11-07',durationId:'stay',from:'서울',to:'경주',pax:2,cls:'general'});
 assert.equal(roundTrip.segments[1].date,'2026-11-08');assert.deepEqual([roundTrip.segments[0].from,roundTrip.segments[1].to],['서울','서울']);
 const query=tourSegmentQuery(roundTrip);assert.equal(query.before,'09:00');assert.equal(query.tourProductId,gyeongju.id);assert.equal(query.pax,2);
 const loop=buildTourPlan(tourProducts.find(product=>product.id==='tour-rail-loop'),{date:'2026-11-07',durationId:'loop',from:'서울',to:'강릉'});
 assert.equal(loop.segments.length,5);assert.equal(loop.segments[4].date,'2026-11-10');assert.equal(nextUnbookedTourSegment(loop),0);
 const progressed=markTourSegmentBooked(loop,0,['ticket-1']);assert.equal(progressed.segments[0].booked,true);assert.deepEqual(progressed.segments[0].ticketIds,['ticket-1']);assert.equal(nextUnbookedTourSegment(progressed),1);
});
