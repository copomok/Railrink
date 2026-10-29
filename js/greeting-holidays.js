// Fixed solar holidays already registered in the canonical project's
// js/features/nimbi_delay.js::_simIsKoreanHoliday. Its lunar estimation is NOT used.
const SOLAR_HOLIDAYS=Object.freeze({
 '01-01':'신정','03-01':'삼일절','05-05':'어린이날','06-06':'현충일',
 '08-15':'광복절','10-03':'개천절','10-09':'한글날','12-25':'성탄절',
});
// Add reviewed Gregorian dates from an authoritative calendar here, never lunar
// calculations. Schema: {date, name, kind:'lunarNewYear'|'chuseok'|'other',
// period:boolean, source:URL, verifiedOn:'YYYY-MM-DD', verified:true}.
// Empty until a source has been verified; no inferred substitute/bridge holidays.
export const VERIFIED_GREETING_HOLIDAYS=Object.freeze([]);
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function createGreetingCalendar(records=VERIFIED_GREETING_HOLIDAYS){
 const dates=new Map(records.filter(r=>r.verified===true&&validDate(r.date)&&validDate(r.verifiedOn)&&typeof r.source==='string'&&r.source.trim()&&typeof r.name==='string'&&['lunarNewYear','chuseok','other'].includes(r.kind)).map(r=>[r.date,Object.freeze({...r})]));
 return date=>{
  if(!validDate(date))return null;
  const record=dates.get(date);if(record)return {isHoliday:true,kind:record.kind,period:record.period===true||['lunarNewYear','chuseok'].includes(record.kind),name:record.name};
  const name=SOLAR_HOLIDAYS[date.slice(5)];return name?{isHoliday:true,kind:'other',period:false,name}:null;
 };
}
export const greetingHolidayAt=createGreetingCalendar();
