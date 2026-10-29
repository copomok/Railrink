import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyState,upcomingJourneys,matchesStation} from '../js/journey.js';
const overnight={id:'night',status:'active',departure:'2026-10-29T14:50:00Z',dep:'23:50',arr:'0:20'};
test('overnight journeys remain active until arrival, including exact boundaries',()=>{
 for(const [now,phase] of [['2026-10-29T14:39:00Z','upcoming'],['2026-10-29T14:40:00Z','boarding'],['2026-10-29T14:50:00Z','riding'],['2026-10-29T15:15:00Z','arriving'],['2026-10-29T15:20:00Z','completed']]){
  assert.equal(journeyState(overnight,new Date(now)).phase,phase);
 }
 assert.equal(journeyState(overnight,new Date('2026-10-29T15:01:00Z')).untilArrival,19);
 assert.equal(new Date(journeyState(overnight).arrival).toISOString(),'2026-10-29T15:20:00.000Z');
});
test('in-progress journeys take precedence over future bookings and omit cancelled/history',()=>{
 const future={...overnight,id:'future',departure:'2026-10-30T14:50:00Z'};
 const cancelled={...overnight,id:'cancelled',status:'cancelled'};
 const history={...overnight,id:'history',departure:'2026-10-28T14:50:00Z'};
 assert.deepEqual(upcomingJourneys([future,cancelled,history,overnight],new Date('2026-10-29T15:00:00Z')).map(j=>j.ticket.id),['night','future']);
 assert.equal(journeyState({...overnight,departure:'broken'}).eligible,false);
 assert.equal(journeyState({...overnight,arr:'24:70'}).phase,'unknown');
});
test('station search accepts Korean, partial names, initials and normalized whitespace',()=>{
 for(const query of ['서울','ㅅㅇ','ㅅ','서 울','서울'])assert.equal(matchesStation('서울',query),true);
 assert.equal(matchesStation('청량리','ㅊㄹㄹ'),true);
 assert.equal(matchesStation('서울','부산'),false);
});
