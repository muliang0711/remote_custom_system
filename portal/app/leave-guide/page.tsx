'use client';
import {useEffect,useState} from 'react';
import {PortalSidebar} from '@/components/portal-sidebar';
import {SidebarProvider,SidebarTrigger} from '@/components/ui/sidebar';
import {leaveForHours,type BusinessRule} from '@/lib/business-rules';

export default function LeaveGuide(){
 const [rules,setRules]=useState<BusinessRule[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{let current=true;void fetch('/api/live').then(async response=>{const data=await response.json() as {error?:string;businessRules?:BusinessRule[]};if(!response.ok)throw Error(data.error||'Could not load leave rules.');const loaded=data.businessRules as BusinessRule[];leaveForHours(0,'Full-Time',loaded||[]);if(current)setRules(loaded);}).catch(e=>{if(current)setError(e.message);});return()=>{current=false;};},[]);
 const params=(id:string)=>rules?.find(rule=>rule.id===id&&rule.version===1)?.parameters;
 const eligible=(id:string)=>(params(id)?.eligibleTypes as string[]||[]).join(' / ');
 return <SidebarProvider><PortalSidebar active="leave-guide"/><div className="workspace"><header className="topbar"><div><SidebarTrigger/><span>Employee / Annual &amp; Sick Leave</span></div></header><main className="availability-page">
  <div className="page-heading"><div><p className="eyebrow">LEAVE CALCULATION</p><h1>Annual &amp; Sick Leave</h1><p>How leave is earned and how the remaining hours in an employee profile are calculated.</p></div><a className="primary-link" href="/employees">Open employee profiles</a></div>
  {error?<p className="error" role="alert">{error}</p>:!rules?<p role="status">Loading your saved leave rules…</p>:<>
   <section className="panel roster-list"><h2>How hours are earned</h2><p>These are your workspace’s saved business rules. All leave amounts are measured in hours.</p><div className="report-scroll"><table><thead><tr><th>Leave</th><th>Eligible employees</th><th>Calculation</th><th>Example: 38 paid hours</th></tr></thead><tbody><tr><td><strong>Annual Leave</strong></td><td>{eligible('BR-AL-01')}</td><td>Paid working hours ÷ {String(params('BR-AL-02')?.divisor)}</td><td>{leaveForHours(38,'Full-Time',rules).annual.toFixed(4)} hours for a Full-Time employee</td></tr><tr><td><strong>Sick Leave</strong><small className="block muted">Personal / carer’s leave</small></td><td>{eligible('BR-PL-01')}</td><td>Paid working hours × {String(params('BR-PL-02')?.rate)}</td><td>{leaveForHours(38,'Full-Time',rules).personal.toFixed(4)} hours for a Full-Time employee</td></tr></tbody></table></div><p>Employee types outside the eligible list earn zero hours for that leave type. The calculation uses the employee type recorded with the confirmed work.</p></section>
   <section className="panel roster-list"><h2>Which working hours count?</h2><p>The system uses confirmed actual work recorded in Timetable. Checking out a week confirms the timetable’s working hours. Unpaid breaks are deducted, and candidate trials are excluded.</p><p>For example, a 12:00–22:00 shift with a one-hour unpaid break counts as 9 working hours, not 10.</p></section>
   <section className="panel roster-list"><h2>Remaining leave in Employee Profile</h2><p><strong>Remaining hours = opening balance + earned hours − leave used + adjustments</strong></p><p>The profile includes records up to today. When an opening balance is set, working hours from its date onward are included. Enter the opening balance as the amount available before work on that date to avoid counting it twice.</p><p>Record leave taken and any balance corrections in the employee profile. These records are manual; they are not inferred from a missing shift.</p></section>
   <section className="panel roster-list"><h2>Profile balance and monthly report</h2><p>Employee Profile shows the remaining balance. Finance shows leave earned from the approved work handed over for the selected month. The monthly accrual is not the employee’s remaining balance.</p><a className="text-link" href="/business-rules">View all business rules →</a></section>
  </>}
 </main></div></SidebarProvider>;
}
