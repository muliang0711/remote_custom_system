import {randomUUID} from 'node:crypto';
import {saveLive,type LiveState} from './live-store';
import {candidate,hiringState} from './hiring-candidates';
import {hiringProgress} from './hiring-model';
import {prepareForm} from './google-forms';
import {deliver} from './google-workflow';
import type {Assignment} from './demo-store';
export function configureHiring(s:LiveState,email:string,ackDocId:string,employeeFormId:string){if(!ackDocId||!employeeFormId||ackDocId===employeeFormId)throw Error('Select two different Google Forms for acknowledgement and employee information.');for(const id of [ackDocId,employeeFormId])if(!s.documents.some(d=>d.id===id&&d.type==='FORM'))throw Error('Choose Google Forms from your document library.');Object.assign(hiringState(s),{ackDocId,employeeFormId});saveLive(email,s)}
export async function sendHiringForm(s:LiveState,email:string,id:string,kind:string){const c=candidate(s,id),p=hiringProgress(c,s.assignments),h=hiringState(s);if(!['ack','form'].includes(kind))throw Error('Choose a hiring form stage.');if(p.rejected||p.completed)throw Error('This hiring process is closed.');if(c.interview!=='Passed')throw Error('Pass the interview first.');if(kind==='form'&&(!p.acknowledged||c.trial!=='Passed'))throw Error('Complete acknowledgement and pass the trial first.');const key=kind==='ack'?'ackAssignmentId':'formAssignmentId';
 let a=s.assignments.find(a=>a.id===c[key]);if(a&&['sent','sending','uncertain'].includes(a.recipients[0]?.delivery||''))return;
 const doc=s.documents.find(d=>d.id===(a?.docId||(kind==='ack'?h.ackDocId:h.employeeFormId))&&d.type==='FORM');if(!doc)throw Error('Configure the Google Forms for this workflow first.');const form=await prepareForm(s,email,a?.formId||doc.driveId||doc.id);if(!form.responderUri)throw Error('Google Form responder URL is unavailable.');
 if(!a){a={id:`JYM-${new Date().toISOString().slice(0,7).replace('-','')}-${randomUUID().slice(0,8).toUpperCase()}`,name:`${kind==='ack'?'Hiring Acknowledgement':'Employee Information'} — ${c.name}`,docId:doc.id,formId:doc.driveId||doc.id,groups:[],due:'',message:`Please complete the ${kind==='ack'?'acknowledgement':'employee information'} form while signed in to the Google account ${c.email}.`,created:new Date().toISOString(),workflow:'hiring',requestId:`hiring-${c.id}-${kind}`,recipients:[{id:c.id,name:c.name,email:c.email,status:'Pending',threadId:'',delivery:'ready',rfcMessageId:randomUUID()+'@jymmanuel.local'}]};s.assignments.unshift(a);c[key]=a.id;c.updated=new Date().toISOString();saveLive(email,s)}
 await deliver(s,email,a,{...doc,url:form.responderUri});
}
