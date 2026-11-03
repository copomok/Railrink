import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('a deployed map release replaces the active offline shell automatically',()=>{
 const worker=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const client=fs.readFileSync(new URL('../js/pwa.js',import.meta.url),'utf8');
 assert.match(worker,/addAll\(SHELL\)\)\.then\(\(\)=>self\.skipWaiting\(\)\)/);
 assert.match(client,/registration\.waiting\?\.postMessage\(\{type:'activate-update'\}\)/);
 assert.match(client,/controllerchange[\s\S]*location\.reload\(\)/);
 assert.doesNotMatch(client,/예매를 마친 뒤 업데이트하세요/);
});
