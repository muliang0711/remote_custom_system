// Explicit local mock candidates. No Google calls, forms, or email deliveries.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';import assert from 'node:assert/strict';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'portal-trial-seed-'));
try{
 for(const name of ['google-auth','live-store','people-db','business-rules','shift-templates','employee-model','hiring-model','demo-store'])fs.writeFileSync(path.join(temp,name+'.mjs'),ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,n)=>`from './${n}.mjs'`));
 const load=n=>import(pathToFileURL(path.join(temp,n+'.mjs'))),auth=await load('google-auth'),store=await load('live-store'),model=await load('hiring-model');
 const connection=auth.readConnection();if(!connection)throw Error('Connect Google first.');
 const dbPath=path.join(auth.secretDir,'portal.sqlite');const db=new DatabaseSync(dbPath);db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();fs.copyFileSync(dbPath,dbPath+'.before-trial-mocks-'+Date.now()+'.bak');
 const s=store.loadLive(connection.email);s.hiring??={candidates:[]};const now=new Date().toISOString(),added=[];
 const fixtures=[['avery','Avery','Front-of-house','Part-Time','Try a 1-hour trial.'],['quinn','Quinn','Front-of-house','Casual','Try a 2-hour trial.'],['riley','Riley','Kitchen assistant','Full-Time','Try custom start and end times.'],['cameron','Cameron','Front-of-house','Part-Time','Try changing the restaurant and trial date.'],['sky','Sky','Front-of-house','Casual','Try editing, removing, and re-adding a trial.']];
 for(const [key,name,position,employment,hint] of fixtures){const id='mock-trial-candidate-'+key,ackId='MOCK-TRIAL-ACK-'+key;if(s.hiring.candidates.some(c=>c.id===id)||s.employees?.some(e=>e.sourceCandidateId===id))continue;
 const c={id,personId:id,name:'[Mock] '+name,email:id+'@demo.invalid',phone:'',position,notes:'MOCK DATA — fictional candidate for local Trial testing. Interview and acknowledgement are simulated; no email was sent. '+hint,employment,interview:'Passed',trial:'Pending',ackAssignmentId:ackId,created:now,updated:now};
 s.hiring.candidates.push(c);
 s.assignments.push({id:ackId,name:'[Mock] Trial acknowledgement — '+name,docId:'mock-trial-acknowledgement',workflow:'hiring',groups:[],due:'',message:'Local fixture only — no form or email was sent.',created:now,recipients:[{id,name:c.name,email:c.email,status:'Completed',delivery:'ready',threadId:'',received:now}]});
 added.push(c.name);
 }
 store.saveLive(connection.email,s);const saved=store.loadLive(connection.email);const mocks=saved.hiring.candidates.filter(c=>c.id.startsWith('mock-trial-candidate-'));
 for(const name of added){const c=mocks.find(c=>c.name===name);assert.ok(c);assert.equal(c.interview,'Passed');assert.equal(c.trial,'Pending');assert.equal(model.hiringProgress(c,saved.assignments).acknowledged,true);assert.equal(model.hiringProgress(c,saved.assignments).current,'Trial');}
 console.log(JSON.stringify({added,availableMockCandidates:mocks.map(c=>({name:c.name,trial:c.trial})),emailsSent:0,shiftsCreated:0}));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
