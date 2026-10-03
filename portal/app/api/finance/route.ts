import {checkoutRosterMonth} from '@/lib/roster-month';
import {restaurants,type Restaurant} from '@/lib/shift-templates';
import {trialReport,trialCSV,settleTrial,recordTrialPayment} from '@/lib/trial-finance';
import {requireMember} from '@/lib/portal-auth';
import {checkWorkspaceRevision} from '@/lib/live-store';
import {randomUUID} from 'node:crypto';
import {localRequest,session} from '@/lib/google-auth';
import {exclusive,loadLive,saveLive} from '@/lib/live-store';
import {weekDates} from '@/lib/timetable-model';
import {checkoutWeek} from '@/lib/finance-model';
import {savePayrollInfo,financeMonths,monthlyReport,monthlyCSV,settleMonth,recordPayment} from '@/lib/monthly-finance';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const shop=(value:string|null)=>{if(value&&!restaurants.includes(value as Restaurant))throw Error('Choose a valid shop.');return (value||undefined) as Restaurant|undefined;};
const noCache={'Cache-Control':'no-store'};
export async function POST(request:Request){
 try{
  localRequest(request,true);const c=session(request),f=await request.formData(),field=(key:string)=>String(f.get(key)||'');
  return await exclusive(async()=>{
   if(session(request).email!==c.email)throw Error('Account changed. Reload.');
   const s=loadLive(c.email);checkWorkspaceRevision(request,s);const action=field('action')||'checkout';
   if(action==='checkout-month'){const restaurant=shop(field('restaurant'));if(!restaurant)throw Error('Choose a shop.');const record=checkoutRosterMonth(s,{month:field('month'),restaurant,previousId:field('previousId'),reason:field('reason'),holidays:f.has('holidays')?JSON.parse(field('holidays')):undefined,confirm:field('confirm')==='yes'},requireMember(request).email,randomUUID());saveLive(c.email,s);return Response.json({id:record.id,month:record.month},{headers:noCache});}
   if(action==='trial-settle'){
    const selected=shop(field('restaurant'));if(selected&&s.rosters?.find(w=>w.weekStart===field('weekStart'))?.shifts.find(sh=>sh.id===field('shiftId'))?.restaurant!==selected)throw Error('Trial belongs to another shop.');
    const record=settleTrial(s,{weekStart:field('weekStart'),shiftId:field('shiftId'),start:field('start'),end:field('end'),breakMinutes:field('breakMinutes'),amount:field('amount'),note:field('note'),requestId:field('requestId'),confirm:field('confirm')==='yes'},requireMember(request).email,randomUUID());saveLive(c.email,s);return Response.json({id:record.id},{headers:noCache});
   }
   if(action==='trial-payment'){
    const selected=shop(field('restaurant'));if(selected&&s.trialSettlements?.find(r=>r.id===field('settlementId'))?.shift.restaurant!==selected)throw Error('Trial belongs to another shop.');
    const record=recordTrialPayment(s,{settlementId:field('settlementId'),date:field('date'),reference:field('reference'),requestId:field('requestId'),confirm:field('confirm')==='yes'},requireMember(request).email,randomUUID());saveLive(c.email,s);return Response.json({id:record.id},{headers:noCache});
   }
   if(action==='payroll-info'){savePayrollInfo(s,{restaurant:shop(field('restaurant')),month:field('month'),employeeId:field('employeeId'),payrollerName:field('payrollerName'),remarks:field('remarks')},requireMember(request).email);saveLive(c.email,s);return Response.json({saved:true},{headers:noCache});}
   if(action==='settle'){
    const record=settleMonth(s,{restaurant:shop(field('restaurant')),month:field('month'),sourceKey:field('sourceKey'),previousId:field('previousId'),reason:field('reason'),confirm:field('confirm')==='yes'},requireMember(request).email,randomUUID());
    saveLive(c.email,s);return Response.json({id:record.id},{headers:noCache});
   }
   if(action==='payment'){
    const record=recordPayment(s,{restaurant:shop(field('restaurant')),month:field('month'),settlementId:field('settlementId'),employeeId:field('employeeId'),amount:field('amount'),payrun:f.has('payrun')?field('payrun'):undefined,cash:f.has('cash')?field('cash'):undefined,kind:field('kind'),date:field('date'),reference:field('reference'),requestId:field('requestId'),confirm:field('confirm')==='yes'},requireMember(request).email,randomUUID());
    saveLive(c.email,s);return Response.json({id:record.id},{headers:noCache});
   }
   if(action!=='checkout')throw Error('Unknown finance action.');
   const week=field('week'),roster=s.rosters?.find(w=>w.weekStart===week);
   if(!roster||roster.revision!==Number(field('revision')))throw Error('The timetable changed. Reload and review before checkout.');
   const holidays:unknown=JSON.parse(field('holidays')||'[]');
   if(!Array.isArray(holidays)||holidays.some(d=>typeof d!=='string'||!weekDates(week).includes(d)))throw Error('Invalid public holiday dates.');
   const holidayDates=([...new Set(holidays)] as string[]).sort();
   if(JSON.stringify([...(roster.publicHolidays||[])].sort())!==JSON.stringify(holidayDates)){roster.publicHolidays=holidayDates;roster.revision++;roster.updated=new Date().toISOString();}
   const record=checkoutWeek(s,{week,revision:roster.revision,previousId:field('previousId'),confirmEarly:field('confirmEarly')==='yes',confirmReplace:field('confirmReplace')==='yes',through:field('through')||undefined,reason:field('reason')},requireMember(request).email,randomUUID());
   saveLive(c.email,s);return Response.json({id:record.id,month:(record.through||record.weekEnd).slice(0,7)},{headers:noCache});
  });
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers:noCache});}
}
export async function GET(request:Request){
 try{
  localRequest(request);const c=session(request),u=new URL(request.url),s=loadLive(c.email),id=u.searchParams.get('id'),kind=u.searchParams.get('kind'),month=u.searchParams.get('month');
  if(u.searchParams.get('view')==='trial'){
   const report=trialReport(s,u.searchParams.get('date')||'',u.searchParams.get('outstanding')==='1',new Date(),shop(u.searchParams.get('restaurant')));
   if(kind==='csv')return new Response(trialCSV(report),{headers:{...noCache,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="trial-${report.date}.csv"`,'X-Content-Type-Options':'nosniff'}});
   if(kind)throw Error('Choose a supported trial report.');
   return Response.json({workspaceRevision:s.workspaceRevision,report},{headers:noCache});
  }
  if(month){
   if(!kind)return Response.json({workspaceRevision:s.workspaceRevision,report:monthlyReport(s,month,shop(u.searchParams.get('restaurant')))},{headers:noCache});
   const version=u.searchParams.get('settlement')||undefined;
   return new Response(monthlyCSV(s,month,kind,version,shop(u.searchParams.get('restaurant'))),{headers:{...noCache,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="finance-${month}-${kind}-${version?'settled':'draft'}.csv"`,'X-Content-Type-Options':'nosniff'}});
  }
  if(!id)return Response.json({workspaceRevision:s.workspaceRevision,months:financeMonths(s),records:s.financeRecords||[]},{headers:noCache});
  const r=s.financeRecords?.find(r=>r.id===id)||s.financeMonthCheckouts?.flatMap(c=>c.records).find(r=>r.id===id);if(!r)throw Error('Finance record not found.');
  if(!kind)return Response.json({month:(r.through||r.weekEnd).slice(0,7)},{headers:noCache});
  if(!['finance','payroll','roster','print'].includes(kind))throw Error('Choose a report.');
  return new Response(r.exports[kind as keyof typeof r.exports],{headers:{'Content-Type':kind==='print'?'text/html; charset=utf-8':'text/csv; charset=utf-8',...(kind==='print'?{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'"}:{'Content-Disposition':`attachment; filename="${kind}-${r.weekStart}-v${r.version}.csv"`}),...noCache,'X-Content-Type-Options':'nosniff'}});
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers:noCache});}
}
