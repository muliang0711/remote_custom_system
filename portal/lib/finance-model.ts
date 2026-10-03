import type {LiveState} from './live-store';
import {isTrialShift,financeRows,payrollRows,validMonday,minutes,type Shift} from './roster-model';
import {dayAdd,localClock} from './timetable-model';
import {financeCSV,payrollCSV,rosterCSV,printableRoster} from './roster-reports';
import {overtimeByShift,floorOvertimeLimits} from './floor-planning';
import {payRateVersion} from './pay-rates';
export type FinanceRecord={id:string;through?:string;reason?:string;weekStart:string;weekEnd:string;month:string;version:number;createdAt:string;createdBy:string;early:boolean;sourceRevision:number;sourceKey:string;rateEffectiveFrom:string;overtimeShiftIds?:string[];rows:ReturnType<typeof financeRows>;details:ReturnType<typeof payrollRows>;exports:{finance:string;payroll:string;roster:string;print:string}};
export function financeSourceKey(s:LiveState,week:string){return JSON.stringify({roster:s.rosters?.find(w=>w.weekStart===week),pay:payrollRows(s,week),rules:s.businessRules,rate:payRateVersion});}
export function latestFinance(s:LiveState,week:string){return (s.financeRecords||[]).filter(r=>r.weekStart===week).sort((a,b)=>b.version-a.version)[0];}
export function checkoutWeek(s:LiveState,input:{week:string;revision:number;previousId:string;confirmEarly:boolean;confirmReplace:boolean;through?:string;reason?:string},actor:string,id:string,now=new Date()){
 if(!validMonday(input.week))throw Error('Choose a valid Monday.');
 const roster=s.rosters?.find(w=>w.weekStart===input.week);
 const through=input.through||dayAdd(input.week,6);
 if(!Array.from({length:7},(_,i)=>dayAdd(input.week,i)).includes(through))throw Error('Checkout end date must be within the selected week.');
 const previous=latestFinance(s,input.week);
 if(previous&&through<(previous.through||previous.weekEnd))throw Error('A new checkout must include all previously submitted dates.');
 if(!roster||(!previous&&!payrollRows(s,input.week).filter(p=>p.shift.date<=through).length))throw Error('Assign employee shifts before checkout. Candidate trials are excluded.');
 if(roster.revision!==input.revision)throw Error('The timetable changed. Reload and review before checkout.');
 const early=localClock(now,'Etc/GMT-10').date<=dayAdd(input.week,6);
 if(early&&!input.confirmEarly)throw Error('This week has not ended (UTC+10). Confirm early checkout.');
 // Checkout approves the current timetable as worked hours; stage changes until all checks pass.
 const confirmed=roster.shifts.map(sh=>{
  if(sh.date>through||isTrialShift(sh)||sh.employee.type==='Candidate')return sh;
  if(!Number.isFinite(minutes(sh.start))||!Number.isFinite(minutes(sh.end))||minutes(sh.end)<=minutes(sh.start)||!Number.isFinite(sh.breakMinutes)||sh.breakMinutes<0||sh.breakMinutes>=minutes(sh.end)-minutes(sh.start))throw Error('Correct invalid shift hours or unpaid breaks before checkout.');
  if(sh.actual&&sh.actual.start===sh.start&&sh.actual.end===sh.end&&sh.actual.breakMinutes===sh.breakMinutes)return sh;
  const actual:Shift['actual']={start:sh.start,end:sh.end,breakMinutes:sh.breakMinutes,employeeType:sh.actual?.employeeType||sh.employee.type,confirmedAt:now.toISOString()};
  return {...sh,actual,updated:now.toISOString()};
 });
 const changed=confirmed.some((sh,i)=>sh!==roster.shifts[i]);
 const approvedRoster={...roster,shifts:confirmed,revision:roster.revision+(changed?1:0),updated:changed?now.toISOString():roster.updated};
 const scoped:LiveState={...s,rosters:s.rosters?.map(w=>w.weekStart===input.week?{...approvedRoster,shifts:confirmed.filter(sh=>sh.date<=through)}:w)};
 const sourceKey=JSON.stringify({through,key:financeSourceKey(scoped,input.week)});
 if(previous?.sourceKey===sourceKey)return previous;
 if((previous?.id||'')!==input.previousId)throw Error('Finance was updated elsewhere. Reload before checkout.');
 if(previous&&!input.confirmReplace)throw Error('Confirm creating a new version of this week.');
 if(previous&&(!input.reason?.trim()||input.reason.length>1000))throw Error('Enter a reason for the revised checkout (up to 1,000 characters).');
 const record:FinanceRecord=structuredClone({id,through,reason:input.reason?.trim()||'',weekStart:input.week,weekEnd:dayAdd(input.week,6),month:dayAdd(input.week,6).slice(0,7),version:(previous?.version||0)+1,createdAt:now.toISOString(),createdBy:actor,early,sourceRevision:approvedRoster.revision,sourceKey,rateEffectiveFrom:payRateVersion.effectiveFrom,overtimeShiftIds:[...overtimeByShift(roster.shifts,floorOvertimeLimits)].filter(([,v])=>v.minutes>0).map(([id])=>id),rows:financeRows(scoped,input.week),details:payrollRows(scoped,input.week),exports:{finance:financeCSV(scoped,input.week).replaceAll('Recalculated from current profiles','Frozen at checkout from employee profiles'),payroll:payrollCSV(scoped,input.week).replaceAll('Current employee profile','Employee profile frozen at checkout'),roster:rosterCSV(scoped,input.week),print:printableRoster(scoped,input.week)}});
 const savedShifts=roster.shifts;confirmed.forEach((sh,i)=>Object.assign(savedShifts[i],sh));Object.assign(roster,{...approvedRoster,shifts:savedShifts});(s.financeRecords??=[]).push(record);return record;
}
