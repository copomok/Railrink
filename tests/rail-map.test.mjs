import test from 'node:test';
import assert from 'node:assert/strict';
import {createModel} from '../js/model.js';
import {buildRailNetwork,estimatedTrainSnapshot,mercatorCoordinate,mercatorPoint,snapshotCoordinate,stationServices,stationTimetable,trainGeoPath} from '../js/rail-map.js';

const trains=[
 {no:'101',grade:'KTX',line:'시험선',dest:'다',stops:[{s:'가',dep:'23:50'},{s:'나',geoKey:'나좌표',pass:true},{s:'다',arr:'0:20'}]},
 {no:'201',grade:'무궁화호',line:'지선',dest:'라',stops:[{s:'가',dep:'8:00'},{s:'라',arr:'8:30'}]}
];
const coords={가:{lat:37,lon:127},나좌표:{lat:36.8,lon:127.3},다:{lat:36.5,lon:128},라:{lat:36.6,lon:126.8}};
const data={trains,stationDB:{가역:{...coords.가,sourceId:'station-a'},다역:coords.다,라역:coords.라},stops:train=>train.stops.filter(stop=>!stop.pass),coordinate:name=>coords[name]||coords[String(name).replace(/역$/,'')],isPass:(train,name)=>train.stops.find(stop=>stop.s===name)?.pass};
const model=createModel(data,{getItem:()=>null},()=>new Date('2026-11-01T00:00:00+09:00'));

test('network uses verified timetable order, including coordinate pass points, without claiming exact track geometry',()=>{
 const network=buildRailNetwork(model);assert.equal(network.source.exactTrackGeometry,false);assert.equal(network.source.trainCount,2);
 assert.ok(network.stations.some(station=>station.name==='나'&&!station.stopping));assert.equal(network.stations.find(station=>station.name==='가').sourceId,'station-a');
 const pairs=network.edges.map(edge=>[edge.a.name,edge.b.name].sort().join('-'));assert.deepEqual(pairs.sort(),['가-나','가-라','나-다']);
 assert.deepEqual(stationServices(model,'가').lines,['시험선','지선']);assert.equal(stationTimetable(model,'가')[0].departure,'8:00');
 assert.equal(trainGeoPath(model,trains[0]).length,3);
});

test('timetable estimate follows an overnight train and returns its geographic position',()=>{
 const active=estimatedTrainSnapshot(model,trains[0],new Date('2026-11-02T00:05:00+09:00'));assert.ok(active);assert.equal(active.query.date,'2026-11-01');
 const coord=snapshotCoordinate(active.snapshot);assert.ok(coord.lon>127.3&&coord.lon<128);assert.ok(coord.lat<36.8&&coord.lat>36.5);
 assert.equal(estimatedTrainSnapshot(model,trains[1],new Date('2026-11-02T00:05:00+09:00')),null);
});

test('web mercator projection round-trips station coordinates at mobile map zooms',()=>{
 const original={lat:37.5665,lon:126.978},point=mercatorPoint(original,8),restored=mercatorCoordinate(point,8);
 assert.ok(Math.abs(restored.lat-original.lat)<1e-9);assert.ok(Math.abs(restored.lon-original.lon)<1e-9);
});
