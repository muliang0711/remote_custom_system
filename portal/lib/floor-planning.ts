import type {EmployeeType} from './employee-model';
import type {Restaurant} from './shift-templates';
import {isTrialShift,minutes,netMinutes,type Shift} from './roster-model';

// Scheduling thresholds are owner-supplied settings, not hard-coded award rules.
export type OvertimeLimits=Record<EmployeeType,{dailyHours:number;weeklyHours:number}>;
export function validateOvertimeLimits(limits:OvertimeLimits){
 for(const type of ['Full-Time','Part-Time','Casual'] as const){
  const limit=limits?.[type];
  if(!limit||!Number.isFinite(limit.dailyHours)||limit.dailyHours<=0||limit.dailyHours>24||!Number.isFinite(limit.weeklyHours)||limit.weeklyHours<=0||limit.weeklyHours>168)throw Error(`Set valid daily and weekly working-hour limits for ${type}.`);
 }
}
export function overtimeByShift(shifts:Shift[],limits:OvertimeLimits){
 validateOvertimeLimits(limits);
 const daily=new Map<string,number>(),weekly=new Map<string,number>();
 const result=new Map<string,{dailyMinutes:number;weeklyMinutes:number;minutes:number}>();
 for(const shift of [...shifts].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.id.localeCompare(b.id))){
  if(isTrialShift(shift)||shift.employee.type==='Candidate')continue;
  const duration=netMinutes(shift);if(!Number.isFinite(duration)||duration<=0)continue;
  const limit=limits[shift.employee.type],key=shift.employeeId+'|'+shift.date;
  const previousDay=daily.get(key)||0,previousWeek=weekly.get(shift.employeeId)||0;
  const extra=(previous:number,cap:number)=>Math.max(0,previous+duration-cap)-Math.max(0,previous-cap);
  const dailyMinutes=extra(previousDay,limit.dailyHours*60),weeklyMinutes=extra(previousWeek,limit.weeklyHours*60);
  result.set(shift.id,{dailyMinutes,weeklyMinutes,minutes:Math.max(dailyMinutes,weeklyMinutes)});
  daily.set(key,previousDay+duration);weekly.set(shift.employeeId,previousWeek+duration);
 }
 return result;
}
export function floorCoverage(shifts:Shift[],restaurant:Restaurant,date:string,opening:string,closing:string){
 const start=minutes(opening),end=minutes(closing);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('Choose valid same-day opening hours.');
 const scheduled=shifts.filter(sh=>sh.restaurant===restaurant&&sh.category==='Floor'&&sh.date===date&&!sh.candidateId&&sh.employee.type!=='Candidate');
 // An unspecified break cannot be treated as confirmed coverage.
 const unknownBreaks=scheduled.filter(sh=>sh.breakMinutes>0&&(!sh.breakStart||!sh.breakEnd));
 const known=scheduled.filter(sh=>!unknownBreaks.includes(sh));
 const boundaries=[...new Set([start,end,...known.flatMap(sh=>[minutes(sh.start),minutes(sh.end),...(sh.breakStart&&sh.breakEnd?[minutes(sh.breakStart),minutes(sh.breakEnd)]:[])]).filter(n=>n>=start&&n<=end)])].sort((a,b)=>a-b);
 const gaps:{start:number;end:number;staff:number;missing:number}[]=[];
 for(let i=0;i<boundaries.length-1;i++){
  const from=boundaries[i],to=boundaries[i+1];
  const staff=new Set(known.filter(sh=>minutes(sh.start)<=from&&minutes(sh.end)>=to&&!(sh.breakStart&&sh.breakEnd&&minutes(sh.breakStart)<to&&minutes(sh.breakEnd)>from)).map(sh=>sh.employeeId)).size;
  if(staff>=2)continue;
  const last=gaps.at(-1);if(last&&last.end===from&&last.staff===staff)last.end=to;else gaps.push({start:from,end:to,staff,missing:2-staff});
 }
 return {gaps,unknownBreaks:unknownBreaks.map(sh=>sh.id),missingStaffMinutes:gaps.reduce((n,g)=>n+(g.end-g.start)*g.missing,0)};
}

export const floorOvertimeLimits:OvertimeLimits={
 'Full-Time':{dailyHours:11.5,weeklyHours:38},'Part-Time':{dailyHours:11.5,weeklyHours:38},Casual:{dailyHours:12,weeklyHours:38},
};
