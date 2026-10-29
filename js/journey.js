// Timetable-derived journey state, never a live railway position feed.
export function minutes(clock) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(String(clock));
  if (!match || +match[1] > 23) return null;
  return +match[1] * 60 + +match[2];
}
export function journeyState(ticket, now = new Date()) {
  if (ticket.status !== 'active') return {phase: ticket.status, label: ticket.status === 'cancelled' ? '취소됨' : '변경됨', eligible: false};
  const dep = Date.parse(ticket.departure), start = minutes(ticket.dep), end = minutes(ticket.arr);
  if (!Number.isFinite(dep) || start === null || end === null) return {phase:'unknown',label:'시간 확인 필요',eligible:false};
  const arrival = dep + ((end - start + 1440) % 1440) * 60000;
  const untilDeparture = Math.ceil((dep - now.getTime()) / 60000);
  const untilArrival = Math.ceil((arrival - now.getTime()) / 60000);
  const phase = now.getTime() >= arrival ? 'completed' : untilDeparture > 10 ? 'upcoming' : untilDeparture > 0 ? 'boarding' : untilArrival <= 5 ? 'arriving' : 'riding';
  const label = {upcoming:'이용 예정',boarding:'승차 준비',riding:'탑승 중',arriving:'도착 준비',completed:'이용 완료'}[phase];
  return {phase,label,departure:dep,arrival,untilDeparture,untilArrival,eligible:phase !== 'completed'};
}
export function upcomingJourneys(tickets, now = new Date()) {
  const rank = {riding:0,arriving:0,boarding:1,upcoming:2};
  return tickets.map(ticket=>({ticket,state:journeyState(ticket,now)})).filter(item=>item.state.eligible)
    .sort((a,b)=>rank[a.state.phase]-rank[b.state.phase] || a.state.departure-b.state.departure);
}
export function matchesStation(name, query) {
  const normalize = value => value.normalize('NFC').replace(/\s/g,'').toLocaleLowerCase();
  const initials = [...name].map(c=>{const code=c.charCodeAt(0)-0xac00;return code>=0&&code<11172?'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(code/588)]:c;}).join('');
  return normalize(name).includes(normalize(query)) || normalize(initials).includes(normalize(query));
}
