'use client';
import {useState} from 'react';
import type {LiveState} from '@/lib/live-store';
import {type Restaurant} from '@/lib/shift-templates';
import {weekDates} from '@/lib/timetable-model';
import {type FloorClosures} from '@/lib/floor-scheduler';
import {Button} from './ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
export function FloorAutoScheduler({state,week,restaurant,onSaved,onClose}:{state:LiveState;week:string;restaurant:Restaurant;onSaved:(s:LiveState)=>void;onClose:()=>void}){
 const roster=state.rosters?.find(w=>w.weekStart===week);
 const [closed,setClosed]=useState<FloorClosures>(roster?.floorPlan?.closedDates||{CARLTONS:[],SPENCER:[]});
 const [revision]=useState(roster?.revision||0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{const form=new FormData();Object.entries({action:'floor-closures',restaurant,weekStart:week,revision:String(revision),closedDates:JSON.stringify(closed)}).forEach(([k,v])=>form.set(k,v));const r=await fetch('/api/roster',{method:'POST',headers:{'x-portal-request':'1','x-workspace-revision':String(state?.workspaceRevision??0)},body:form});const data=await r.json() as LiveState&{error?:string};if(!r.ok)throw Error(data.error||'Could not save closed days.');onSaved(data);onClose()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose()}}><DialogContent className="portal-dialog"><DialogTitle>Closed days · {restaurant}</DialogTitle><DialogDescription>Week of {week}. Select days this shop will be closed. Auto arrange Floor will use these saved dates.</DialogDescription>{error&&<p className="error" role="alert">{error}</p>}<div className="form-stack">{weekDates(week).map(date=><label className="live-confirm" key={date}><input type="checkbox" disabled={busy} checked={closed[restaurant].includes(date)} onChange={()=>setClosed(old=>({...old,[restaurant]:old[restaurant].includes(date)?old[restaurant].filter(d=>d!==date):[...old[restaurant],date]}))}/>{new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'})}</label>)}</div><p>Save these dates, then click Auto arrange Floor. Review any existing manual shifts on closed days.</p><div className="actions"><Button disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save closed days'}</Button><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button></div></DialogContent></Dialog>;
}
