import test from 'node:test';
import assert from 'node:assert/strict';
import {createSettingsStore,defaultSettings,queryFromSettings,currentKstClock,formatClock,seatOptions,SETTINGS_KEY} from '../js/settings.js';

const model={stationRecords:[{id:'nimby:1',name:'서울'},{id:'nimby:2',name:'부산'}],data:{classes:{general:{},special:{},standing:{}}}};
const memoryStorage=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};

test('settings persist with station IDs and create a search query from current KST time',()=>{
 const storage=memoryStorage(),store=createSettingsStore({model,storage}),value=store.get();
 value.search.fromStationId='nimby:1';value.search.toStationId='nimby:2';value.search.pax=3;value.search.family='ktx';value.transfer.minWait=20;value.seat.position='window';store.save(value);
 const restored=createSettingsStore({model,storage}).get();assert.equal(restored.search.fromStationId,'nimby:1');assert.equal(restored.search.pax,3);
 const now=new Date('2026-11-01T06:17:00Z'),query=queryFromSettings(restored,model,'2026-11-01',now);assert.equal(query.from,'서울');assert.equal(query.to,'부산');assert.equal(query.after,'15:17');assert.equal(query.minWait,20);assert.equal(query.family,'ktx');assert.equal(seatOptions(restored).position,'window');
});

test('corrupt and stale settings recover without accepting invalid station IDs',()=>{
 const storage=memoryStorage();storage.values.set(SETTINGS_KEY,'broken');let store=createSettingsStore({model,storage});assert.equal(store.recovered,true);assert.deepEqual(store.get(),defaultSettings());
 storage.values.set(SETTINGS_KEY,JSON.stringify({version:1,search:{fromStationId:'removed',pax:99},appearance:{theme:'unknown'}}));store=createSettingsStore({model,storage});const value=store.get();assert.equal(value.search.fromStationId,'');assert.equal(value.search.pax,1);assert.equal(value.appearance.theme,'light');
});

test('storage failures are reported and time formatting is display-only',()=>{
 const storage={getItem:()=>null,setItem(){const error=Error('full');error.name='QuotaExceededError';throw error;}};const store=createSettingsStore({model,storage});assert.throws(()=>store.save(store.get()),/공간/);
 assert.equal(currentKstClock(new Date('2026-11-01T15:05:00Z')),'00:05');assert.equal(formatClock('16:25','12'),'오후 4:25');assert.equal(formatClock('00:05','12'),'오전 12:05');assert.equal(formatClock('16:25','24'),'16:25');assert.equal(store.get().appearance.dateFormat,'korean');
});
