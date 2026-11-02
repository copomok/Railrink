export function orderedTicketGroup(tickets,ticket){
 const items=ticket?.groupId?tickets.filter(item=>item.groupId===ticket.groupId):ticket?[ticket]:[];
 return items.sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));
}

export function isSameTrainSeatJourney(items){
 if(!Array.isArray(items)||items.length<2)return false;
 const first=items[0];
 const serviceDay=first.serviceDate||first.travelDate;
 return items.every((item,index)=>item.groupType==='mixed'&&item.key===first.key&&(item.serviceDate||item.travelDate)===serviceDay&&(index===0||items[index-1].toStn===item.fromStn));
}

export function combinedTicket(items){
 const ordered=[...items].sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure)),first=ordered[0],last=ordered.at(-1);
 if(!first)return null;
 return {...first,toStn:last.toStn,toStationId:last.toStationId,arr:last.arr,arrival:last.arrival,totalFare:ordered.reduce((sum,item)=>sum+(+item.totalFare||0),0),seatSegments:ordered};
}

export function logicalTicketCount(tickets){
 const seen=new Set();let count=0;
 for(const ticket of tickets){const key=ticket.groupType==='mixed'&&ticket.groupId?ticket.groupId:ticket.id;if(seen.has(key))continue;seen.add(key);count++;}
 return count;
}
