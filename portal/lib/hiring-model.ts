import type {Assignment} from './demo-store';
export type Candidate={id:string;personId?:string;documentsUrl?:string;name:string;email:string;phone:string;position:string;notes:string;created:string;updated:string;employment:'Part-Time'|'Full-Time'|'Casual'|'Undecided';interview:'Pending'|'Scheduled'|'Passed'|'Failed';interviewAt?:string;trial:'Pending'|'Scheduled'|'Passed'|'Failed';trialAt?:string;ackAssignmentId?:string;formAssignmentId?:string};
export type HiringState={candidates:Candidate[];sheetId?:string;sheetTabId?:number;sheetRows?:number;sheetHash?:string;lastSynced?:string;syncError?:string;ackDocId?:string;employeeFormId?:string};
export function hiringProgress(c:Candidate,assignments:Assignment[]){
 const ack=assignments.find(a=>a.id===c.ackAssignmentId)?.recipients[0];
 const form=assignments.find(a=>a.id===c.formAssignmentId)?.recipients[0];
 const rejected=c.interview==='Failed'||c.trial==='Failed';
 const acknowledged=ack?.status==='Completed';
 const completed=!rejected&&c.interview==='Passed'&&acknowledged&&c.trial==='Passed'&&form?.status==='Completed';
 const delivery=(r:typeof ack)=>r?.delivery==='sent'?'Waiting Response':['sending','uncertain'].includes(r?.delivery||'')?'Check Delivery':r?.delivery==='failed'?'Send Failed':'Not Sent';
 const acknowledgement=c.interview==='Failed'?'—':acknowledged?'Completed':c.ackAssignmentId?delivery(ack):'Not Started';
 const stage3=rejected?c.trial==='Failed'?'Failed':'—':!acknowledged?'Not Started':c.trial;
 const employeeInformation=rejected?'—':c.trial!=='Passed'?'Not Started':form?.status==='Completed'?'Completed':c.formAssignmentId?delivery(form):'Not Sent';
 const current=rejected?'Rejected':completed?'Completed':c.interview!=='Passed'?'Interview':!acknowledged?'Acknowledgement':c.trial!=='Passed'?'Trial':'Employee Information';
 return {ack,form,acknowledged,completed,rejected,acknowledgement,stage3,employeeInformation,current,final:rejected?'Rejected':completed?'Ready for HR confirmation':'In Progress'};
}
