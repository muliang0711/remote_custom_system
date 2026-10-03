'use client';
import {useState} from 'react';
import type {OfficialEmployee} from '@/lib/employee-model';
import {employeeToday} from '@/lib/employee-model';
import {leaveBalance,type LeaveType} from '@/lib/annual-leave';
import type {LiveState} from '@/lib/live-store';
import {Button} from './ui/button';
import {Input} from './ui/input';
export function EmployeeLeave({state,employee,busy,onSave,leaveType}:{leaveType:LeaveType;state:LiveState;employee:OfficialEmployee;busy:boolean;onSave:(form:FormData)=>void}){
 const balance=leaveBalance(state,employee.id,leaveType);
 const title=leaveType==='annual'?'Annual leave':'Sick leave';
 const entries=leaveType==='annual'?employee.annualLeaveEntries:employee.sickLeaveEntries;
 const [kind,setKind]=useState(balance.opening?'taken':'opening');
 const [form,setForm]=useState<{requestId:string;revision:number}|null>(null);
 return <details className="employee-leave-details"><summary>{title} breakdown &amp; records</summary>
 {leaveType==='sick'&&<p>Sick leave uses the existing Personal / Carer / Sick Leave balance and calculation rule.</p>}
 <p>Opening balance + accrued leave − leave used + adjustments = remaining hours.</p>
 <div className="employee-details"><span>Opening balance</span><strong>{balance.opening?`${balance.opening.hours.toFixed(2)} h · before ${balance.opening.date}`:'Not recorded'}</strong><span>Accrued from confirmed work</span><strong>{balance.accrued.toFixed(4)} h</strong><span>Leave used</span><strong>{balance.taken.toFixed(2)} h</strong><span>Adjustments</span><strong>{balance.adjustments.toFixed(2)} h</strong><span>Remaining {title.toLowerCase()}</span><strong>{balance.remaining.toFixed(2)} h</strong></div>
 <p>Full-time / part-time: confirmed actual hours {leaveType==='annual'?'÷ 13':'× 0.038462'}, excluding unpaid breaks. Scheduled hours do not accrue leave. Employment type is retained with confirmed work; changing today’s profile does not erase earlier accruals. Casual work accrues no {title.toLowerCase()}.</p>
 {!balance.opening&&<p className="demo-notice">This is the balance from recorded work and leave only. Add an opening balance, including 0 for a new employee, to establish the starting point.</p>}
 {balance.opening&&<p>Work before {balance.opening.date} is covered by the opening balance and is not counted again. Editing or deleting confirmed work after that date updates this balance.</p>}
 <Button type="button" variant="outline" disabled={busy} onClick={()=>setForm({requestId:crypto.randomUUID(),revision:entries?.length||0})}>Record {title.toLowerCase()}</Button>
 {form&&<form className="form-stack employee-leave-form" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);data.set('requestId',form.requestId);data.set('revision',String(form.revision));data.set('kind',kind);onSave(data)}}>
 <label>Record type<select value={kind} onChange={e=>setKind(e.target.value)}>{!balance.opening&&<option value="opening">Opening balance</option>}<option value="taken">{title} used</option><option value="adjustment">Balance adjustment (+ / −)</option></select></label>
 <label>{kind==='opening'?'Accrual starts on this date':'Record date'}<Input name="date" type="date" required max={employeeToday()} min={balance.opening?.date} defaultValue={employeeToday()}/></label>
 {kind==='opening'&&<small>Enter the remaining balance immediately before this date. Confirmed work from this date onward is added automatically.</small>}
 <label>Hours<Input name="hours" type="number" step="0.0001" min={kind==='adjustment'?-100000:kind==='taken'?0.0001:0} max={100000} required/></label>
 <label>Source / reason<Input name="reason" required maxLength={1000} placeholder={kind==='opening'?'e.g. Previous payroll balance as at yesterday':`e.g. ${title} taken, or correction reference`}/></label>
 <p>Record completed leave here. Future requests and approval are handled separately. Saved records remain in the history; use an adjustment with a reason to correct a mistake.</p>
 <div className="actions"><Button disabled={busy}>{busy?'Saving…':'Save leave record'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setForm(null)}>Cancel</Button></div>
 </form>}
 <h3>Balance records</h3>{!balance.entries.length?<p>No opening balance, leave used or adjustments recorded.</p>:<div className="report-scroll"><table><thead><tr><th>Date</th><th>Record</th><th>Hours</th><th>Source / recorded by</th></tr></thead><tbody>{balance.entries.map(e=><tr key={e.id}><td>{e.date}</td><td>{e.kind==='opening'?'Opening balance':e.kind==='taken'?'Leave used':'Adjustment'}</td><td>{e.kind==='taken'?'−':''}{e.hours.toFixed(4)}</td><td>{e.reason}<small className="block muted">{e.by} · {new Date(e.created).toLocaleString()}</small></td></tr>)}</tbody></table></div>}
 <details><summary>Confirmed work behind the accrual ({balance.accruals.length} shifts)</summary><div className="report-scroll"><table><thead><tr><th>Work date</th><th>Employee type at confirmation</th><th>Actual hours</th><th>{title} earned</th></tr></thead><tbody>{balance.accruals.map(a=><tr key={a.id}><td><a className="text-link" href={`/timetable?week=${a.weekStart}`}>{a.date}</a></td><td>{a.type}</td><td>{a.hours.toFixed(4)}</td><td>{a.earned.toFixed(6)} h</td></tr>)}</tbody></table></div></details>
 <small>Display values are rounded; calculations retain full precision. <a className="text-link" href="/business-rules">View business rules</a></small>
 </details>;
}
