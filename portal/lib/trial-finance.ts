import type {LiveState} from './live-store';
import {isTrialShift,minutes,overlap,type Shift} from './roster-model';
import {localClock} from './timetable-model';

export type TrialSettlement={id:string;requestId:string;weekStart:string;shiftId:string;date:string;shift:Shift;actual:{start:string;end:string;breakMinutes:number};workedMinutes:number;amountCents:number;note:string;createdAt:string;createdBy:string};
export type TrialPayment={id:string;requestId:string;settlementId:string;amountCents:number;date:string;reference:string;createdAt:string;createdBy:string};
export function validTrialDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value}
const requestId=(value:string)=>{if(!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value))throw Error('Reopen the form to obtain a valid request ID.')};
const amount=(value:string)=>{if(!/^\d+(\.\d{1,2})?$/.test(value))throw Error('Enter a positive total with at most two decimal places.');const cents=Math.round(Number(value)*100);if(!Number.isSafeInteger(cents)||cents<=0)throw Error('Enter a valid positive settlement total.');return cents};
export function trialReport(s:LiveState,date:string,outstanding=false,now=new Date(),restaurant?:import('./shift-templates').Restaurant){
 if(!validTrialDate(date))throw Error('Choose a valid trial date.');const clock=localClock(now,'Etc/GMT-10');
 const rosterRows=(s.rosters||[]).flatMap(w=>w.shifts.filter(isTrialShift).map(shift=>({weekStart:w.weekStart,shift})));
 // A frozen settlement stays visible even if a legacy import omitted its original roster.
 for(const record of s.trialSettlements||[])if(!rosterRows.some(r=>r.weekStart===record.weekStart&&r.shift.id===record.shiftId))rosterRows.push({weekStart:record.weekStart,shift:record.shift});
 const rows=rosterRows.filter(r=>!restaurant||(s.trialSettlements?.find(x=>x.weekStart===r.weekStart&&x.shiftId===r.shift.id)?.shift.restaurant||r.shift.restaurant)===restaurant).map(({weekStart,shift})=>{const settlement=s.trialSettlements?.find(r=>r.weekStart===weekStart&&r.shiftId===shift.id);const payment=settlement?s.trialPayments?.find(p=>p.settlementId===settlement.id):undefined;const ready=shift.date<clock.date||shift.date===clock.date&&shift.end<=clock.time;
 return {weekStart,shift,settlement,payment,ready,status:payment?'Paid':settlement?'Awaiting payment':ready?'Ready to settle':'Scheduled',overdue:!payment&&shift.date<clock.date};
 }).filter(r=>outstanding?!r.payment&&r.shift.date<=clock.date:r.shift.date===date).sort((a,b)=>a.shift.date.localeCompare(b.shift.date)||a.shift.start.localeCompare(b.shift.start)||a.shift.employee.name.localeCompare(b.shift.employee.name));
 return {date,today:clock.date,outstanding,rows,totalSettledCents:rows.reduce((n,r)=>n+(r.settlement?.amountCents||0),0),totalPaidCents:rows.reduce((n,r)=>n+(r.payment?.amountCents||0),0)};
}
export type TrialReport=ReturnType<typeof trialReport>;
export type TrialSettlementInput={weekStart:string;shiftId:string;start:string;end:string;breakMinutes:string;amount:string;note:string;requestId:string;confirm:boolean};
export function settleTrial(s:LiveState,input:TrialSettlementInput,actor:string,id:string,now=new Date()){
 requestId(input.requestId);if(!input.confirm)throw Error('Confirm actual work and the manually entered total.');
 const amountCents=amount(input.amount),breakMinutes=Number(input.breakMinutes);const start=minutes(input.start),end=minutes(input.end);if(!Number.isFinite(start)||!Number.isFinite(end)||start>=1440||end<=start||!/^\d+$/.test(input.breakMinutes)||!Number.isSafeInteger(breakMinutes)||breakMinutes<0||breakMinutes>=end-start)throw Error('Enter valid actual times on the same day and a shorter whole-minute unpaid break.');
 const note=input.note.trim();if(note.length>1000)throw Error('Keep the settlement note within 1,000 characters.');
 const duplicate=s.trialSettlements?.find(r=>r.requestId===input.requestId);if(duplicate){if(duplicate.weekStart!==input.weekStart||duplicate.shiftId!==input.shiftId||duplicate.actual.start!==input.start||duplicate.actual.end!==input.end||duplicate.actual.breakMinutes!==breakMinutes||duplicate.amountCents!==amountCents||duplicate.note!==note)throw Error('Settlement request already used with different details.');return duplicate}
 const shift=s.rosters?.find(w=>w.weekStart===input.weekStart)?.shifts.find(sh=>sh.id===input.shiftId);if(!shift||!isTrialShift(shift))throw Error('Trial shift not found.');
 if(s.trialSettlements?.some(r=>r.weekStart===input.weekStart&&r.shiftId===input.shiftId))throw Error('This trial has already been settled. Refresh to view its record.');
 const clock=localClock(now,'Etc/GMT-10');if(!validTrialDate(shift.date)||shift.date>clock.date||shift.date===clock.date&&input.end>clock.time)throw Error('Confirm trial work only after it has finished (UTC+10).');
 const actual={start:input.start,end:input.end,breakMinutes};
 const peers=(s.rosters||[]).flatMap(w=>w.shifts.filter(sh=>sh.id!==shift.id&&sh.employeeId===shift.employeeId&&sh.date===shift.date));
 if(peers.some(sh=>{const settled=s.trialSettlements?.find(r=>r.shiftId===sh.id);return overlap(settled?.actual||sh.actual||sh,actual)}))throw Error('Actual trial time overlaps another shift for this person.');
 const record:TrialSettlement=structuredClone({id,requestId:input.requestId,weekStart:input.weekStart,shiftId:shift.id,date:shift.date,shift,actual,workedMinutes:end-start-breakMinutes,amountCents,note,createdAt:now.toISOString(),createdBy:actor});
 (s.trialSettlements??=[]).push(record);return record;
}
export type TrialPaymentInput={settlementId:string;date:string;reference:string;requestId:string;confirm:boolean};
export function recordTrialPayment(s:LiveState,input:TrialPaymentInput,actor:string,id:string,now=new Date()){
 requestId(input.requestId);if(!input.confirm)throw Error('Confirm this trial payment has already been completed.');const reference=input.reference.trim();if(!reference||reference.length>300)throw Error('Add a payment reference or note (up to 300 characters).');
 const duplicate=s.trialPayments?.find(p=>p.requestId===input.requestId);if(duplicate){if(duplicate.settlementId!==input.settlementId||duplicate.date!==input.date||duplicate.reference!==reference)throw Error('Payment request already used with different details.');return duplicate}
 const settled=s.trialSettlements?.find(r=>r.id===input.settlementId);if(!settled)throw Error('Confirm this trial settlement before recording payment.');if(s.trialPayments?.some(p=>p.settlementId===settled.id))throw Error('Payment has already been recorded for this trial.');
 if(!validTrialDate(input.date)||input.date<settled.date||input.date>localClock(now,'Etc/GMT-10').date)throw Error('Choose the actual payment date, between the trial date and today.');
 const payment:TrialPayment={id,requestId:input.requestId,settlementId:settled.id,amountCents:settled.amountCents,date:input.date,reference,createdAt:now.toISOString(),createdBy:actor};(s.trialPayments??=[]).push(payment);return payment;
}
export function trialCSV(report:TrialReport){const cell=(v:unknown)=>{let value=String(v??'');if(/^\s*[=+\-@]/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"'};const rows:unknown[][]=[['Trial date','Name','Restaurant','Scheduled start','Scheduled end','Actual start','Actual end','Unpaid break minutes','Worked minutes','Settlement total AUD','Status','Payment date','Payment reference','Settled by','Settled at','Payment recorded by','Payment recorded at']];for(const r of report.rows)rows.push([r.shift.date,r.shift.employee.name,r.shift.restaurant,r.shift.start,r.shift.end,r.settlement?.actual.start,r.settlement?.actual.end,r.settlement?.actual.breakMinutes,r.settlement?.workedMinutes,r.settlement?(r.settlement.amountCents/100).toFixed(2):'',r.status,r.payment?.date,r.payment?.reference,r.settlement?.createdBy,r.settlement?.createdAt,r.payment?.createdBy,r.payment?.createdAt]);return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')}
