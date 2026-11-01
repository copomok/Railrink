import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryPresentation} from '../js/inventory-queue.js';

test('inventory presentation exposes the five requested occupancy states',()=>{
 assert.deepEqual(inventoryPresentation({eligible:true,available:20,booked:10,capacity:100}),{label:'여유',tone:'relaxed',soldOut:false});
 assert.deepEqual(inventoryPresentation({eligible:true,available:20,booked:60,capacity:100}),{label:'일반',tone:'normal',soldOut:false});
 assert.deepEqual(inventoryPresentation({eligible:true,available:20,booked:90,capacity:100}),{label:'혼잡',tone:'crowded',soldOut:false});
 assert.deepEqual(inventoryPresentation({eligible:true,available:20,booked:0,capacity:20},1,{standing:true}),{label:'입석',tone:'standing',soldOut:false});
 assert.deepEqual(inventoryPresentation({eligible:true,available:0,booked:100,capacity:100}),{label:'매진',tone:'soldout',soldOut:true});
 assert.equal(inventoryPresentation({eligible:true,available:0,booked:100,capacity:100},1,{standingAvailable:true}).label,'입석');
});
