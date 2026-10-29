import test from 'node:test';import assert from 'node:assert/strict';
import {tourismGroups} from '../js/tourism.js';
test('tourism keeps every train under grade, service and separate direction',()=>{
 const train=(no,grade,from,to,dir,line='노선')=>({no,grade,line,dir,stops:[{s:from,dep:'10:00'},{s:to,arr:'12:00'}]});
 const trains=[train('1','국악와인','A','B','down'),train('3','국악와인','A','B','down'),train('2','국악와인','B','A','up'),train('5','국악와인','A','C','down'),train('7','남도해양','A','B','down'),train('9','KTX','A','B','down')];
 const groups=tourismGroups({trains,key:t=>t.no,data:{stops:t=>t.stops}});
 assert.equal(groups.length,2);const wine=groups.find(g=>g.grade==='국악와인');assert.equal(wine.systems.length,2);
 const ab=wine.systems.find(s=>s.endpoints.join('')==='AB');assert.deepEqual(ab.directions.find(d=>d.id==='down').trains.map(t=>t.train.no),['1','3']);assert.deepEqual(ab.directions.find(d=>d.id==='up').trains.map(t=>t.train.no),['2']);
 assert.equal(groups.flatMap(g=>g.systems.flatMap(s=>s.directions.flatMap(d=>d.trains))).length,5);
});
