import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const appRoot = fileURLToPath(new URL('../', import.meta.url));
export const sourceRoot = path.resolve(process.env.RAIL_SOURCE || path.join(appRoot, '../NIMBYRAILTABLE'));
export function sharedFiles() {
  const html = fs.readFileSync(path.join(sourceRoot, 'index.html'), 'utf8');
  const features = new Set(['nimbi_demand.js', 'nimbi_booking_dynamics.js', 'nimbi_inventory.js', 'nimbi_delay.js', 'nimbi_congestion.js']);
  const files = [...html.matchAll(/<script\s+src="([^"?]+)(?:\?[^"]*)?"/g)].map(m => m[1])
    .filter(f => f.startsWith('data/') || f.startsWith('js/core/') || f === 'js/shared/nimbi_rail_domain.js' || features.has(path.basename(f)));
  if (!files.includes('js/shared/nimbi_rail_domain.js')) throw new Error('NIMBY Rail의 공통 도메인 모듈이 필요합니다. README의 연결 절차를 확인하세요.');
  if (files.some(f => !/^(data|js)\/[\w/.-]+\.js$/.test(f) || f.includes('..'))) throw new Error('Invalid shared file path');
  return files;
}
export function railDataSource(){return `window.RailData=Object.freeze({trains:ALL_TRAINS,grades:GL,colors:GRADE_COLORS,classes:SEAT_CLASSES,discounts:DISCOUNTS,stops:NIMBI_Demand.getStops,fare:calcFare,discount:applyDiscount,formation:getFormationType,cars:getCarComposition,classCars:getCarsForClass,seatId,inventory:getSeatInventoryState,forecast:_delayForecast,platform:_realPlatform,virtualSeats:generateVirtualBookings,bookedSeats:getBookedSeats,invalidate:invalidateCongestion,duration:durMin,coordinate:_stnCoord,isPass:isPassStop,distance:routeDistanceKm,stationDB:STATION_DB,setSimulation:enabled=>{_simDelayOn=!!enabled;},delayState:_simState,delayAt:_simDelayAtStop,delayPair:_simDelayPairAtStop});`;}
export function runtimeSource() {
  return 'window.NIMBI_DISABLE_WEATHER = true;\n' + sharedFiles().map(f => `\n// Source: NIMBYRAILTABLE/${f}\n${fs.readFileSync(path.join(sourceRoot, f), 'utf8')}\n;`).join('\n') + railDataSource();
}
export function tokenSource() {
  const original = fs.readFileSync(path.join(sourceRoot, 'assets/css/nimbi_rail.css'), 'utf8');
  const redesign = fs.readFileSync(path.join(sourceRoot, 'assets/css/nimbi_redesign.css'), 'utf8');
  return [original.match(/:root\s*\{[^}]+\}/)?.[0], redesign.match(/:root\s*\{[^}]+\}/)?.[0], redesign.match(/\[data-theme="dark"\]\s*\{[^}]+\}/)?.[0]].join('\n');
}

// Reuse the original route sheet styles, without importing unrelated global UI rules.
export function operationStyleSource() {
  const original=fs.readFileSync(path.join(sourceRoot,'assets/css/nimbi_rail.css'),'utf8');
  const redesign=fs.readFileSync(path.join(sourceRoot,'assets/css/nimbi_redesign.css'),'utf8');
  const base=original.match(/#book-route-detail-wrap\{[\s\S]*?(?=\n\.si-network-map-action)/)?.[0];
  const final=redesign.match(/\/\* 운행 정보 헤더는[\s\S]*?(?=\/\* 승차권은)/)?.[0];
  if(!base||!final)throw new Error('원본 운행 정보 스타일 구간을 찾을 수 없습니다. 공통 UI 연결을 확인하세요.');
  return '/* Source: NIMBYRAILTABLE route detail sheet */\n'+base.split('\n').filter(line=>!line.startsWith('.xfer-')).join('\n')+'\n'+final;
}
