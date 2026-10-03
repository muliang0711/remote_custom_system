'use client';
import {useState} from 'react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {hiringProgress} from '@/lib/hiring-model';
import type {LiveState} from '@/lib/live-store';
import {minutes,overlap,type Shift} from '@/lib/roster-model';
import {restaurants} from '@/lib/shift-templates';
import {weekDates} from '@/lib/timetable-model';

export function TrialScheduler({state,week,shift,requestedCandidate,defaultRestaurant,onSaved,onClose}:{state:LiveState;week:string;shift?:Shift;requestedCandidate?:string;defaultRestaurant?:string;onSaved:(state:LiveState,date:string,restaurant?:string)=>void;onClose:()=>void}){
 const candidates=state.hiring?.candidates||[];
 const eligible=candidates.filter(c=>{const p=hiringProgress(c,state.assignments);return c.interview==='Passed'&&p.acknowledged&&!p.rejected&&c.trial!=='Passed'&&!c.formAssignmentId});
 const requested=requestedCandidate||'';
 const [candidateId,setCandidateId]=useState(shift?.candidateId||(eligible.some(c=>c.id===requested)?requested:''));
 const [date,setDate]=useState(shift?.date||week),[start,setStart]=useState(shift?.start||''),[end,setEnd]=useState(shift?.end||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [revision]=useState(state.rosters?.find(w=>w.weekStart===week)?.revision||0);
 const conflict=state.rosters?.some(w=>w.shifts.some(sh=>sh.id!==shift?.id&&sh.candidateId===candidateId&&sh.date===date&&overlap(sh,{start,end})));
 const duration=minutes(end)-minutes(start);
 const settlement=state.trialSettlements?.find(r=>r.weekStart===week&&r.shiftId===shift?.id);
 const payment=settlement?state.trialPayments?.find(p=>p.settlementId===settlement.id):undefined;
 const canEdit=!settlement&&eligible.some(c=>c.id===candidateId);
 async function save(action:string,body:FormData){setBusy(true);setError('');try{Object.entries({action,weekStart:week,revision:String(revision),id:shift?.id||'',candidateId,date,start,end}).forEach(([k,v])=>body.set(k,v));const response=await fetch('/api/roster',{method:'POST',headers:{'x-portal-request':'1','x-workspace-revision':String(state?.workspaceRevision??0)},body});const data=await response.json() as LiveState&{error?:string};if(!response.ok)throw Error(data.error||'Could not save trial.');onSaved(data,date,String(body.get('restaurant')||shift?.restaurant||''));onClose();}catch(e){setError((e as Error).message.includes('another window')?'The timetable changed. Close this dialog and reopen it to load the latest schedule.':(e as Error).message)}finally{setBusy(false)}}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose()}}><DialogContent className="portal-dialog"><DialogTitle>{shift?'Edit candidate trial':'Add Candidate to Trial'}</DialogTitle><DialogDescription>Choose any start and end time, for example a two- or three-hour trial. No early, late or full-day template applies. Settle the manually entered total in Finance on the trial date. All times are UTC+10.</DialogDescription>{error&&<p className="error" role="alert">{error}</p>}
 {shift&&<div className="demo-notice"><p>{settlement?`Trial total: AUD ${(settlement.amountCents/100).toFixed(2)} · ${payment?'Paid':'Awaiting payment'}`:'Trial payment is due on the trial date.'}</p><a className="text-link" href={'/finance?view=trial&date='+shift.date}>Open trial settlement →</a>{settlement&&<p>This trial has been settled. The saved schedule is locked.</p>}</div>}
 <form className="form-stack" onSubmit={e=>{e.preventDefault();void save('trial',new FormData(e.currentTarget))}}><fieldset className="form-stack" disabled={!!settlement}>
 <label>Candidate<select required disabled={!!shift||busy} value={candidateId} onChange={e=>setCandidateId(e.target.value)}><option value="">Choose candidate</option>{candidates.filter(c=>eligible.includes(c)||c.id===shift?.candidateId).map(c=><option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}{shift&&!candidates.some(c=>c.id===shift.candidateId)&&<option value={shift.candidateId}>{shift.employee.name} · Archived candidate</option>}</select></label>
 {!eligible.length&&!shift&&<p>Complete a candidate’s interview and acknowledgement first. <a className="text-link" href="/hiring">Open Hiring Process</a></p>}
 {shift&&!canEdit&&<p>This candidate’s trial is closed or their hiring record has moved. The saved timetable entry is retained.</p>}
 <label>Restaurant<select name="restaurant" required defaultValue={shift?.restaurant||defaultRestaurant||''}><option value="">Choose restaurant</option>{restaurants.map(r=><option key={r}>{r}</option>)}</select></label>
 <label>Date<select value={date} onChange={e=>setDate(e.target.value)}>{weekDates(week).map(d=><option key={d}>{d}</option>)}</select></label>
 <div className="roster-time-inputs"><label>Start<Input type="time" step="60" required value={start} onChange={e=>setStart(e.target.value)}/></label><label>End<Input type="time" step="60" required value={end} onChange={e=>setEnd(e.target.value)}/></label></div>

 <p>{Number.isFinite(duration)&&duration>0?`Trial duration: ${duration} minutes`:!start||!end?'Enter the start and end time.':'End must be after start on the same day.'}</p>{conflict&&<p className="error">This candidate already has an overlapping trial.</p>}
 <label>Trial notes · optional<Input name="notes" maxLength={1000} defaultValue={shift?.notes}/></label>
 <Button disabled={busy||!canEdit||!!conflict||!Number.isFinite(duration)||duration<=0}>{busy?'Saving…':'Save trial'}</Button>
 </fieldset></form>{shift&&!settlement&&<form className="form-stack" onSubmit={e=>{e.preventDefault();void save('delete',new FormData(e.currentTarget))}}><label className="live-confirm"><input type="checkbox" name="confirm" value="yes" required/>Remove this trial from the timetable.</label><Button variant="destructive" disabled={busy}>Remove trial</Button></form>}
 </DialogContent></Dialog>;
}
