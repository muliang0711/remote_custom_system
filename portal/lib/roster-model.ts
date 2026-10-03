import type {Restaurant,TimetableCategory} from './shift-templates';
import type {LiveState} from './live-store';
import {profileAge,employeeLevel,type OfficialEmployee} from './employee-model';
import {hourlyRateCents,payRateVersion,type PayAgeGroup,type PayDayType} from './pay-rates';
import {leaveForHours} from './business-rules';
export type TimeRange={start:string;end:string};
export type Shift=TimeRange&{floorRole?:'full'|'early'|'late';autoFloorRole?:'full'|'early'|'late';candidateId?:string;restaurant?:Restaurant;category?:TimetableCategory;templateId?:string;breakStart?:string;breakEnd?:string;id:string;employeeId:string;date:string;breakMinutes:number;notes:string;employee:Pick<OfficialEmployee,'name'|'email'|'phone'|'position'|'casualLevel'|'hourlyRate'|'currency'>&{type:OfficialEmployee['type']|'Candidate'};actual?:TimeRange&{employeeType?:OfficialEmployee['type'];breakMinutes:number;confirmedAt:string};created:string;updated:string;ruleVersion:1};
export const isTrialShift=(shift:Shift)=>shift.category==='Trial'||!!shift.candidateId||shift.employee.type==='Candidate';
export type ManualAvailability=TimeRange&{id:string;employeeId:string;date:string;note:string;confirmedAt:string};
export type RosterWeek={floorPlan?:{crossShopEmployeeIds?:string[];teams:Record<Restaurant,string[]>;closedDates:Record<Restaurant,string[]>;generatedAt:string;missing:{restaurant:Restaurant;date:string;role:string;reason:string}[]};publicHolidays?:string[];autoAllocatedDates?:string[];weekStart:string;revision:number;shifts:Shift[];manualAvailability:ManualAvailability[];updated:string};
export const minutes=(time:string)=>{if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)&&time!=='24:00')return NaN;const [h,m]=time.split(':').map(Number);return h*60+m;};
export function netMinutes(range:TimeRange&{breakMinutes:number}){return minutes(range.end)-minutes(range.start)-range.breakMinutes;}
export function validMonday(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date&&new Date(date+'T00:00:00Z').getUTCDay()===1;}
export function availabilityRanges(s:LiveState,weekStart:string,employeeId:string,date:string,restaurant?:Restaurant):TimeRange[]{const roster=s.rosters?.find(w=>w.weekStart===weekStart),manual=roster?.manualAvailability.filter(a=>a.employeeId===employeeId&&a.date===date)||[];const batches=s.timetable?.weeks.filter(w=>w.weekStart===weekStart&&w.employeeIds.includes(employeeId)&&(!restaurant||!w.group||!s.timetable?.groups?.[w.group]?.restaurant||s.timetable.groups[w.group]?.restaurant===restaurant))||[];const batch=batches.find(w=>w.group)||batches[0];const reply=batch?.responses.find(r=>r.employeeId===employeeId);const hours=reply?.hours[date]||[];const label=(h:number)=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round(h%1*60)).padStart(2,'0')}`;const step=(batch?.settings.slotMinutes||60)/60;return [...hours.map(h=>({start:label(h),end:label(h+step)})),...manual];}
export function isAvailable(s:LiveState,weekStart:string,employeeId:string,date:string,range:TimeRange,restaurant?:Restaurant){let covered=minutes(range.start);const end=minutes(range.end);if(!Number.isFinite(covered)||!Number.isFinite(end)||end<=covered)return false;const ranges=availabilityRanges(s,weekStart,employeeId,date,restaurant).map(r=>[minutes(r.start),minutes(r.end)]).sort((a,b)=>a[0]-b[0]);for(const [start,finish] of ranges){if(finish<=covered)continue;if(start>covered)break;covered=finish;if(covered>=end)return true;}return false;}
export function isShiftAvailable(s:LiveState,week:string,id:string,date:string,shift:TimeRange&{breakStart?:string;breakEnd?:string;restaurant?:Restaurant}){
 if(shift.breakStart&&shift.breakEnd)return isAvailable(s,week,id,date,{start:shift.start,end:shift.breakStart},shift.restaurant)&&isAvailable(s,week,id,date,{start:shift.breakEnd,end:shift.end},shift.restaurant);
 return isAvailable(s,week,id,date,shift,shift.restaurant);
}
export function overlap(a:TimeRange,b:TimeRange){return minutes(a.start)<minutes(b.end)&&minutes(b.start)<minutes(a.end);}
// Both the preview and exports use this calculation. Old hand-entered rates are never used.
// These are recalculable estimates from current employee profiles, not locked payroll records.
export function payrollRows(s:LiveState,weekStart:string){
 const week=s.rosters?.find(w=>w.weekStart===weekStart);
 return (week?.shifts||[]).filter(sh=>!isTrialShift(sh)).map(shift=>{
  const employee=s.employees?.find(e=>e.id===shift.employeeId);
  const age=profileAge(employee,shift.date);
  const level=employee?employeeLevel(employee):undefined;
  const ageGroup:PayAgeGroup|undefined=age===undefined?undefined:age<17?'Under 17':age>=20?'20+':String(age) as PayAgeGroup;
  const weekday=new Date(shift.date+'T00:00:00Z').getUTCDay();
  const dayType:PayDayType=week?.publicHolidays?.includes(shift.date)?'Public Holiday':weekday===6?'Saturday':weekday===0?'Sunday':'Weekday';
  const issues:string[]=[];
  if(!employee)issues.push('Employee profile missing');
  if(age===undefined)issues.push('Date of birth or manual age required');
  if(!level||![1,2,3].includes(level))issues.push('Employee Level required');
  if(employee&&!['Full-Time','Part-Time','Casual'].includes(employee.type))issues.push('Employee type required');
  if(shift.date<payRateVersion.effectiveFrom)issues.push('No rate table before '+payRateVersion.effectiveFrom);
  const scheduledMinutes=netMinutes(shift),actualMinutes=shift.actual?netMinutes(shift.actual):0;
  if(!Number.isInteger(scheduledMinutes)||scheduledMinutes<=0||shift.actual&&(!Number.isInteger(actualMinutes)||actualMinutes<=0))issues.push('Invalid working hours');
  const rateCents=issues.length||!employee||!level||!ageGroup?null:hourlyRateCents(employee.type==='Casual'?'Casual':'Full-time/Part-time',level,ageGroup,dayType);
  return {shift,employee,age,ageGroup,level,dayType,issues,rateCents,scheduledMinutes,actualMinutes,
   estimatedCents:rateCents===null?null:Math.round(scheduledMinutes*rateCents/60),
   actualCents:!shift.actual||rateCents===null?null:Math.round(actualMinutes*rateCents/60)};
 });
}
export function payrollStatus(issues:string[]){
 if(issues.includes('Employee profile missing'))return {label:'Employee profile missing',action:'Review employee directory',target:'directory' as const};
 if(issues.includes('Date of birth or manual age required'))return {label:'Employee age required',action:'Add date of birth or age',target:'profile' as const};
 if(issues.includes('Employee type required')||issues.includes('Employee Level required'))return {label:'Employee type / Level required',action:'Complete employee profile',target:'profile' as const};
 if(issues.some(i=>i.startsWith('No rate table before')))return {label:'Rate table unavailable for shift date',action:'View Pay Rate Table',target:'rates' as const};
 if(issues.length)return {label:'Working hours need review',action:'Review shifts',target:'shifts' as const};
 return {label:'Calculated automatically',action:'Estimate ready',target:'ready' as const};
}
export function financeRows(s:LiveState,weekStart:string){
 const rows=new Map<string,{restaurant:string;category:string;employeeId:string;name:string;email:string;phone:string;position:string;type:string;currency:string;rates:Set<number>;issues:Set<string>;scheduledMinutes:number;actualMinutes:number;unconfirmed:number;missingScheduledRate:number;missingActualRate:number;estimated:number;actualPay:number;annual:number;personal:number;sample:boolean}>();
 for(const pay of payrollRows(s,weekStart)){
  const {shift}=pay,e=pay.employee||shift.employee;
  const type=`${e.type} · Level ${pay.level??'?'}`,currency='AUD';
  const restaurant=shift.restaurant||'Unclassified',category=shift.category||'Unclassified';
  const key=[shift.employeeId,type,currency,restaurant,category].join('|');
  let row=rows.get(key);
  if(!row){row={restaurant,category,employeeId:shift.employeeId,name:e.name,email:e.email,phone:e.phone,position:e.position,type,currency,rates:new Set(),issues:new Set(),scheduledMinutes:0,actualMinutes:0,unconfirmed:0,missingScheduledRate:0,missingActualRate:0,estimated:0,actualPay:0,annual:0,personal:0,sample:/\.(example|invalid)$/i.test(e.email)};rows.set(key,row)}
  pay.issues.forEach(issue=>row!.issues.add(issue));
  row.scheduledMinutes+=pay.scheduledMinutes;
  if(pay.estimatedCents===null)row.missingScheduledRate++;else row.estimated+=pay.estimatedCents;
  if(pay.rateCents!==null)row.rates.add(pay.rateCents/100);
  if(shift.actual){
   row.actualMinutes+=pay.actualMinutes;
   if(pay.actualCents===null)row.missingActualRate++;else row.actualPay+=pay.actualCents;
   const leave=leaveForHours(pay.actualMinutes/60,shift.actual.employeeType||shift.employee.type,s.businessRules||[]);row.annual+=leave.annual;row.personal+=leave.personal;
  }else row.unconfirmed++;
 }
 return [...rows.values()].map(r=>({...r,rates:[...r.rates].sort((a,b)=>a-b),issues:[...r.issues],status:payrollStatus([...r.issues]),estimated:r.missingScheduledRate?null:r.estimated/100,actualPay:r.missingActualRate?null:r.actualPay/100}));
}

// Coalesce adjacent answers, then subtract assigned shifts so a click suggests only free time.
export function openAvailability(s:LiveState,weekStart:string,employeeId:string,date:string):TimeRange[]{const source=availabilityRanges(s,weekStart,employeeId,date).map(r=>[minutes(r.start),minutes(r.end)]).filter(([a,b])=>Number.isFinite(a)&&b>a).sort((a,b)=>a[0]-b[0]);const merged:number[][]=[];for(const [a,b] of source){const last=merged.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else merged.push([a,b]);}let free=merged;for(const shift of s.rosters?.find(w=>w.weekStart===weekStart)?.shifts.filter(sh=>sh.employeeId===employeeId&&sh.date===date)||[]){const a=minutes(shift.start),b=minutes(shift.end);free=free.flatMap(([x,y])=>a>=y||b<=x?[[x,y]]:[[x,Math.min(a,y)],[Math.max(b,x),y]].filter(([l,r])=>r>l));}const label=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;return free.map(([a,b])=>({start:label(a),end:label(b)}));}

export function filterRoster(s:LiveState,category='all',restaurant='all'):LiveState{return {...s,rosters:s.rosters?.map(w=>({...w,shifts:w.shifts.filter(sh=>(category==='all'||(sh.category||'Unclassified')===category)&&(restaurant==='all'||(sh.restaurant||'Unclassified')===restaurant))}))};}
