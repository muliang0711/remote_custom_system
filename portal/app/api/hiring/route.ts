import {checkWorkspaceRevision} from '@/lib/live-store';
import {localRequest,session} from '@/lib/google-auth';
import {exclusive,loadLive} from '@/lib/live-store';
import {hiringState,updateHiringStage} from '@/lib/hiring-candidates';
import {configureHiring,sendHiringForm} from '@/lib/hiring';
import {collectAllResponses} from '@/lib/google-workflow';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{localRequest(request,true);const c=session(request);const f=await request.formData(),field=(key:string)=>String(f.get(key)||'').trim();return await exclusive(async()=>{if(session(request).email!==c.email)throw Error('Google account changed.');const s=loadLive(c.email);checkWorkspaceRevision(request,s);hiringState(s);switch(field('action')){
 case 'stage':updateHiringStage(s,c.email,field('id'),field('stage'),field('value'),field('at'));break;
 case 'configure':configureHiring(s,c.email,field('ackDocId'),field('employeeFormId'));break;
 case 'send':if(field('confirmLive')!=='yes')throw Error('Confirm sending the form by real Gmail.');await sendHiringForm(s,c.email,field('id'),field('kind'));break;
 case 'collect':await collectAllResponses(s,c.email);break;
 default:throw Error('Unsupported hiring action.');}
 return Response.json(s,{headers:{'Cache-Control':'no-store'}})})}catch(e){return Response.json({error:(e as Error).message},{status:400})}}