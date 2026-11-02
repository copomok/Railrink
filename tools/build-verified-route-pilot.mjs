import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {runtimeSource,sourceRoot,appRoot} from './source.mjs';

const analysis=JSON.parse(fs.readFileSync(path.join(sourceRoot,'data/nimbi_route_pilot_analysis.json'),'utf8'));
const candidate=analysis.pilotCandidate;
if(candidate.status!=='pending'||candidate.from!=='신탄진'||candidate.to!=='회덕역 / 대전차량기지')throw new Error('예상한 보류 시범 구간을 찾지 못했습니다.');
const context={console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},localStorage:{getItem:()=>null}};
context.window=context;vm.createContext(context);vm.runInContext(runtimeSource(),context);
const sourceVersion=analysis.source.sha256;
const candidateTrainRoutes=context.RailData.trains.flatMap(train=>{
 const names=train.stops.map(stop=>String(stop.s).replace(/역$/,''));
 const from=names.indexOf('신탄진'),to=names.indexOf('회덕');
 if(from<0||to<0||Math.abs(from-to)!==1)return [];
 return [{trainServiceId:`${train.grade}:${train.no}:${train.line}`,segmentIds:[],direction:from<to?'forward':'reverse',sourceVersion,verificationStatus:'unavailable'}];
});
const segmentId='pilot:gyeongbu:sintanjin-hoedeok-depot';
const payload={schemaVersion:2,purpose:'development-pilot-only',source:{...analysis.source,dataFormat:'nimbyrails5-line-entity-and-explicit-track-reference-graph'},lineEntity:{entityId:analysis.line.entityId,name:analysis.line.name,code:analysis.line.code,stationCount:analysis.line.route.length},rejectedCandidates:[{stations:['서울','수원','천안'],reason:'서울-수원, 수원-오산, 오산-평택, 평택-천안은 노선 엔티티의 실제 승강장 인접 선로 ID 사이에서 명시적 연결 경로가 확인되지 않음'},{stations:['평택','천안'],reason:'이전 시범 경로는 노선 엔티티의 실제 선로 ID가 아니라 역 주변의 일반 연결요소를 사용했으므로 검증 완료 판정을 철회함'}],pilotCandidate:{stations:[candidate.from,candidate.to],reason:'게임 노선 엔티티의 역 순서와 선로 ID, 명시적 참조 간선으로 연속 경로를 찾았지만 시작부에 선택 근거가 없는 분기 노드가 하나 있어 보류함'},segments:[{id:segmentId,fromStationId:candidate.fromStationId,toStationId:candidate.toStationId,geometry:{type:'LineString',coordinates:candidate.geometry},sourceVersion,verificationMethod:'game-route',verificationStatus:'pending',trackVariantId:`line:${analysis.line.entityId}`,originalTrackIds:candidate.trackPointIds}],trainRoutes:[],candidateTrainRoutes,validation:{coordinateCount:candidate.geometry.length,lengthKm:candidate.lengthKm,directDistanceKm:candidate.directDistanceKm,lengthRatio:candidate.lengthRatio,startOffsetMeters:0,endOffsetMeters:0,branchNodeCount:candidate.branchNodeCount,discontinuityCount:0,maxDistanceFromOriginalMeters:0,affectedServiceCount:candidateTrainRoutes.length,verifiedReusableServiceCount:0}};
const output=path.join(appRoot,'data/pilots/verified-route-pilot.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');console.log(`시범 후보 생성: 신탄진-회덕 ${candidate.geometry.length}개 원본 좌표, 분기 ${candidate.branchNodeCount}개, 검증 재사용 0개`);
