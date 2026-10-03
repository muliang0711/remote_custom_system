import {localRequest} from '@/lib/google-auth';
import {randomUUID} from 'node:crypto';
import {load,save,log,storeFile,isPdf,type Doc,type Person} from '@/lib/demo-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{localRequest(request);return Response.json(load())}catch{return Response.json({error:'Could not load local demo data.'},{status:500})}}
export async function POST(request:Request){
 try{localRequest(request,true);
 const form=await request.formData();const action=String(form.get('action')||'');const field=(k:string)=>String(form.get(k)||'').trim();
 const file=form.get('file');let bytes:Buffer|undefined;
 if(file instanceof File&&file.size){if(file.size>15*1024*1024)throw Error('Choose a file smaller than 15 MB.');bytes=Buffer.from(await file.arrayBuffer())}
 const s=load();
 if(action==='upload'){
 if(!bytes||!isPdf(bytes))throw Error('Please select a valid PDF document.');
 const d:Doc={id:randomUUID(),name:field('name')||(file as File).name.replace(/\.pdf$/i,''),type:'PDF',category:field('category')||'Operations',updated:new Date().toISOString().slice(0,10),size:`${Math.max(1,Math.round(bytes.length/1024))} KB`,file:storeFile(bytes),parentIds:['demo-templates']};s.documents.unshift(d);log(s,`${d.name} added to Templates`);
 }else if(action==='link'){
 const url=new URL(field('url'));if(url.protocol!=='https:'||!['docs.google.com','drive.google.com','forms.gle'].includes(url.hostname))throw Error('Enter a Google Drive, Docs or Forms HTTPS link.');if(!field('name'))throw Error('Document name is required.');s.documents.unshift({id:randomUUID(),name:field('name'),type:url.hostname==='forms.gle'||url.pathname.includes('/forms/')?'FORM':'DOC',category:'Templates',parentIds:['demo-templates'],updated:new Date().toISOString().slice(0,10),size:'Link',url:url.href});log(s,`${field('name')} linked to the library`);
 }else if(action==='send'){
 const doc=s.documents.find(d=>d.id===field('docId'));if(!doc)throw Error('Choose an existing document.');const ids=JSON.parse(field('groups')) as string[];if(!Array.isArray(ids))throw Error('Choose at least one group.');const selected=s.groups.filter(g=>ids.includes(g.id));const members=[...new Map(selected.flatMap(g=>g.members).map(p=>[p.email,p])).values()];if(!members.length||!field('name'))throw Error('Enter an assignment name and choose a group.');const due=field('due');if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||due<new Date().toISOString().slice(0,10)))throw Error('Choose today or a future due date.');const id=`JYM-${new Date().toISOString().slice(0,7).replace('-','')}-${randomUUID().slice(0,8).toUpperCase()}`;s.assignments.unshift({id,name:field('name'),docId:doc.id,groups:selected.map(g=>g.id),due,message:field('message'),created:new Date().toISOString(),recipients:members.map(p=>({...p,status:'Pending',threadId:'demo-'+randomUUID()}))});log(s,`${field('name')} sent to ${members.length} employees (demo)`);
 }else if(action==='reply'){
 const a=s.assignments.find(a=>a.id===field('assignmentId'));const recipient=a?.recipients.find(r=>r.email.toLowerCase()===field('sender').toLowerCase()&&r.threadId===field('threadId'));const reason=!a?'Assignment ID could not be matched.':!recipient?'Sender and email thread do not match this assignment.':!bytes||!isPdf(bytes)?'No valid PDF attachment found.':'';
 if(reason){s.reviews.unshift({id:randomUUID(),assignmentId:field('assignmentId'),sender:field('sender'),reason,created:new Date().toISOString()});log(s,'Reply held for manual review');}else if(recipient&&a){if(recipient.status==='Completed')throw Error('This recipient already has a completed submission.');recipient.status='Completed';recipient.returnedFile=storeFile(bytes!);recipient.returnedName=(file as File).name;recipient.received=new Date().toISOString();recipient.destination=`Submissions/${a.created.slice(0,7)}/${a.name}/${recipient.name}/`;log(s,`${recipient.name} returned ${a.name}`)}
 }else if(action==='resolve'){const review=s.reviews.find(r=>r.id===field('id'));if(!review)throw Error('Review item not found.');review.resolved=true;log(s,'Review dismissed; submission status unchanged');
 }else if(action==='group'){
 const name=field('name');const entries=field('members').split('\n').filter(Boolean);if(!name)throw Error('Add a group name and at least one member.');const members:Person[]=entries.map(line=>{const [n,e]=line.split(',').map(v=>v.trim());if(!n||!e||!/^\S+@\S+\.\S+$/.test(e))throw Error('Use Name, email@example.com on each line.');return {id:randomUUID(),name:n,email:e.toLowerCase()}});const existing=field('id')?s.groups.find(g=>g.id===field('id')):undefined;if(field('id')&&!existing)throw Error('Group not found.');if(existing&&field('original')!==JSON.stringify(existing))throw Error('This group changed. Reload before saving.');const data={name,description:field('description'),members:[...new Map(members.map(p=>[p.email,p])).values()].map(p=>({...p,id:existing?.members.find(old=>old.email===p.email)?.id||p.id}))};if(existing)Object.assign(existing,data);else s.groups.push({id:randomUUID(),...data});log(s,`${name} group saved`);
 }else throw Error('Unknown action.');save(s);return Response.json(s);
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to save changes.'},{status:400})}
}
