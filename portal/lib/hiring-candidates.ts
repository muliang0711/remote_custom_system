import {randomUUID} from 'node:crypto';
import type {LiveState} from './live-store';
import {saveLive} from './live-store';
import {hiringProgress,type Candidate} from './hiring-model';
import {log} from './demo-store';
export function hiringState(s:LiveState){return s.hiring??={candidates:[]}}
export function candidate(s:LiveState,id:string){const c=hiringState(s).candidates.find(c=>c.id===id);if(!c)throw Error('Candidate not found.');return c}
export function saveCandidate(s:LiveState,email:string,input:Record<string,string>){const h=hiringState(s);const old=input.id?candidate(s,input.id):undefined;
 const name=input.name?.trim(),address=input.email?.trim().toLowerCase(),position=input.position?.trim()||'',phone=input.phone?.trim()||'',notes=input.notes?.trim()||'';
 if(!name||name.length>160||!address||!/^[-\w.+]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(address)||address.endsWith('.example'))throw Error('Enter a name and a valid candidate email.');if(position.length>160||phone.length>60||notes.length>4000)throw Error('Position, phone or notes are too long.');
 if(s.employees?.some(e=>e.email.toLowerCase()===address))throw Error('This person is already an official employee.');
 if(h.candidates.some(c=>c.id!==old?.id&&c.email===address))throw Error('This email already has a candidate record.');if(old&&old.email!==address&&(old.ackAssignmentId||old.formAssignmentId))throw Error('The email cannot change after a tracked message has been prepared. This protects reply matching.');
 const employment=input.employment||old?.employment||'Undecided';if(!['Part-Time','Full-Time','Casual','Undecided'].includes(employment))throw Error('Choose a valid employment preference.');const now=new Date().toISOString();
 const c:Candidate={...(old||{id:randomUUID(),created:now,interview:'Pending',trial:'Pending'}),name,email:address,position,phone,notes,employment:employment as Candidate['employment'],documentsUrl:input.documentsUrl===undefined?old?.documentsUrl:input.documentsUrl||undefined,updated:now};if(old)Object.assign(old,c);else h.candidates.push(c);log(s,`${name}: candidate ${old?'updated':'added after resume review'}`);saveLive(email,s);return c;
}
export function updateHiringStage(s:LiveState,email:string,id:string,stage:string,value:string,at:string){const c=candidate(s,id),p=hiringProgress(c,s.assignments);if(!['interview','trial'].includes(stage)||!['Pending','Scheduled','Passed','Failed'].includes(value))throw Error('Invalid stage update.');if(p.completed)throw Error('This candidate has completed hiring. Their completed record is retained.');
 if(stage==='interview'&&(c.ackAssignmentId||c.trial!=='Pending')&&value!=='Passed')throw Error('Interview cannot be reset after the next stage has started.');
 if(stage==='trial'&&(c.interview!=='Passed'||!p.acknowledged))throw Error('Complete the interview and acknowledgement before arranging a trial.');if(stage==='trial'&&c.formAssignmentId&&value!=='Passed')throw Error('Trial cannot be reset after the employee form has been prepared.');
 if(value==='Scheduled'&&(!at||!Number.isFinite(Date.parse(at))))throw Error('Choose a valid scheduled date and time.');
 if(stage==='interview'){c.interview=value as Candidate['interview'];c.interviewAt=at||undefined}else{c.trial=value as Candidate['trial'];c.trialAt=at||undefined}c.updated=new Date().toISOString();log(s,`${c.name}: ${stage} ${value.toLowerCase()}`);saveLive(email,s);
}
export function deleteCandidate(s:LiveState,email:string,id:string){const c=candidate(s,id);const ids=[c.ackAssignmentId,c.formAssignmentId].filter(Boolean);s.assignments=s.assignments.filter(a=>!ids.includes(a.id));s.hiring!.candidates=s.hiring!.candidates.filter(x=>x.id!==id);log(s,`${c.name}: removed from hiring tracking`);saveLive(email,s)}
