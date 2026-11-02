import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {appRoot,sourceRoot} from '../tools/source.mjs';

const pilot=JSON.parse(fs.readFileSync(path.join(appRoot,'data/pilots/verified-route-pilot.json'),'utf8')),analysis=JSON.parse(fs.readFileSync(path.join(sourceRoot,'data/nimbi_route_pilot_analysis.json'),'utf8')),context={};context.window=context;context.globalThis=context;vm.createContext(context);for(const file of ['data/nimbi_latest_map.js','data/nimbi_mainline_map.js'])vm.runInContext(fs.readFileSync(path.join(sourceRoot,file),'utf8'),context);
const latest=context.NIMBI_LATEST_MAP,mainline=context.NIMBI_MAINLINE_MAP,segment=pilot.segments[0],route=mainline.routes.find(item=>item.id==='gyeongbu:0'),index=route.stations.findIndex(item=>item.name==='남안양');

test('pilot uses the line-scoped representative without claiming exact topology',()=>{
 assert.equal(pilot.purpose,'development-pilot-only');assert.equal(segment.sourceVersion,latest.source.sha256);assert.equal(segment.sourceVersion,analysis.source.sha256);
 assert.equal(segment.verificationMethod,'line-scoped-mainline-representative');assert.equal(segment.verificationStatus,'representative');assert.equal(route.representativeKinds[index],'representative');
 assert.equal(JSON.stringify(segment.geometry.coordinates),JSON.stringify(route.displaySegments[index]));assert.deepEqual(segment.originalTrackIds,[]);assert.equal(pilot.validation.discontinuityCount,0);
});

test('all intercity grades share the representative while depot and metro mistakes stay separate',()=>{
 assert.equal(pilot.trainRoutes.length,pilot.validation.reusedByServiceCount);assert.ok(pilot.trainRoutes.length>0);assert.ok(pilot.trainRoutes.every(item=>item.verificationStatus==='representative'&&item.segmentIds[0]===segment.id));
 assert.ok(pilot.validation.grades.includes('무궁화호'));assert.ok(pilot.validation.grades.some(grade=>grade.startsWith('ITX-')));assert.deepEqual(new Set(pilot.trainRoutes.map(item=>item.direction)),new Set(['forward','reverse']));
 assert.equal(pilot.depotConnector.status,'depot-connector');assert.match(pilot.depotConnector.reason,/대표 본선에 합치지 않고/);assert.ok(pilot.rejectedCandidates.some(item=>item.stations.join('-')==='남금호-서울'&&/전철 선형을 거부/.test(item.reason)));
 assert.equal(pilot.displayPolicy.connectedDeadEnd,'include');assert.equal(pilot.displayPolicy.connectedWithoutService,'include');assert.ok(pilot.validation.lengthRatio<1.2);
});
