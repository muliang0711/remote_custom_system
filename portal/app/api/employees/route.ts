import {checkWorkspaceRevision} from '@/lib/live-store';
import {localRequest,session} from '@/lib/google-auth';
import {collectFormResponses} from '@/lib/google-forms';
import {exclusive,loadLive} from '@/lib/live-store';
import {saveCandidate,deleteCandidate} from '@/lib/hiring-candidates';
import {setEmployeeStatus,assignEmployeeShops,recordSickLeave,recordAnnualLeave,promoteCandidate,updateEmployee,adjustEmployeeLevel,documentsLink} from '@/lib/employees';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{localRequest(request,true);const c=session(request);const f=await request.formData(),field=(k:string)=>String(f.get(k)||'').trim();return await exclusive(async()=>{if(session(request).email!==c.email)throw Error('Google account changed.');const s=loadLive(c.email);checkWorkspaceRevision(request,s);switch(field('action')){
 case 'sync-forms':await collectFormResponses(s,c.email);break;
 case 'candidate':{const url=documentsLink(field('documentsUrl'));saveCandidate(s,c.email,{...Object.fromEntries(['id','name','email','phone','position','notes','employment'].map(k=>[k,field(k)])),documentsUrl:url||''});break}
 case 'employee':updateEmployee(s,c.email,field('id'),Object.fromEntries(['name','phone','position','notes','type','level','casualLevel','status','documentsUrl','dateOfBirth','manualAge','department'].filter(k=>!['dateOfBirth','manualAge','department'].includes(k)||f.has(k)).map(k=>[k,field(k)])));break;
 case 'annual-leave':recordAnnualLeave(s,c.email,field('id'),Object.fromEntries(['requestId','revision','kind','date','hours','reason'].map(k=>[k,field(k)])));break;
 case 'sick-leave':recordSickLeave(s,c.email,field('id'),Object.fromEntries(['requestId','revision','kind','date','hours','reason'].map(k=>[k,field(k)])));break;
 case 'employee-status':setEmployeeStatus(s,c.email,field('id'),field('status'));break;
 case 'assign-shops':assignEmployeeShops(s,c.email,field('id'),field('shops'));break;
 case 'adjust-level':adjustEmployeeLevel(s,c.email,field('id'),field('level'));break;
 case 'promote':if(field('confirm')!=='yes')throw Error('Confirm moving this candidate to Official Employee.');promoteCandidate(s,c.email,field('id'),field('type'),field('casualLevel'));break;
 case 'delete-candidate':if(field('confirm')!=='yes')throw Error('Confirm candidate deletion.');deleteCandidate(s,c.email,field('id'));break;
 default:throw Error('Unsupported employee operation.');}return Response.json(s,{headers:{'Cache-Control':'no-store'}})})}catch(e){return Response.json({error:(e as Error).message},{status:400})}}
