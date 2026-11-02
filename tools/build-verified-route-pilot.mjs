import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {runtimeSource,sourceRoot,appRoot} from './source.mjs';

const analysis=JSON.parse(fs.readFileSync(path.join(sourceRoot,'data/nimbi_route_pilot_analysis.json'),'utf8'));
const variant=analysis.routeVariants.find(item=>item.lineEntityId===analysis.line.entityId&&item.pair.from==='남안양'&&item.pair.to==='수원'),candidate=variant?.pair,depotConnector=analysis.depotConnectorCandidate;
if(candidate?.status!=='verified')throw new Error('예상한 무궁화호 선로 변형을 찾지 못했습니다.');
const context={console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},localStorage:{getItem:()=>null}};
context.window=context;vm.createContext(context);vm.runInContext(runtimeSource(),context);
const sourceVersion=analysis.source.sha256;
const candidateTrainRoutes=context.RailData.trains.flatMap(train=>{
 const names=train.stops.map(stop=>String(stop.s).replace(/역$/,''));
 const from=names.indexOf('남안양'),to=names.indexOf('수원');
 if(train.grade!=='무궁화호'||from<0||to<0||Math.abs(from-to)!==1)return [];
 return [{trainServiceId:`${train.grade}:${train.no}:${train.line}`,segmentIds:['pilot:gyeongbu:namanyang-suwon'],direction:from<to?'forward':'reverse',sourceVersion,verificationStatus:'partial'}];
});
const segmentId='pilot:gyeongbu:namanyang-suwon';
const payload={schemaVersion:4,purpose:'development-pilot-only',source:{...analysis.source,dataFormat:'nimbyrails5-line-entity-and-explicit-track-reference-graph'},displayPolicy:analysis.topologyClassification.policy,lineEntity:{entityId:analysis.line.entityId,name:analysis.line.name,code:analysis.line.code,stationCount:analysis.line.route.length},rejectedCandidates:[{stations:['서울','수원','천안'],reason:'서울-남안양과 수원-천안의 여러 구간은 노선 엔티티의 실제 선로 ID 사이에서 명시적 연결 경로가 확인되지 않음'},{stations:['평택','천안'],reason:'이전 시범 경로는 노선 엔티티의 실제 선로 ID가 아니라 역 주변의 일반 연결요소를 사용했으므로 검증 완료 판정을 철회함'},{stations:['남금호','서울'],reason:'게임 노선 엔티티의 선로 ID 사이 경로가 확인되지 않아 기존 일반 그래프가 선택한 전철 선형을 거부함'}],pilot:{stations:[candidate.from,candidate.to],grade:'무궁화호',reason:'무궁화호 노선 엔티티가 지정한 선로 ID 사이의 명시적 간선만 대표 본선으로 사용하며 ITX 계통에는 재사용하지 않음'},depotConnector:{stations:[depotConnector.from,depotConnector.to],status:depotConnector.status,reason:'본선 운행 시범이 아니라 회송·차량기지 연결선으로 분류'},segments:[{id:segmentId,fromStationId:candidate.fromStationId,toStationId:candidate.toStationId,geometry:{type:'LineString',coordinates:candidate.geometry},sourceVersion,verificationMethod:'game-route-grade-variant',verificationStatus:'verified',trackVariantId:`line:${analysis.line.entityId}:mugunghwa`,originalTrackIds:candidate.trackPointIds}],trainRoutes:candidateTrainRoutes,validation:{coordinateCount:candidate.geometry.length,lengthKm:candidate.lengthKm,directDistanceKm:candidate.directDistanceKm,lengthRatio:candidate.lengthRatio,startOffsetMeters:0,endOffsetMeters:0,branchNodeCount:candidate.branchNodeCount,branchNodesAllowedAsStationTrackDetail:true,discontinuityCount:0,maxDistanceFromOriginalMeters:0,reusedByServiceCount:candidateTrainRoutes.length,itxReuseCount:0}};
const output=path.join(appRoot,'data/pilots/verified-route-pilot.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');console.log(`등급별 시범 생성: 남안양-수원 무궁화호 ${candidate.geometry.length}개 원본 좌표, ${candidateTrainRoutes.length}개 운행 재사용, ITX 재사용 0개`);
