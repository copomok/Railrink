import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {appRoot,sourceRoot} from '../tools/source.mjs';

const pilot=JSON.parse(fs.readFileSync(path.join(appRoot,'data/pilots/verified-route-pilot.json'),'utf8')),context={};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(sourceRoot,'data/nimbi_latest_map.js'),'utf8'),context);const latest=context.NIMBI_LATEST_MAP,segment=pilot.segments[0];

test('pilot keeps the source version and every coordinate on explicit save-file track edges',()=>{
 assert.equal(pilot.purpose,'development-pilot-only');assert.equal(segment.sourceVersion,latest.source.sha256);assert.equal(segment.verificationMethod,'game-topology');assert.equal(segment.verificationStatus,'verified');assert.equal(pilot.validation.discontinuityCount,0);assert.equal(pilot.validation.maxDistanceFromOriginalMeters,0);
 const edges=new Set();for(const source of segment.originalTrackIds){const track=latest.tracks[source.lineIndex],hash=crypto.createHash('sha256').update(JSON.stringify(track)).digest('hex').slice(0,16);assert.equal(source.sourceVersion,latest.source.sha256);assert.equal(source.coordinateHash,hash);for(let index=1;index<track.length;index++){const a=track[index-1].join(','),b=track[index].join(',');edges.add(`${a}|${b}`);edges.add(`${b}|${a}`);}}
 const coordinates=segment.geometry.coordinates;assert.equal(coordinates.length,pilot.validation.coordinateCount);for(let index=1;index<coordinates.length;index++)assert.ok(edges.has(`${coordinates[index-1].join(',')}|${coordinates[index].join(',')}`),`missing source edge ${index}`);
});

test('pilot rejects the ambiguous Seoul candidate and reuses one segment for both directions',()=>{
 assert.deepEqual(pilot.rejectedCandidate.stations,['서울','수원','천안']);assert.match(pilot.rejectedCandidate.reason,/확정할 수 없음/);assert.equal(pilot.trainRoutes.length,pilot.validation.reusedByServiceCount);assert.equal(new Set(pilot.trainRoutes.flatMap(route=>route.segmentIds)).size,1);assert.deepEqual(new Set(pilot.trainRoutes.map(route=>route.direction)),new Set(['forward','reverse']));assert.ok(pilot.validation.lengthRatio<1.2);
});
