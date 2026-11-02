import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {appRoot,sourceRoot} from '../tools/source.mjs';

const pilot=JSON.parse(fs.readFileSync(path.join(appRoot,'data/pilots/verified-route-pilot.json'),'utf8'));
const analysis=JSON.parse(fs.readFileSync(path.join(sourceRoot,'data/nimbi_route_pilot_analysis.json'),'utf8'));
const context={};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(sourceRoot,'data/nimbi_latest_map.js'),'utf8'),context);
const latest=context.NIMBI_LATEST_MAP,segment=pilot.segments[0],candidate=analysis.pilot;

test('pilot candidate is copied from the game line entity without changing geometry',()=>{
 assert.equal(pilot.purpose,'development-pilot-only');assert.equal(segment.sourceVersion,latest.source.sha256);assert.equal(segment.sourceVersion,analysis.source.sha256);
 assert.equal(segment.verificationMethod,'game-route-mainline-representative');assert.equal(segment.verificationStatus,'verified');assert.equal(pilot.lineEntity.entityId,analysis.line.entityId);
 assert.deepEqual(segment.geometry.coordinates,candidate.geometry);assert.deepEqual(segment.originalTrackIds,candidate.trackPointIds);
 assert.equal(pilot.validation.discontinuityCount,0);assert.equal(pilot.validation.maxDistanceFromOriginalMeters,0);assert.equal(pilot.validation.branchNodeCount,2);assert.equal(pilot.validation.branchNodesAllowedAsStationTrackDetail,true);
 const edges=new Set();for(const track of latest.tracks)for(let index=1;index<track.length;index++){const a=track[index-1].join(','),b=track[index].join(',');edges.add(`${a}|${b}`);edges.add(`${b}|${a}`);}
 for(let index=1;index<candidate.geometry.length;index++)assert.ok(edges.has(`${candidate.geometry[index-1].join(',')}|${candidate.geometry[index].join(',')}`),`missing source edge ${index}`);
});

test('representative mainline is reused while the depot connector stays separate',()=>{
 assert.equal(pilot.trainRoutes.length,pilot.validation.reusedByServiceCount);assert.ok(pilot.trainRoutes.length>0);
 assert.ok(pilot.trainRoutes.every(route=>route.verificationStatus==='partial'&&route.segmentIds.length===1&&route.segmentIds[0]===segment.id));
 assert.deepEqual(new Set(pilot.trainRoutes.map(route=>route.direction)),new Set(['forward','reverse']));
 assert.match(pilot.pilot.reason,/대표 본선/);assert.equal(pilot.depotConnector.status,'depot-connector');assert.match(pilot.depotConnector.reason,/차량기지/);
 assert.equal(pilot.displayPolicy.connectedDeadEnd,'include');assert.equal(pilot.displayPolicy.connectedWithoutService,'include');assert.equal(pilot.displayPolicy.fullyIsolatedWithoutLineReference,'exclude-after-parser-validation');
 assert.ok(pilot.rejectedCandidates.some(item=>item.stations.join('-')==='평택-천안'&&/철회/.test(item.reason)));
 assert.ok(pilot.validation.lengthRatio<1.1);
});
