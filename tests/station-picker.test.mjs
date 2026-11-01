import test from 'node:test';
import assert from 'node:assert/strict';
import {closestStations} from '../js/station-picker.js';

test('closest stations use canonical coordinates and return only the requested nearest rows',()=>{
 const records=[
  {name:'서울',coordinate:{lat:37.555033,lon:126.970895}},
  {name:'용산',coordinate:{lat:37.5299,lon:126.9648}},
  {name:'부산',coordinate:{lat:35.1151,lon:129.0414}},
  {name:'좌표 없음',coordinate:null}
 ];
 const rows=closestStations(records,{latitude:37.554,longitude:126.971},2);
 assert.deepEqual(rows.map(row=>row.name),['서울','용산']);
 assert.ok(rows[0].distance<rows[1].distance);
 assert.deepEqual(closestStations(records,null,2),[]);
});
