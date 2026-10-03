import {checkWorkspaceRevision} from '@/lib/live-store';
import {saveEmployeeGroup} from '@/lib/employees';
import {localRequest,session} from '@/lib/google-auth';
import {loadLive,saveLive,exclusive} from '@/lib/live-store';
import {startCollector,collectorIntervalSeconds,addGoogleTemplate,collectAllResponses,sendAssignment,syncDrive,uploadTemplate,linkGoogleDocument,retryDelivery} from '@/lib/google-workflow';
import {log} from '@/lib/demo-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{localRequest(request);const c=session(request);startCollector();const s=loadLive(c.email);return Response.json({...s,availabilityTracking:{...s.availabilityTracking,enabled:collectorIntervalSeconds()>0,intervalSeconds:collectorIntervalSeconds()}},{headers:{'Cache-Control':'no-store'}})}catch(e){return Response.json({error:(e as Error).message},{status:401})}}
export async function POST(request:Request){try{localRequest(request,true);const c=session(request);if(Number(request.headers.get('content-length')||0)>16*1024*1024)throw Error('Upload must be smaller than 15 MB.');const f=await request.formData();const field=(k:string)=>String(f.get(k)||'').trim();const file=f.get('file');if(file instanceof File&&file.size>15*1024*1024)throw Error('Upload must be smaller than 15 MB.');const bytes=file instanceof File?Buffer.from(await file.arrayBuffer()):undefined;
return await exclusive(async()=>{if(session(request).email!==c.email)throw Error('Google account changed. Reload the live workspace.');const s=loadLive(c.email);checkWorkspaceRevision(request,s);switch(field('action')){
case 'sync':await syncDrive(s,c.email);break;
case 'collect':await collectAllResponses(s,c.email);break;
case 'upload':if(!bytes||!field('name'))throw Error('Choose a PDF and document name.');await uploadTemplate(s,c.email,field('name'),bytes);break;
case 'add-template':await addGoogleTemplate(s,c.email,field('id'));break;
case 'link':await linkGoogleDocument(s,c.email,field('url'),field('name'));break;
case 'send':{if(field('confirmLive')!=='yes')throw Error('Confirm real Gmail delivery before sending.');if(!/^[a-f0-9-]{36}$/.test(field('requestId')))throw Error('Missing send request identifier. Reopen the send form.');const groups=JSON.parse(field('groups'));if(!Array.isArray(groups)||groups.some(v=>typeof v!=='string'))throw Error('Choose employee groups.');await sendAssignment(s,c.email,{name:field('name'),docId:field('docId'),groups,due:field('due'),message:field('message'),requestId:field('requestId')});break;}
case 'retry-delivery':if(field('confirmLive')!=='yes')throw Error('Confirm Gmail retry.');await retryDelivery(s,c.email,field('id'));break;
case 'resolve':{const r=s.reviews.find(r=>r.id===field('id'));if(!r)throw Error('Review not found.');r.resolved=true;log(s,'Review dismissed; submission status unchanged');saveLive(c.email,s);break;}
case 'group':saveEmployeeGroup(s,c.email,Object.fromEntries(['id','original','name','description','members'].map(k=>[k,field(k)])));break;

default:throw Error('Unsupported live action. Demo reply simulation cannot change live records.');}return Response.json(s,{headers:{'Cache-Control':'no-store'}})});
}catch(e){return Response.json({error:(e as Error).message},{status:400})}}
