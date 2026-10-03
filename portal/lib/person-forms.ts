import type {LiveState} from './live-store';

export type FormKind='acknowledgement'|'employee_detail';
export type FormFile={fileId:string;fileName:string;mimeType?:string};
export type ProfileAnswer={questionId:string;label:string;description?:string;section:string;values:string[];files:FormFile[]};
export type PersonForm={formId:string;responseId:string;kind:FormKind;title:string;respondentEmail:string;submittedAt:string;updatedAt:string;syncedAt:string;answers:ProfileAnswer[]};
export type GoogleForm={settings?:{emailCollectionType?:string};responderUri?:string;info?:{title?:string};items?:{title?:string;description?:string;questionItem?:{question:{questionId:string}};questionGroupItem?:{questions:{questionId:string;rowQuestion?:{title?:string}}[]} }[]};
export type GoogleResponse={responseId:string;respondentEmail?:string;createTime:string;lastSubmittedTime?:string;answers?:Record<string,{questionId?:string;textAnswers?:{answers?:{value:string}[]};fileUploadAnswers?:{answers?:FormFile[]}}>};

export function answerSection(label:string){
 const l=label.toLowerCase();
 if(/upload|passport|resume|documentation/.test(l))return 'Documents';
 if(/emergency|relationship/.test(l))return 'Emergency contact';
 if(/bank|account number|bsb|tax file|tfn|superannuation/.test(l))return 'Payroll & superannuation';
 if(/declaration|confirm|^date:?$|date of form/.test(l))return 'Declarations';
 if(/position|working date|trial date|visa|work right/.test(l))return 'Employment & work rights';
 return 'Personal details';
}
export function formOwner(s:LiveState,assignmentId:string){
 const people=[...(s.hiring?.candidates||[]),...(s.employees||[])];
 return people.flatMap(person=>{const c='hiringHistory' in person?person.hiringHistory:person;
 const kind:FormKind|undefined=c.ackAssignmentId===assignmentId?'acknowledgement':c.formAssignmentId===assignmentId?'employee_detail':undefined;
 return kind?[{person,kind,personId:person.personId||person.id}]:[];
 });
}
export function buildPersonForm(formId:string,kind:FormKind,form:GoogleForm,response:GoogleResponse):PersonForm{
 const questions=new Map<string,{label:string;description?:string}>();
 for(const item of form.items||[]){if(item.questionItem)questions.set(item.questionItem.question.questionId,{label:item.title||'Untitled question',description:item.description});
 for(const q of item.questionGroupItem?.questions||[])questions.set(q.questionId,{label:[item.title,q.rowQuestion?.title].filter(Boolean).join(' — '),description:item.description});}
 const ids=[...new Set([...questions.keys(),...Object.keys(response.answers||{})])];
 const answers=ids.map(questionId=>{const question=questions.get(questionId),answer=response.answers?.[questionId],label=question?.label||`Question ${questionId}`;
 return {questionId,label,description:question?.description,section:answerSection(label),values:answer?.textAnswers?.answers?.map(a=>a.value)||[],files:answer?.fileUploadAnswers?.answers||[]};});
 return {formId,responseId:response.responseId,kind,title:form.info?.title||(kind==='acknowledgement'?'Acknowledgement':'Employee Detail'),respondentEmail:response.respondentEmail||'',submittedAt:response.createTime,updatedAt:response.lastSubmittedTime||response.createTime,syncedAt:new Date().toISOString(),answers};
}
export function latestPersonForms(forms:PersonForm[]=[]){return (['acknowledgement','employee_detail'] as const).map(kind=>forms.filter(f=>f.kind===kind).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0]).filter((f):f is PersonForm=>!!f);}
export function importPersonForm(s:LiveState,owner:ReturnType<typeof formOwner>[number],submission:PersonForm){
 s.personForms??={};const records=s.personForms[owner.personId]??=[];
 if(records.some(f=>f.formId===submission.formId&&f.responseId===submission.responseId&&f.updatedAt===submission.updatedAt))return false;
 records.push(submission);
 // Employee details take precedence over acknowledgement regardless of fetch order.
 const latest=latestPersonForms(records).reverse();
 const value=(pattern:RegExp)=>latest.flatMap(f=>f.answers.filter(a=>pattern.test(a.label.trim())).flatMap(a=>a.values)).find(v=>v.trim());
 const name=value(/^full (legal name|name\s*\(as per id\))/i),phone=value(/^contact number\s*:?$/i),position=value(/^position( applied for)?\s*:?$/i);
 if(name&&name.length<=160)owner.person.name=name.trim();
 if(phone&&phone.length<=60)owner.person.phone=phone.trim();
 if(position&&position.length<=160)owner.person.position=position.trim();
 owner.person.updated=new Date().toISOString();
 return true;
}
