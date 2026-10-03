'use client';
import {useState} from 'react';
import {ArrowUpRight,FileText,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {latestPersonForms,type PersonForm,type ProfileAnswer} from '@/lib/person-forms';

const sections=['Personal details','Employment & work rights','Emergency contact','Payroll & superannuation','Documents','Declarations'];
function Answer({answer}:{answer:ProfileAnswer}){return <div className="profile-answer"><dt>{answer.label}</dt><dd>{answer.values.length?answer.values.map((v,i)=><p key={i}>{v||'Not provided'}</p>):!answer.files.length?<span className="muted">Not provided</span>:null}{answer.files.map(file=><a className="profile-file" key={file.fileId} href={`https://drive.google.com/file/d/${encodeURIComponent(file.fileId)}/view`} target="_blank" rel="noreferrer"><FileText size={18}/><span>{file.fileName||'Open uploaded document'}<small>{file.mimeType||'Google Drive'}</small></span><ArrowUpRight size={16}/></a>)}</dd></div>}
export function PersonFormDetails({forms=[],busy,onSync}:{forms?:PersonForm[];busy:boolean;onSync:()=>void}){
 const [tab,setTab]=useState('summary');const latest=latestPersonForms(forms);
 // Same field from Employee Detail supersedes acknowledgement in the overview.
 const answers=new Map<string,ProfileAnswer>();for(const form of latest)for(const a of form.answers)answers.set(a.label.trim().toLowerCase(),a);
 return <section className="person-form-details"><div className="profile-section-heading"><div><h2>Submitted information</h2><p>Both forms, saved with this person.</p></div><Button variant="outline" disabled={busy} onClick={onSync}><RefreshCw size={16}/>{busy?'Syncing…':'Sync forms'}</Button></div>
 <div className="profile-form-status">{(['acknowledgement','employee_detail'] as const).map(kind=>{const form=latest.find(f=>f.kind===kind);return <article key={kind}><strong>{kind==='acknowledgement'?'Acknowledgement':'Employee Detail'}</strong><span className={'status '+(form?'completed':'pending')}>{form?'Synced':'Not synced yet'}</span><small>{form?`Submitted ${new Date(form.updatedAt).toLocaleString()}`:'Sync to check for an existing submission.'}</small></article>})}</div>
 {!latest.length?<p className="profile-empty">No answers have been imported yet. Sync forms to collect submissions made with the assigned Google account.</p>:<Tabs value={tab} onValueChange={setTab}><TabsList className="profile-tabs"><TabsTrigger value="summary">All information</TabsTrigger><TabsTrigger value="acknowledgement">Acknowledgement</TabsTrigger><TabsTrigger value="employee_detail">Employee Detail</TabsTrigger></TabsList>
 <TabsContent value="summary"><div className="profile-section-grid">{sections.map(section=>{const items=[...answers.values()].filter(a=>a.section===section);return items.length?<section key={section} className={'profile-information '+(section==='Documents'||section==='Declarations'?'profile-full':'')}><h3>{section}</h3><dl>{items.map(a=><Answer key={a.questionId+a.label} answer={a}/>)}</dl></section>:null})}</div></TabsContent>
 {(['acknowledgement','employee_detail'] as const).map(kind=>{const form=latest.find(f=>f.kind===kind);return <TabsContent value={kind} key={kind}>{form?<section className="profile-information"><div className="profile-section-heading"><div><h3>{form.title}</h3><p>Google account: {form.respondentEmail}</p><p>Last synced {new Date(form.syncedAt).toLocaleString()}</p></div><a className="text-link" target="_blank" rel="noreferrer" href={`https://docs.google.com/forms/d/${encodeURIComponent(form.formId)}/edit#responses`}>Original form <ArrowUpRight size={14}/></a></div><dl>{form.answers.map(a=><Answer key={a.questionId} answer={a}/>)}</dl></section>:<p className="profile-empty">This form has not been synced yet.</p>}</TabsContent>})}
 </Tabs>}
 </section>;
}
