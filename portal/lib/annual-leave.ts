import type {LiveState} from './live-store';
import {employeeToday} from './employee-model';
import {leaveForHours} from './business-rules';
import {netMinutes} from './roster-model';
export type AnnualLeaveEntry={id:string;kind:'opening'|'taken'|'adjustment';date:string;hours:number;reason:string;by:string;created:string};
export type LeaveType='annual'|'sick';
export function leaveBalance(s:LiveState,employeeId:string,leaveType:LeaveType,asOf=employeeToday()){
 const employee=s.employees?.find(e=>e.id===employeeId);
 const entries=((leaveType==='annual'?employee?.annualLeaveEntries:employee?.sickLeaveEntries)||[]).filter(e=>e.date<=asOf);
 const opening=entries.find(e=>e.kind==='opening');
 const movements=entries.filter(e=>e.kind!=='opening'&&(!opening||e.date>=opening.date));
 const shifts=(s.rosters||[]).flatMap(w=>w.shifts).filter(sh=>sh.employeeId===employeeId&&!sh.candidateId&&sh.employee.type!=='Candidate'&&sh.actual&&sh.date<=asOf&&(!opening||sh.date>=opening.date));
 const accruals=shifts.map(sh=>{
  const hours=netMinutes(sh.actual!)/60,type=sh.actual!.employeeType||sh.employee.type;
  const earned=leaveForHours(hours,type,s.businessRules||[]);
  return {id:sh.id,date:sh.date,weekStart:s.rosters!.find(w=>w.shifts.includes(sh))!.weekStart,hours,type,...earned,earned:leaveType==='annual'?earned.annual:earned.personal};
 });
 const accrued=accruals.reduce((n,a)=>n+a.earned,0),taken=movements.filter(e=>e.kind==='taken').reduce((n,e)=>n+e.hours,0),adjustments=movements.filter(e=>e.kind==='adjustment').reduce((n,e)=>n+e.hours,0);
 return {opening,accrued,taken,adjustments,remaining:(opening?.hours||0)+accrued-taken+adjustments,accruals,entries:[...entries].sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created))};
}

export function annualLeaveBalance(s:LiveState,employeeId:string,asOf=employeeToday()){return leaveBalance(s,employeeId,'annual',asOf)}
export function sickLeaveBalance(s:LiveState,employeeId:string,asOf=employeeToday()){return leaveBalance(s,employeeId,'sick',asOf)}
