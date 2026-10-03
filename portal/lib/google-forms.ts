import {randomUUID} from 'node:crypto';
import {googleJson,GoogleError} from './google-auth';
import {saveLive,type LiveState} from './live-store';
import {log} from './demo-store';
import {formOwner,buildPersonForm,importPersonForm,type GoogleForm,type GoogleResponse} from './person-forms';
const endpoint='https://forms.googleapis.com/v1/forms/';
type Form=GoogleForm;
type ResponseRecord=GoogleResponse;
function explain(e:unknown){return e instanceof GoogleError&&[403,404].includes(e.status)?'Enable Google Forms API in your Cloud project, reconnect Google with Forms response permission, and check that the connected account owns or can edit this form.':(e as Error).message}
export async function prepareForm(s:LiveState,email:string,id:string){
 try{const form=await googleJson<Form>(endpoint+encodeURIComponent(id));s.formTracking??={};
 if(form.settings?.emailCollectionType!=='VERIFIED'){delete s.formTracking[id];saveLive(email,s);throw Error('Set this Google Form: Settings → Responses → Collect email addresses → Verified. Then check responses before submitting again.');}
 s.formTracking[id]??={verifiedSince:new Date().toISOString()};saveLive(email,s);return form;
 }catch(e){throw Error(explain(e))}
}
export async function collectFormResponses(s:LiveState,email:string){
 s.formsErrors=[];s.processedFormResponses??=[];
 const groups=new Map<string,typeof s.assignments>();
 for(const a of s.assignments){if(a.workflow==='availability')continue;const doc=s.documents.find(d=>d.id===a.docId);const id=a.formId||(doc?.type==='FORM'?(doc.driveId||doc.id):undefined);if(id){a.formId=id;groups.set(id,[...(groups.get(id)||[]),a])}}
 for(const [id,assignments] of groups){try{
  const form=await prepareForm(s,email,id),since=s.formTracking![id].verifiedSince;
  let pageToken:string|undefined;const seenPages=new Set<string>();
  do{const page=await googleJson<{responses?:ResponseRecord[];nextPageToken?:string}>(endpoint+encodeURIComponent(id)+'/responses?'+new URLSearchParams({pageSize:'100',...(pageToken?{pageToken}:{})}));
   for(const response of page.responses||[]){
    if(!response.responseId)continue;
    const key=id+':'+response.responseId,created=Date.parse(response.createTime),sender=response.respondentEmail?.trim().toLowerCase()||'';
    if(!Number.isFinite(created)||created<Math.min(...assignments.map(a=>Date.parse(a.created))))continue;
    const candidates=assignments.flatMap(a=>a.recipients.filter(r=>r.email.trim().toLowerCase()===sender&&r.delivery==='sent'&&created>=Date.parse(a.created)&&(!r.formResponseId||r.formResponseId===response.responseId)&&(!r.received||created<=Date.parse(r.received))).map(r=>({a,r})));
    const matched=candidates.length===1?candidates[0]:undefined;
    const owners=matched?formOwner(s,matched.a.id):[];
    const owner=owners.length===1?owners[0]:undefined;
    // Legacy completion only stored a response ID. Re-fetch its answers even if
    // the response key was previously processed; this also covers promoted staff.
    const backfill=matched?.r.status==='Completed'&&matched.r.formResponseId===response.responseId;
    if(!owner&&s.processedFormResponses.includes(key))continue;
    const version=response.lastSubmittedTime||response.createTime;
    if(owner&&s.personForms?.[owner.personId]?.some(f=>f.formId===id&&f.responseId===response.responseId&&f.updatedAt===version))continue;
    const reason=!sender?'Response has no collected Google account email.':!backfill&&created<Date.parse(since)?'Submission predates verified-email tracking. Submit a new response with the assigned Google account.':!matched?'Form response could not be matched to exactly one sent assignment.':matched.r.status==='Completed'&&!backfill?'Additional form response after completion; check manually.':matched.a.workflow==='hiring'&&!owner?'Cannot match this submission to a single candidate or employee profile.':'';
    if(reason){
     if(!s.reviews.some(r=>r.formId===id&&r.formResponseId===response.responseId&&r.reason===reason))s.reviews.unshift({id:randomUUID(),assignmentId:candidates.map(c=>c.a.id).join(', ')||assignments.map(a=>a.id).join(', '),sender:sender||'Unknown respondent',reason,created:new Date().toISOString(),formId:id,formResponseId:response.responseId});
    }else if(matched){
     const {a,r}=matched;
     if(owner){if(!form.items?.length)throw Error('Google returned no form questions. Profile sync will retry; no answers were marked as imported.');importPersonForm(s,owner,buildPersonForm(id,owner.kind,form,response));}
     r.status='Completed';r.formResponseId=response.responseId;r.received=response.createTime;r.returnedUrl=`https://docs.google.com/forms/d/${encodeURIComponent(id)}/edit#responses`;r.returnedName='Google Form response';r.destination=owner?'Employee profile · Google Drive attachments':'Google Forms → Responses';
     log(s,`${r.name}: ${a.name} ${owner?'answers synced to profile':'response received'}`);
    }
    if(!s.processedFormResponses.includes(key))s.processedFormResponses.push(key);saveLive(email,s);
   }
   pageToken=page.nextPageToken;if(pageToken&&seenPages.has(pageToken))throw Error('Google Forms returned a repeated page token. Retry collection.');if(pageToken)seenPages.add(pageToken);
  }while(pageToken);
 }catch(e){s.formsErrors.push(`${assignments[0].name}: ${explain(e)}`)}}
 s.lastFormsChecked=new Date().toISOString();saveLive(email,s);
}
