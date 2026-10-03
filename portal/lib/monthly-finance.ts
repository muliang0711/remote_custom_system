import {rosterMonth,rosterMonthWeeks,latestMonthCheckout} from './roster-month';
import {restaurants,type Restaurant} from './shift-templates';
import {leaveForHours,suppliedRules} from './business-rules';
import type {LiveState} from './live-store';
import type {FinanceRecord} from './finance-model';
import {latestFinance} from './finance-model';
import {localClock} from './timetable-model';
import {isTrialShift,type Shift} from './roster-model';

export type MonthLine=FinanceRecord['details'][number]&{handoffId:string;handoffBy:string;handoffAt:string;handoffVersion:number;weekStart:string};
export type MonthEmployee={employeeId:string;name:string;payrollerName?:string;remarks?:string;annualHours?:number;sickHours?:number;types:string[];days:number;scheduledMinutes:number;actualMinutes:number;estimatedCents:number|null;payableCents:number|null;unconfirmed:number;issues:string[];sample:boolean};
export type MonthlySettlement={restaurant?:Restaurant;id:string;month:string;version:number;sourceKey:string;createdAt:string;createdBy:string;reason:string;rows:MonthEmployee[];details:MonthLine[]};
export type FinancePayment={restaurant?:Restaurant;id:string;month:string;employeeId:string;settlementId:string;amountCents:number;payrunCents?:number;cashCents?:number;date:string;reference:string;createdAt:string;createdBy:string;requestId:string};
export const validMonth=(month:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(month);
export function monthDates(month:string){if(!validMonth(month))throw Error('Choose a valid month.');const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();return Array.from({length:end},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`);}
export function financeMonths(s:LiveState){return [...new Set([localClock(new Date(),'Etc/GMT-10').date.slice(0,7),...(s.rosters||[]).flatMap(w=>w.shifts.map(sh=>sh.date.slice(0,7))),...(s.financeRecords||[]).flatMap(r=>r.details.map(p=>p.shift.date.slice(0,7))),...(s.financeSettlements||[]).map(r=>r.month)])].filter(validMonth).sort().reverse();}
export function latestSettlement(s:LiveState,month:string,restaurant?:Restaurant){return (s.financeSettlements||[]).filter(r=>r.month===month&&r.restaurant===restaurant).sort((a,b)=>b.version-a.version)[0];}
const eligible=(sh:Shift)=>!isTrialShift(sh);
// Compare the work being handed over, not incidental revision counters or HR notes.
const workKey=(sh:Shift)=>JSON.stringify([sh.employeeId,sh.date,sh.start,sh.end,sh.breakMinutes,sh.breakStart||'',sh.breakEnd||'',sh.restaurant||'',sh.category||'',sh.actual?[sh.actual.start,sh.actual.end,sh.actual.breakMinutes,sh.actual.employeeType||'',sh.actual.confirmedAt]:null]);
function employeeRows(details:MonthLine[],previous?:MonthlySettlement):MonthEmployee[]{
 const ids=[...new Set([...details.map(p=>p.shift.employeeId),...(previous?.rows||[]).map(r=>r.employeeId)])];
 return ids.map(employeeId=>{const lines=details.filter(p=>p.shift.employeeId===employeeId),e=lines.at(-1)?.employee||lines.at(-1)?.shift.employee,old=previous?.rows.find(r=>r.employeeId===employeeId),unconfirmed=lines.filter(p=>!p.shift.actual).length;
 return {employeeId,name:e?.name||old?.name||employeeId,types:[...new Set(lines.map(p=>`${p.employee?.type||p.shift.employee.type} · Level ${p.level??'?'}`))],days:new Set(lines.map(p=>p.shift.date)).size,scheduledMinutes:lines.reduce((n,p)=>n+p.scheduledMinutes,0),actualMinutes:lines.reduce((n,p)=>n+p.actualMinutes,0),estimatedCents:lines.some(p=>p.estimatedCents===null)?null:lines.reduce((n,p)=>n+(p.estimatedCents||0),0),payableCents:unconfirmed||lines.some(p=>p.actualCents===null)?null:lines.reduce((n,p)=>n+(p.actualCents||0),0),unconfirmed,issues:[...new Set(lines.flatMap(p=>p.issues))],sample:/\.(example|invalid)$/i.test(e?.email||'')};
 });
}
export function monthlyReport(s:LiveState,month:string,restaurant?:Restaurant){
 if(restaurant&&!restaurants.includes(restaurant))throw Error("Choose a valid shop.");
 const checkout=restaurant?latestMonthCheckout(s,month,restaurant):undefined;
 const periodWeeks=rosterMonthWeeks(month);
 const inPeriod=(date:string,week:string)=>restaurant?rosterMonth(week)===month:date.startsWith(month);
 const inShop=(sh:Shift)=>!restaurant||sh.restaurant===restaurant;
 const dates=restaurant?periodWeeks.flatMap(w=>Array.from({length:7},(_,i)=>new Date(Date.parse(w+'T00:00:00Z')+i*86400000).toISOString().slice(0,10))):monthDates(month),settlement=latestSettlement(s,month,restaurant),details:MonthLine[]=[],pending:{weekStart:string;date:string;name:string;reason:string}[]=[];
 const weeks=[...new Set([...(s.rosters||[]).map(w=>w.weekStart),...(s.financeRecords||[]).map(r=>r.weekStart),...(checkout?.records||[]).map(r=>r.weekStart)])];
 const handoffs: {id:string;weekStart:string;through:string;version:number;by:string;at:string;reason:string;early:boolean}[]=[];
 let overtimeWarnings=0;
 for(const week of weeks){
  const record=restaurant?checkout?.records.find(r=>r.weekStart===week):latestFinance(s,week),live=s.rosters?.find(w=>w.weekStart===week),submitted=record?.details.filter(p=>eligible(p.shift)&&inShop(p.shift)&&inPeriod(p.shift.date,week))||[];
  if(submitted.length){handoffs.push({id:record!.id,weekStart:week,through:record!.through||record!.weekEnd,version:record!.version,by:record!.createdBy,at:record!.createdAt,reason:record!.reason||'',early:record!.early});overtimeWarnings+=submitted.filter(p=>record?.overtimeShiftIds?.includes(p.shift.id)).length;}
  for(const p of submitted)details.push({...p,handoffId:record!.id,handoffBy:record!.createdBy,handoffAt:record!.createdAt,handoffVersion:record!.version,weekStart:week});
  for(const sh of (live?.shifts||[]).filter(sh=>eligible(sh)&&inShop(sh)&&inPeriod(sh.date,week))){const saved=submitted.find(p=>p.shift.id===sh.id);const holiday=!!live?.publicHolidays?.includes(sh.date);if(!saved||workKey(saved.shift)!==workKey(sh)||holiday!==(saved.dayType==='Public Holiday'))pending.push({weekStart:week,date:sh.date,name:sh.employee.name,reason:saved?'Changed after checkout':'Not checked out'});}
  for(const p of submitted)if(!live?.shifts.some(sh=>sh.id===p.shift.id&&eligible(sh)&&inShop(sh)&&inPeriod(sh.date,week)))pending.push({weekStart:week,date:p.shift.date,name:p.employee?.name||p.shift.employee.name,reason:'Removed or moved after checkout'});
 }
 details.sort((a,b)=>a.shift.date.localeCompare(b.shift.date)||a.shift.id.localeCompare(b.shift.id));pending.sort((a,b)=>a.date.localeCompare(b.date));
 const rows=employeeRows(details,settlement).map(row=>{
  const priorMonths=Object.keys(s.financePayrollInfo||{}).filter(m=>m<=month).sort().reverse();
  const info=s.financePayrollInfo?.[month]?.[(restaurant?restaurant+':':'')+row.employeeId];
  const payrollerName=info?.payrollerName??settlement?.rows.find(r=>r.employeeId===row.employeeId)?.payrollerName??priorMonths.map(m=>(s.financePayrollInfo?.[m]?.[(restaurant?restaurant+':':'')+row.employeeId]?.payrollerName??s.financePayrollInfo?.[m]?.[row.employeeId]?.payrollerName)).find(name=>name!==undefined)??'';
  const accruals=details.filter(p=>p.shift.employeeId===row.employeeId&&p.shift.actual).map(p=>leaveForHours(p.actualMinutes/60,p.shift.actual!.employeeType||p.shift.employee.type,s.businessRules?.length?s.businessRules:suppliedRules));
  return {...row,payrollerName,remarks:info?.remarks??settlement?.rows.find(r=>r.employeeId===row.employeeId)?.remarks??'',annualHours:accruals.reduce((n,a)=>n+a.annual,0),sickHours:accruals.reduce((n,a)=>n+a.personal,0)};
 });
 // Month-local facts prevent an October-only checkout change from reopening September.
 let sourceKey=JSON.stringify(details.map(p=>({shift:p.shift,rate:p.rateCents,actual:p.actualCents,estimated:p.estimatedCents,name:p.employee?.name||p.shift.employee.name,type:p.employee?.type||p.shift.employee.type,level:p.level,issues:p.issues})));
 const payrollInfo=rows.filter(r=>r.payrollerName||r.remarks).map(r=>({employeeId:r.employeeId,payrollerName:r.payrollerName,remarks:r.remarks}));if(payrollInfo.length)sourceKey+=JSON.stringify(payrollInfo);
 const payments=(s.financePayments||[]).filter(p=>p.month===month&&p.restaurant===restaurant);
 const handoffHistory=(restaurant?(s.financeMonthCheckouts||[]).filter(c=>c.month===month&&c.restaurant===restaurant).flatMap(c=>c.records):s.financeRecords||[]).filter(r=>(!restaurant||r.details.some(p=>p.shift.restaurant===restaurant&&inPeriod(p.shift.date,r.weekStart)))&&r.weekStart<=dates.at(-1)!&&(r.through||r.weekEnd)>=dates[0]).map(r=>({id:r.id,weekStart:r.weekStart,through:r.through||r.weekEnd,version:r.version,by:r.createdBy,at:r.createdAt,reason:r.reason||'',current:restaurant?!!checkout?.records.some(x=>x.id===r.id):latestFinance(s,r.weekStart)?.id===r.id})).sort((a,b)=>b.at.localeCompare(a.at));
 return {checkout,restaurant,legacyPayments:restaurant?(s.financePayments||[]).filter(p=>p.month===month&&!p.restaurant):[],month,dates,details,rows,pending,handoffs,handoffHistory,overtimeWarnings,sourceKey,settlement,history:(s.financeSettlements||[]).filter(r=>r.month===month&&r.restaurant===restaurant).sort((a,b)=>b.version-a.version),payments,changed:!!settlement&&(sourceKey!==settlement.sourceKey||pending.length>0),monthEnded:localClock(new Date(),'Etc/GMT-10').date>dates.at(-1)!};
}
export type MonthlyReport=ReturnType<typeof monthlyReport>;
export function settleMonth(s:LiveState,input:{restaurant?:Restaurant;month:string;sourceKey:string;previousId:string;reason:string;confirm:boolean},actor:string,id:string,now=new Date()){
 const report=monthlyReport(s,input.month,input.restaurant),previous=report.settlement;
 if(!input.restaurant&&s.financeSettlements?.some(r=>r.month===input.month&&r.restaurant))throw Error('This month uses separate shop settlements. Open the relevant shop.');
 if(!input.confirm)throw Error('Confirm that the monthly report has been reviewed.');
 if(report.legacyPayments.length)throw Error('This month has legacy combined payments. Reconcile those records before creating separate shop settlements.');
 if(input.restaurant&&!report.checkout)throw Error('Check out the roster month in Timetable first.');
 if(localClock(now,'Etc/GMT-10').date<=report.dates.at(-1)!)throw Error('The month has not ended in UTC+10. Review the draft until month end.');
 if(report.pending.length)throw Error('Timetable changes still need checkout. Ask the roster owner to submit them.');
 if(!report.rows.length||report.rows.some(r=>r.payableCents===null))throw Error('Confirm actual work and resolve missing rates in Timetable, then check out again.');
 if(report.sourceKey!==input.sourceKey||(previous?.id||'')!==input.previousId)throw Error('The monthly report changed. Reload before settling.');
 if(previous?.sourceKey===report.sourceKey)return previous;
 if(previous&&!input.reason.trim())throw Error('Record a reason for revising this settlement.');
 if(input.reason.length>1000)throw Error('Use a reason under 1,000 characters.');
 const record:MonthlySettlement=structuredClone({restaurant:input.restaurant,id,month:input.month,version:(previous?.version||0)+1,sourceKey:report.sourceKey,createdAt:now.toISOString(),createdBy:actor,reason:input.reason.trim(),rows:report.rows,details:report.details});
 (s.financeSettlements??=[]).push(record);return record;
}
export function paymentBalance(s:LiveState,settlement:MonthlySettlement,employeeId:string){const due=settlement.rows.find(r=>r.employeeId===employeeId)?.payableCents;if(due===undefined||due===null)throw Error('Employee is not in the confirmed settlement.');const paid=(s.financePayments||[]).filter(p=>p.month===settlement.month&&p.restaurant===settlement.restaurant&&p.employeeId===employeeId).reduce((n,p)=>n+p.amountCents,0);return {due,paid,balance:due-paid};}
export function recordPayment(s:LiveState,input:{restaurant?:Restaurant;month:string;settlementId:string;employeeId:string;amount:string;payrun?:string;cash?:string;kind:string;date:string;reference:string;requestId:string;confirm:boolean},actor:string,id:string,now=new Date()){
 const split=input.payrun!==undefined||input.cash!==undefined;
 const parse=(value:string)=>{if(!/^\d+(\.\d{1,2})?$/.test(value))throw Error('Enter amounts with up to two decimal places.');const cents=Math.round(Number(value)*100);if(!Number.isSafeInteger(cents)||cents<0)throw Error('Enter a valid amount.');return cents;};
 const payrun=split?parse(input.payrun||'0'):undefined,cash=split?parse(input.cash||'0'):undefined;
 const amount=split?payrun!+cash!:parse(input.amount);
 if(!Number.isSafeInteger(amount)||amount<=0)throw Error('Enter a positive Payrun or Cash amount.');
 const sign=input.kind==='recovery'?-1:1;
 const duplicate=s.financePayments?.find(p=>p.requestId===input.requestId);if(duplicate){if(duplicate.restaurant!==input.restaurant||duplicate.month!==input.month||duplicate.employeeId!==input.employeeId||duplicate.amountCents!==sign*amount||duplicate.date!==input.date||duplicate.reference!==input.reference.trim()||duplicate.payrunCents!==(split?sign*payrun!:undefined)||duplicate.cashCents!==(split?sign*cash!:undefined))throw Error('Payment request already used with different details.');return duplicate;}
 if(!input.confirm)throw Error('Confirm that this payment or recovery already happened.');
 if(!/^[a-f\d-]{36}$/i.test(input.requestId))throw Error('Missing payment request ID. Reopen the form.');
 const report=monthlyReport(s,input.month,input.restaurant),settlement=report.settlement;
 if(report.legacyPayments.length||!input.restaurant&&s.financeSettlements?.some(r=>r.month===input.month&&r.restaurant))throw Error('Reconcile combined and shop payment records before recording payment.');
 if(!settlement||settlement.id!==input.settlementId||report.changed)throw Error('Review and confirm the current monthly settlement before recording payment.');
 const balance=paymentBalance(s,settlement,input.employeeId).balance;
 if(!['payment','recovery'].includes(input.kind)||input.kind==='payment'&&(balance<=0||amount>balance)||input.kind==='recovery'&&(balance>=0||amount> -balance))throw Error('Amount exceeds the outstanding payment or recovery. Reload the report.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.date))||new Date(input.date+'T00:00:00Z').toISOString().slice(0,10)!==input.date||input.date>localClock(now,'Etc/GMT-10').date)throw Error('Choose a valid payment date, no later than today.');
 if(!input.reference.trim()||input.reference.length>300)throw Error('Add a payment reference or note (up to 300 characters).');
 const payment:FinancePayment={restaurant:input.restaurant,id,month:input.month,employeeId:input.employeeId,settlementId:settlement.id,amountCents:sign*amount,...(split?{payrunCents:sign*payrun!,cashCents:sign*cash!}:{}),date:input.date,reference:input.reference.trim(),requestId:input.requestId,createdAt:now.toISOString(),createdBy:actor};
 (s.financePayments??=[]).push(payment);return payment;
}
const cell=(v:unknown)=>{let value=String(v??'');if(/^\s*[=+\-@]/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"';};
const csv=(rows:unknown[][])=>'\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
export function monthlyCSV(s:LiveState,month:string,kind:string,settlementId?:string,restaurant?:Restaurant){
 const report=monthlyReport(s,month,restaurant),saved=settlementId?s.financeSettlements?.find(r=>r.month===month&&r.restaurant===restaurant&&r.id===settlementId):undefined;
 if(settlementId&&!saved)throw Error('Settlement version not found.');
 const rows=saved?.rows||report.rows,details=saved?.details||report.details,status=saved?`Settlement v${saved.version}`:'DRAFT — checked-out work only',amount=(n:number|null)=>n===null?'Needs review':(n/100).toFixed(2);
 if(kind==='payroll')return csv([['Month','Report','Shop','Name','Employment','Day','Rate AUD','Hour','Total AUD','Nett Total AUD','Payroller Name','Payrun AUD (recorded)','Cash AUD (recorded)','Other / legacy payment AUD','Final pay date','Payment status','Remarks','Annual Leave earned (hours)','Sick Leave earned (hours)','Total Hour','Weeks included'],...payrollBreakdown(rows,details,report.payments).map(p=>[month,status,p.shop,p.name,p.employment,p.dayType,p.rateCents===null?'':amount(p.rateCents),p.minutes/60,amount(p.totalCents),p.first?amount(p.row.payableCents):'',p.first?p.row.payrollerName||'':'',p.first?amount(p.payrun):'',p.first?amount(p.cash):'',p.first?amount(p.other):'',p.first?p.finalPay:'',p.first?paymentStatus(p.row,report.payments):'',p.first?p.row.remarks||'':'',p.first?(p.row.annualHours??0).toFixed(4):'',p.first?(p.row.sickHours??0).toFixed(4):'',p.first?p.row.actualMinutes/60:'',p.weeks.join(' / ')])]);
 if(kind==='details')return csv([['Month','Report','Employee ID','Employee','Type','Date','Shop','Department','Scheduled start','Scheduled end','Unpaid break minutes','Scheduled paid hours','Confirmed actual start','Confirmed actual end','Actual unpaid break minutes','Actual hours','AUD hourly rate','Confirmed base pay AUD','Issues','Checkout by','Checkout at','Checkout version'],...details.map(p=>[month,status,p.shift.employeeId,p.employee?.name||p.shift.employee.name,p.employee?.type||p.shift.employee.type,p.shift.date,p.shift.restaurant,p.shift.category,p.shift.start,p.shift.end,p.shift.breakMinutes,p.scheduledMinutes/60,p.shift.actual?.start,p.shift.actual?.end,p.shift.actual?.breakMinutes,p.shift.actual?p.actualMinutes/60:'',amount(p.rateCents),amount(p.actualCents),p.issues.join('; ')||(!p.shift.actual?'Actual work not confirmed':''),p.handoffBy,p.handoffAt,p.handoffVersion])]);
 if(kind!=='summary')throw Error('Choose summary or details.');
 return csv([['Month','Report','Employee ID','Employee','Employment types','Work days','Scheduled hours','Confirmed actual hours','Scheduled estimate AUD','Confirmed base pay AUD','Unconfirmed shifts','Issues','Pending handover changes in month','Recorded net payment AUD (current ledger)','Outstanding AUD (current ledger)','Payment status (current ledger)','Scope'],...rows.map(r=>[month,status,r.employeeId,r.name,r.types.join(' / '),r.days,r.scheduledMinutes/60,r.actualMinutes/60,amount(r.estimatedCents),amount(r.payableCents),r.unconfirmed,r.issues.join('; '),saved?'':report.pending.length,amount(report.payments.filter(p=>p.employeeId===r.employeeId).reduce((n,p)=>n+p.amountCents,0)),r.payableCents===null?'Needs review':amount(r.payableCents-report.payments.filter(p=>p.employeeId===r.employeeId).reduce((n,p)=>n+p.amountCents,0)),paymentStatus(r,report.payments),'Base pay only; excludes tax, super, overtime premiums, allowances and leave payments'])]);
}

export function paymentStatus(row:MonthEmployee,payments:FinancePayment[]){if(row.payableCents===null)return 'Needs review';const paid=payments.filter(p=>p.employeeId===row.employeeId).reduce((n,p)=>n+p.amountCents,0),balance=row.payableCents-paid;return balance<0?'Overpaid':balance===0?(row.payableCents?'Paid':'No payment due'):paid>0?'Part paid':'Unpaid';}

export function savePayrollInfo(s:LiveState,input:{restaurant?:Restaurant;month:string;employeeId:string;payrollerName:string;remarks:string},actor:string){
 if(!validMonth(input.month))throw Error('Choose a valid month.');
 if(!monthlyReport(s,input.month,input.restaurant).rows.some(r=>r.employeeId===input.employeeId))throw Error('Employee is not in this monthly report.');
 if(input.payrollerName.trim().length>160||input.remarks.trim().length>2000)throw Error('Payroller name or remarks is too long.');
 s.financePayrollInfo??={};s.financePayrollInfo[input.month]??={};s.financePayrollInfo[input.month][(input.restaurant?input.restaurant+':':'')+input.employeeId]={payrollerName:input.payrollerName.trim(),remarks:input.remarks.trim(),updatedAt:new Date().toISOString(),updatedBy:actor};
}
export function payrollBreakdown(rows:MonthEmployee[],details:MonthLine[],payments:FinancePayment[]){
 return rows.flatMap(savedRow=>{
  const row={...savedRow};
  const lines=details.filter(p=>p.shift.employeeId===row.employeeId);
  if(row.annualHours===undefined||row.sickHours===undefined){const earned=lines.filter(p=>p.shift.actual).map(p=>leaveForHours(p.actualMinutes/60,p.shift.actual!.employeeType||p.shift.employee.type,suppliedRules));row.annualHours??=earned.reduce((n,a)=>n+a.annual,0);row.sickHours??=earned.reduce((n,a)=>n+a.personal,0);}
  const buckets=new Map<string,{shop:string;employment:string;dayType:string;rateCents:number|null;minutes:number;totalCents:number|null;weeks:string[]}>();
  for(const p of lines){const shop=p.shift.restaurant||'Unassigned',employment=`${p.employee?.type||p.shift.employee.type} · Level ${p.level??'?'}`,key=JSON.stringify([shop,employment,p.dayType,p.rateCents]);let b=buckets.get(key);if(!b){b={shop,employment,dayType:p.dayType,rateCents:p.rateCents,minutes:0,totalCents:0,weeks:[]};buckets.set(key,b);}b.minutes+=p.actualMinutes;b.totalCents=b.totalCents===null||p.actualCents===null?null:b.totalCents+p.actualCents;if(!b.weeks.includes(p.weekStart))b.weeks.push(p.weekStart);}
  const dayTypes=['Weekday','Saturday','Sunday','Public Holiday'];
  const categories=[...new Map([...buckets.values()].map(b=>[JSON.stringify([b.shop,b.employment]),b])).values()];
  for(const c of categories)for(const dayType of dayTypes)if(![...buckets.values()].some(b=>b.shop===c.shop&&b.employment===c.employment&&b.dayType===dayType))buckets.set(JSON.stringify([c.shop,c.employment,dayType]),{shop:c.shop,employment:c.employment,dayType,rateCents:null,minutes:0,totalCents:0,weeks:[]});
  if(!buckets.size)buckets.set('empty',{shop:'—',employment:row.types.join(' / '),dayType:'—',rateCents:null,minutes:0,totalCents:0,weeks:[]});
  const paid=payments.filter(p=>p.employeeId===row.employeeId),payrun=paid.reduce((n,p)=>n+(p.payrunCents||0),0),cash=paid.reduce((n,p)=>n+(p.cashCents||0),0),other=paid.reduce((n,p)=>n+p.amountCents-(p.payrunCents||0)-(p.cashCents||0),0),finalPay=paid.filter(p=>p.amountCents>0).map(p=>p.date).sort().at(-1)||'';
  return [...buckets.values()].sort((a,b)=>a.shop.localeCompare(b.shop)||a.employment.localeCompare(b.employment)||dayTypes.indexOf(a.dayType)-dayTypes.indexOf(b.dayType)||(a.rateCents||0)-(b.rateCents||0)).map((b,index)=>({...b,row,employeeId:row.employeeId,name:row.name,first:index===0,payrun,cash,other,finalPay}));
 });
}
