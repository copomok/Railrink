import test from 'node:test';
import assert from 'node:assert/strict';
import {createModel} from '../js/model.js';
import {activeTrainMarkers,buildRailNetwork,estimatedTrainSnapshot,mercatorCoordinate,mercatorPoint,snapshotCoordinate,snapshotTrackCoordinate,stationServices,stationTimetable,trainGeoPath,trainSnapshotAt,trainTrackRoute} from '../js/rail-map.js';
import {operationSnapshot} from '../js/operations.js';

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

test('network uses only verified MAP_LINES source edges and ignores unrelated detailed geometry',()=>{
 const mainlineMap={source:{kind:'nimby-map-lines-exact-topology',mainlineOnly:true,routeCount:1,stationCount:2,edgeCount:1,verifiedSegments:1,unverifiedSegments:0,syntheticEdgeCount:0},routes:[{id:'main:0',line:'본선',stations:[{name:'가',lat:37.5,lon:126.9},{name:'원본전용',lat:37.4,lon:127.1}],segments:[[[126.91,37.49],[127,37.46],[127.09,37.41]]],segmentSources:[[7]]}]};
 const latestMap={source:{exactTrackGeometry:true},tracks:[[[128,35],[129,36]]],stations:[{name:'전철역',lat:35,lon:128}]};
 const mainlineModel=createModel({...data,mainlineMap,latestMap},{getItem:()=>null},()=>new Date('2026-11-01T00:00:00+09:00')),network=buildRailNetwork(mainlineModel),station=network.stations.find(item=>item.name==='가'),mapOnly=network.stations.find(item=>item.name==='원본전용');
 assert.equal(network.source.mainlineOnly,true);assert.equal(network.source.kind,'nimby-map-lines-exact-topology');assert.equal(network.source.syntheticEdgeCount,0);assert.deepEqual(network.geometry,[[[126.91,37.49],[127,37.46],[127.09,37.41]]]);
 assert.deepEqual(station.coord,{lat:37.5,lon:126.9});assert.equal(station.mapOnly,false);assert.equal(mapOnly.mapOnly,true);assert.equal(mapOnly.stopping,false);
 assert.equal(network.stations.some(item=>item.name==='전철'),false);
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

test('selected overnight train keeps the running service instance across midnight and after the 04:00 service-day boundary',()=>{
 const overnight={no:'1198',grade:'ITX-새마을',line:'시험선',stops:[{s:'영덕',dep:'22:40'},{s:'천안',arr:'0:40',dep:'0:42'},{s:'서울',arr:'4:30'}]},coordinates={영덕:{lat:36.4,lon:129.3},천안:{lat:36.8,lon:127.1},서울:{lat:37.55,lon:126.97}},nightData={trains:[overnight],stationDB:Object.fromEntries(Object.entries(coordinates).map(([name,coord])=>[name+'역',coord])),stops:train=>train.stops,coordinate:name=>coordinates[name],isPass:()=>false},nightModel=createModel(nightData,{getItem:()=>null});
 for(const time of ['2026-11-02T23:59:00+09:00','2026-11-03T00:00:00+09:00','2026-11-03T00:50:00+09:00','2026-11-03T03:59:00+09:00','2026-11-03T04:01:00+09:00']){const run=trainSnapshotAt(nightModel,overnight,new Date(time));assert.equal(run.snapshot.trainPhase,'running',time);assert.equal(run.snapshot.serviceDate,'2026-11-02',time);}
 const morning={...overnight,no:'500',stops:[{s:'영덕',dep:'5:00'},{s:'서울',arr:'7:00'}]},morningModel=createModel({...nightData,trains:[morning]},{getItem:()=>null}),future=trainSnapshotAt(morningModel,morning,new Date('2026-11-03T00:10:00+09:00'));assert.equal(future.snapshot.trainPhase,'before');assert.equal(future.snapshot.serviceDate,'2026-11-03');
});

test('selected route follows MAP_LINES station order with one continuous simplified path',()=>{
 const curve={no:'C1',grade:'ITX',line:'곡선',stops:[{s:'A',dep:'8:00'},{s:'B',arr:'8:20'}]},coordinates={A:{lat:37,lon:127},B:{lat:37,lon:127.02}},mainlineMap={source:{kind:'nimby-map-lines-exact-topology',mainlineOnly:true,routeCount:1,stationCount:3,edgeCount:2,verifiedSegments:2,unverifiedSegments:0,syntheticEdgeCount:0},routes:[{line:'곡선',stations:[{name:'A',...coordinates.A},{name:'C',lat:37.01,lon:127.01},{name:'B',...coordinates.B}],segments:[[[127,37],[127.005,37.006],[127.01,37.01]],[[127.01,37.01],[127.015,37.006],[127.02,37]]],segmentSources:[[11],[12]]}]},curveData={trains:[curve],stationDB:{A역:coordinates.A,B역:coordinates.B},stops:train=>train.stops,coordinate:name=>coordinates[name],isPass:()=>false,mainlineMap},curveModel=createModel(curveData,{getItem:()=>null}),route=trainTrackRoute(curveModel,curve);
 assert.equal(route.missingSegments,0);assert.equal(route.paths.length,1);assert.equal(route.fallbackSegments,0);assert.ok(route.paths[0].some(point=>point.coord.lat===37.01));
 const snapshot=operationSnapshot(curveModel,curve,{from:'A',to:'B',date:'2026-11-03'},new Date('2026-11-03T08:10:00+09:00')),position=snapshotTrackCoordinate(curveModel,curve,snapshot);assert.ok(position.lat>37.009);assert.ok(position.lon>127.009&&position.lon<127.011);
});

test('a disconnected source segment remains unavailable without a direct or detour fallback',()=>{
 const display=[[[127,37],[127.01,37.005],[127.02,37]]],train={no:'D1',grade:'ITX',line:'단절',stops:[{s:'A',dep:'8:00'},{s:'B',arr:'8:20'}]},coords={A:{lat:37,lon:127},B:{lat:37,lon:127.02}},mainlineMap={source:{kind:'nimby-map-lines-exact-topology',mainlineOnly:true,routeCount:1,stationCount:2,edgeCount:1,displaySegments:1,verifiedSegments:0,unverifiedSegments:1,syntheticEdgeCount:0},routes:[{line:'단절',stations:[{name:'A',...coords.A},{name:'B',...coords.B}],displaySegments:display,segments:[null],segmentSources:[[]],unverifiedSegments:[0]}]},detourModel=createModel({trains:[train],stationDB:{A역:coords.A,B역:coords.B},stops:item=>item.stops,coordinate:name=>coords[name],isPass:()=>false,mainlineMap},{getItem:()=>null}),route=trainTrackRoute(detourModel,train);
 assert.deepEqual(buildRailNetwork(detourModel).geometry,display);assert.equal(route.paths.length,0);assert.equal(route.missingSegments,1);assert.equal(route.fallbackSegments,0);assert.equal(snapshotTrackCoordinate(detourModel,train,operationSnapshot(detourModel,train,{from:'A',to:'B',date:'2026-11-03'},new Date('2026-11-03T08:10:00+09:00'))),null);const running=activeTrainMarkers(detourModel,new Date('2026-11-03T08:10:00+09:00'));assert.equal(running.length,1);assert.equal(running[0].coord,null);assert.equal(running[0].pathAvailable,false);
});

test('nearby parallel alternatives are not merged or selected when their source sequences differ',()=>{
 const train={no:'P1',grade:'ITX',line:'복선',stops:[{s:'A',dep:'8:00'},{s:'B',arr:'8:20'}]},coords={A:{lat:37,lon:127},B:{lat:37,lon:127.02}},routes=[{line:'복선',stations:[{name:'A',...coords.A},{name:'B',...coords.B}],segments:[[[127,37],[127.02,37]]],segmentSources:[[21]]},{line:'복선',stations:[{name:'A',...coords.A},{name:'B',...coords.B}],segments:[[[127,37.00005],[127.02,37.00005]]],segmentSources:[[22]]}],mainlineMap={source:{kind:'nimby-map-lines-exact-topology',mainlineOnly:true,verifiedSegments:2,unverifiedSegments:0,syntheticEdgeCount:0},routes},parallelModel=createModel({trains:[train],stationDB:{A역:coords.A,B역:coords.B},stops:item=>item.stops,coordinate:name=>coords[name],isPass:()=>false,mainlineMap},{getItem:()=>null}),route=trainTrackRoute(parallelModel,train);
 assert.equal(route.paths.length,0);assert.equal(route.missingSegments,1);
});

test('geometric crossings do not create a traversable connection',()=>{
 const train={no:'X1',grade:'ITX',line:'교차',stops:[{s:'서',dep:'8:00'},{s:'북',arr:'8:20'}]},coords={서:{lat:37,lon:126.99},동:{lat:37,lon:127.01},남:{lat:36.99,lon:127},북:{lat:37.01,lon:127}},routes=[{line:'동서',stations:[{name:'서',...coords.서},{name:'동',...coords.동}],segments:[[[126.99,37],[127.01,37]]],segmentSources:[[31]]},{line:'남북',stations:[{name:'남',...coords.남},{name:'북',...coords.북}],segments:[[[127,36.99],[127,37.01]]],segmentSources:[[32]]}],mainlineMap={source:{kind:'nimby-map-lines-exact-topology',mainlineOnly:true,verifiedSegments:2,unverifiedSegments:0,syntheticEdgeCount:0},routes},crossingModel=createModel({trains:[train],stationDB:Object.fromEntries(Object.entries(coords).map(([name,coord])=>[name+'역',coord])),stops:item=>item.stops,coordinate:name=>coords[name],isPass:()=>false,mainlineMap},{getItem:()=>null}),route=trainTrackRoute(crossingModel,train);
 assert.equal(route.paths.length,0);assert.equal(route.missingSegments,1);assert.equal(route.fallbackSegments,0);
});
