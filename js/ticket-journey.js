const byDeparture=(a,b)=>Date.parse(a.departure)-Date.parse(b.departure);
const segmentFields=['key','trainNo','grade','fromStn','toStn','travelDate','serviceDate','seatClass','seats','passengerCount','discount','discounts','totalFare','baseFare','fromStationId','toStationId','trainId','departureServiceMinutes','arrivalServiceMinutes','departure','arrival','dep','arr'];

export function ticketSeatSegment(ticket){
 const segment={};
 for(const field of segmentFields)if(ticket[field]!==undefined)segment[field]=Array.isArray(ticket[field])?[...ticket[field]]:ticket[field];
 return segment;
}

export function seatSegments(value){
 const items=(Array.isArray(value)?value:[value]).filter(Boolean).sort(byDeparture);
 if(items.length===1&&Array.isArray(items[0].seatSegments))return [...items[0].seatSegments].sort(byDeparture);
 return items;
}

export function orderedTicketGroup(tickets,ticket){
 const items=ticket?.groupId?tickets.filter(item=>item.groupId===ticket.groupId):ticket?[ticket]:[];
 return items.sort(byDeparture);
}

export function isSameTrainSeatJourney(items){
 if(!Array.isArray(items)||!items.length)return false;
 const ticket=items[0],segments=seatSegments(items),first=segments[0],serviceDay=first?.serviceDate||first?.travelDate;
 if(ticket.groupType!=='mixed'||segments.length<2)return false;
 return segments.every((item,index)=>item.key===first.key&&(item.serviceDate||item.travelDate)===serviceDay&&(index===0||segments[index-1].toStn===item.fromStn));
}

export function combinedTicket(items){
 const ordered=[...items].sort(byDeparture),first=ordered[0],segments=seatSegments(ordered),last=segments.at(-1);
 if(!first||!last)return null;
 if(ordered.length===1&&Array.isArray(first.seatSegments))return first;
 const {groupId:discardId,groupSequence:discardSequence,groupTotal:discardTotal,...base}=first;
 return {...base,groupType:'mixed',sameTrain:true,toStn:last.toStn,toStationId:last.toStationId,arr:last.arr,arrival:last.arrival,totalFare:segments.reduce((sum,item)=>sum+(+item.totalFare||0),0),baseFare:segments.reduce((sum,item)=>sum+(+item.baseFare||0),0),seatSegments:segments.map(ticketSeatSegment)};
}

// Older versions stored one record for every seat-use section. Collapse them
// when reading so every feature now works with one train and one ticket record.
export function normalizeMixedTickets(tickets){
 if(!Array.isArray(tickets))return {tickets,changed:false};
 const legacy=new Map();
 for(const ticket of tickets)if(ticket.groupType==='mixed'&&ticket.groupId){if(!legacy.has(ticket.groupId))legacy.set(ticket.groupId,[]);legacy.get(ticket.groupId).push(ticket);}
 if(!legacy.size)return {tickets,changed:false};
 const emitted=new Set(),result=[];let changed=false;
 for(const ticket of tickets){
  if(ticket.groupType!=='mixed'||!ticket.groupId){result.push(ticket);continue;}
  if(emitted.has(ticket.groupId))continue;
  emitted.add(ticket.groupId);const group=legacy.get(ticket.groupId).sort(byDeparture);
  if(isSameTrainSeatJourney(group)){result.push(combinedTicket(group));changed=true;}else result.push(...group);
 }
 return {tickets:result,changed};
}

export function logicalTicketCount(tickets){return normalizeMixedTickets(tickets).tickets.length;}
