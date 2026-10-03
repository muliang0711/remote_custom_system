import type {LiveState} from './live-store';
import {restaurants,type Restaurant} from './shift-templates';
import {dayAdd,localClock} from './timetable-model';
import {checkoutWeek,type FinanceRecord} from './finance-model';
import {isTrialShift} from './roster-model';
export const rosterMonth=(week:string)=>dayAdd(week,3).slice(0,7);
export function rosterMonthWeeks(month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Choose a valid month.');
 const first=month+'-01',weekday=new Date(first+'T00:00:00Z').getUTCDay();let monday=dayAdd(first,-((weekday+6)%7));const weeks:string[]=[];
 for(let i=0;i<6;i++,monday=dayAdd(monday,7))if(rosterMonth(monday)===month)weeks.push(monday);
 return weeks;
}
export type MonthCheckout={id:string;month:string;restaurant:Restaurant;version:number;createdAt:string;createdBy:string;reason:string;records:FinanceRecord[];weeks:string[]};
export function latestMonthCheckout(s:LiveState,month:string,restaurant:Restaurant){return s.financeMonthCheckouts?.filter(r=>r.month===month&&r.restaurant===restaurant).sort((a,b)=>b.version-a.version)[0];}
export function checkoutRosterMonth(s:LiveState,input:{month:string;restaurant:Restaurant;previousId:string;reason:string;confirm:boolean;holidays?:string[]},actor:string,id:string,now=new Date()){
 if(!restaurants.includes(input.restaurant))throw Error('Choose a shop.');
 const weeks=rosterMonthWeeks(input.month),end=dayAdd(weeks.at(-1)!,6);
 if(localClock(now,'Etc/GMT-10').date<=end)throw Error('Checkout opens after the final roster week ends on '+end+'.');
 if(!input.confirm)throw Error('Confirm the entire month’s timetable.');
 const previous=latestMonthCheckout(s,input.month,input.restaurant);
 if((previous?.id||'')!==input.previousId)throw Error('Monthly checkout changed. Reload.');
 if(previous&&(!input.reason.trim()||input.reason.length>1000))throw Error('Add a reason for the revised monthly checkout.');
 const staged=structuredClone(s);staged.financeRecords=[];
 if(input.holidays){const days=weeks.flatMap(w=>Array.from({length:7},(_,i)=>dayAdd(w,i)));if(input.holidays.some(d=>!days.includes(d)))throw Error('Public holidays must be within this roster month.');for(const w of staged.rosters||[])if(weeks.includes(w.weekStart))w.publicHolidays=[...new Set(input.holidays.filter(d=>d>=w.weekStart&&d<=dayAdd(w.weekStart,6)))];}
 staged.rosters=(staged.rosters||[]).filter(w=>weeks.includes(w.weekStart)).map(w=>({...w,shifts:w.shifts.filter(sh=>sh.restaurant===input.restaurant&&!isTrialShift(sh))}));
 const records:FinanceRecord[]=[];
 for(const w of staged.rosters){if(!w.shifts.length)continue;records.push(checkoutWeek(staged,{week:w.weekStart,revision:w.revision,previousId:'',confirmEarly:false,confirmReplace:false},actor,id+':'+w.weekStart,now));}
 if(!records.length)throw Error('No employee shifts in this shop for the selected roster month.');
 if(records.some(r=>r.details.some(p=>p.actualCents===null)))throw Error('Complete employee age, type and level, and resolve missing pay rates before checkout.');
 for(const record of records){record.month=input.month;record.version=(previous?.version||0)+1;record.reason=input.reason.trim();}
 const result:MonthCheckout={id,month:input.month,restaurant:input.restaurant,version:(previous?.version||0)+1,createdAt:now.toISOString(),createdBy:actor,reason:input.reason.trim(),records,weeks};
 for(const w of staged.rosters){const live=s.rosters!.find(x=>x.weekStart===w.weekStart)!;let changed=JSON.stringify(live.publicHolidays||[])!==JSON.stringify(w.publicHolidays||[]);live.publicHolidays=w.publicHolidays;for(const sh of w.shifts){const target=live.shifts.find(x=>x.id===sh.id)!;if(JSON.stringify(target.actual)!==JSON.stringify(sh.actual)){Object.assign(target,{actual:sh.actual,updated:sh.updated});changed=true;}}if(changed){live.revision++;live.updated=now.toISOString();}}
 (s.financeMonthCheckouts??=[]).push(result);return result;
}
