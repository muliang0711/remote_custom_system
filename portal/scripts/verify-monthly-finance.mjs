import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'portal-monthly-finance-'));
process.env.GOOGLE_DATA_DIR=path.join(temp,'data');
try{
 for(const name of ['roster-month','trial-finance','monthly-finance','finance-model','floor-planning','roster-reports','roster-model','timetable-model','employee-model','pay-rates','business-rules','live-store','people-db','portal-auth','request-security','google-auth','shift-templates'])fs.writeFileSync(path.join(temp,name+'.mjs'),ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,n)=>`from './${n}.mjs'`));
 const load=name=>import(pathToFileURL(path.join(temp,name+'.mjs'))),m=await load('monthly-finance'),{checkoutWeek}=await load('finance-model'),store=await load('live-store');
 const s=store.loadLive('finance@example.com'),now=new Date('2026-11-05T12:00:00Z');
 const employee={id:'e1',personId:'p1',sourceCandidateId:'c1',hiringHistory:{id:'c1'},name:'Test Person',email:'person@example.invalid',phone:'123',position:'Floor staff',type:'Part-Time',level:1,status:'Active',dateOfBirth:'2000-01-01',created:'2026-07-01',updated:'2026-07-01'};
 s.employees=[employee];
 const shift=(id,date,end='19:00')=>({id,employeeId:'e1',employee:{...employee},date,start:'08:00',end,breakMinutes:60,restaurant:'CARLTONS',category:'Floor',notes:'',created:'2026-07-01',updated:'2026-07-01',ruleVersion:1,actual:{start:'08:00',end,breakMinutes:60,employeeType:'Part-Time',confirmedAt:'2026-10-05T12:00:00Z'}});
 const week='2026-09-28';s.rosters=[{weekStart:week,revision:1,shifts:[shift('sep','2026-09-30'),shift('oct','2026-10-01')],manualAvailability:[],updated:'2026-07-01'}];
 assert.equal(m.monthlyReport(s,'2026-09').pending.length,1);assert.equal(m.monthlyReport(s,'2026-09').rows.length,0);
 const input={week,revision:1,previousId:'',confirmEarly:true,confirmReplace:true,through:'2026-09-30',reason:'Month-end handover'};
 const first=checkoutWeek(s,input,'roster-owner','h1',new Date('2026-10-01'));
 assert.equal(first.details.length,1);assert.equal(m.monthlyReport(s,'2026-09').rows[0].payableCents,26440);assert.equal(m.monthlyReport(s,'2026-09').pending.length,0);assert.equal(m.monthlyReport(s,'2026-10').pending.length,1);assert.equal(m.monthlyReport(s,'2026-10').rows.length,0);
 let sept=m.monthlyReport(s,'2026-09');
 assert.throws(()=>m.settleMonth(s,{month:'2026-09',sourceKey:sept.sourceKey,previousId:'',reason:'',confirm:true},'finance','s0',new Date('2026-09-30T13:59:59Z')),/has not ended/);
 const close=(month,id,reason='')=>{const r=m.monthlyReport(s,month);return m.settleMonth(s,{month,sourceKey:r.sourceKey,previousId:r.settlement?.id||'',reason,confirm:true},'finance',id,now);};
 const closed=close('2026-09','s1');assert.equal(closed.version,1);
 input.previousId='h1';input.through='2026-10-04';checkoutWeek(s,input,'roster-owner','h2',now);
 assert.equal(m.monthlyReport(s,'2026-10').rows[0].payableCents,26440);assert.equal(m.monthlyReport(s,'2026-09').changed,false);assert.equal(m.monthlyReport(s,'2026-09').rows[0].payableCents,26440);
 assert.throws(()=>checkoutWeek(s,{...input,previousId:'h2',through:'2026-09-30'},'roster-owner','bad',now),/previously submitted/);
 // October edits cannot reopen September.
 s.rosters[0].shifts[1].end='20:00';s.rosters[0].revision=2;
 assert.equal(m.monthlyReport(s,'2026-10').pending.length,1);assert.equal(m.monthlyReport(s,'2026-09').changed,false);
 assert.throws(()=>close('2026-10','blocked'),/checkout/);
 input.revision=2;input.previousId='h2';checkoutWeek(s,input,'roster-owner','h3',now);assert.equal(m.monthlyReport(s,'2026-09').changed,false);assert.equal(m.monthlyReport(s,'2026-10').rows[0].payableCents,29084);
 // Frozen month, stale writes, and partial payments.
 let requestId=0;const payment=(amount,kind='payment',id)=>{const r=m.monthlyReport(s,'2026-09');return m.recordPayment(s,{month:'2026-09',settlementId:r.settlement.id,employeeId:'e1',amount,kind,date:'2026-11-01',reference:'TEST TRANSFER',requestId:id||`00000000-0000-0000-0000-${String(++requestId).padStart(12,'0')}`,confirm:true},'finance',`p${requestId}`,now);};
 payment('100');assert.equal(m.paymentBalance(s,closed,'e1').balance,16440);
 const pid='00000000-0000-0000-0000-999999999999';payment('164.40','payment',pid);payment('164.40','payment',pid);assert.equal(s.financePayments.length,2);assert.equal(m.paymentBalance(s,closed,'e1').balance,0);assert.throws(()=>payment('0.01'),/exceeds/);
 // A correction after payment needs checkout, then revised settlement, with a traceable difference.
 s.rosters[0].shifts[0].end='18:00';s.rosters[0].revision=3;
 assert.equal(m.monthlyReport(s,'2026-09').changed,true);assert.throws(()=>payment('1'),/current monthly settlement/);
 input.previousId='h3';input.revision=3;assert.throws(()=>checkoutWeek(s,{...input,reason:''},'roster-owner','blocked',now),/reason/);
 checkoutWeek(s,input,'roster-owner','h4',now);assert.throws(()=>close('2026-09','blocked'),/reason/);
 const revised=close('2026-09','s2','One fewer actual hour');assert.equal(revised.rows[0].payableCents,23796);assert.equal(closed.rows[0].payableCents,26440);assert.equal(m.paymentBalance(s,revised,'e1').balance,-2644);
 assert.throws(()=>payment('26.45','recovery'),/exceeds/);payment('26.44','recovery');assert.equal(m.paymentBalance(s,revised,'e1').balance,0);
 const csv=m.monthlyCSV(s,'2026-09','details','s1');assert.ok(csv.includes('2026-09-30'));assert.ok(!csv.includes('"2026-10-01"'));assert.ok(csv.includes('264.40'));assert.ok(csv.includes('roster-owner'));
 assert.ok(m.monthlyCSV(s,'2026-09','summary','s2').includes('237.96'));
 assert.throws(()=>m.settleMonth(s,{month:'2026-09',sourceKey:'stale',previousId:'s1',reason:'',confirm:true},'finance','bad',now),/changed/);
 // Deletion is held pending until explicitly handed over, then produces a recovery balance.
 s.rosters[0].shifts=s.rosters[0].shifts.filter(sh=>sh.id!=='sep');s.rosters[0].revision=4;assert.equal(m.monthlyReport(s,'2026-09').pending[0].reason,'Removed or moved after checkout');
 input.previousId='h4';input.revision=4;checkoutWeek(s,input,'roster-owner','h5',now);const cleared=close('2026-09','s3','Shift removed');assert.equal(cleared.rows[0].payableCents,0);assert.equal(m.paymentBalance(s,cleared,'e1').balance,-23796);
 // Checkout confirms timetable hours even when the old actual record was removed.
 s.rosters[0].shifts[0].actual=undefined;s.rosters[0].revision=5;input.previousId='h5';input.revision=5;checkoutWeek(s,input,'roster-owner','h6',now);assert.equal(m.monthlyReport(s,'2026-10').rows[0].payableCents,29084);assert.equal(m.monthlyReport(s,'2026-10').rows[0].unconfirmed,0);
 assert.equal(m.monthDates('2028-02').length,29);assert.equal(m.monthDates('2026-02').length,28);assert.throws(()=>m.monthDates('2026-13'),/valid month/);
 store.saveLive('finance@example.com',s);assert.equal(store.loadLive('finance@example.com').financeSettlements.length,3);assert.equal(store.loadLive('finance@example.com').financePayments.length,3);assert.equal(store.loadLive('other@example.com').financePayments,undefined);
 process.env.PORTAL_ADMIN_EMAIL='test-admin@example.com';const portal=await load('portal-auth');const portalToken=portal.createLogin({sub:'test-admin',email:process.env.PORTAL_ADMIN_EMAIL,email_verified:true});const auth=await load('google-auth');auth.saveConnection({accessToken:'fake',refreshToken:'fake',expiresAt:Date.now()+60000,email:'finance@example.com',sessionHash:auth.hash('test-cookie'),sessionExpires:Date.now()+60000,connectedAt:new Date().toISOString()});
 fs.writeFileSync(path.join(temp,'route.mjs'),ts.transpileModule(fs.readFileSync('app/api/finance/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]@\/lib\/([^'"]+)['"]/g,(_,n)=>`from './${n}.mjs'`));
 const api=await load('route'),headers={host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','x-portal-request':'1',cookie:'jym_portal='+portalToken,get 'x-workspace-revision'(){return String(store.loadLive(auth.readConnection().email).workspaceRevision)}};
 let response=await api.GET(new Request('http://127.0.0.1:3000/api/finance?month=2026-09',{headers}));assert.equal(response.status,200);assert.equal((await response.json()).report.settlement.id,'s3');
 response=await api.GET(new Request('http://127.0.0.1:3000/api/finance?month=2026-09&kind=summary&settlement=s1',{headers}));assert.equal(response.status,200);assert.match(await response.text(),/264.40/);
 assert.equal((await api.GET(new Request('http://127.0.0.1:3000/api/finance?month=2026-13',{headers}))).status,400);
 assert.equal((await api.GET(new Request('http://127.0.0.1:3000/api/finance?month=2026-09',{headers:{host:headers.host}}))).status,400);
 const form=new FormData();for(const [k,v] of Object.entries({action:'settle',month:'2026-10',sourceKey:m.monthlyReport(s,'2026-10').sourceKey,confirm:'yes'}))form.set(k,v);
 assert.equal((await api.POST(new Request('http://127.0.0.1:3000/api/finance',{method:'POST',headers,body:form}))).status,400);assert.equal(store.loadLive('finance@example.com').financeSettlements.length,3);
 const recovered=new FormData();for(const [k,v] of Object.entries({action:'payment',month:'2026-09',settlementId:'s3',employeeId:'e1',amount:'237.96',kind:'recovery',date:'2026-09-01',reference:'TEST RECOVERY',requestId:'00000000-0000-0000-0000-888888888888',confirm:'yes'}))recovered.set(k,v);
 response=await api.POST(new Request('http://127.0.0.1:3000/api/finance',{method:'POST',headers,body:recovered}));assert.equal(response.status,200);assert.equal(store.loadLive('finance@example.com').financePayments.length,4);
 response=await api.POST(new Request('http://127.0.0.1:3000/api/finance',{method:'POST',headers,body:recovered}));assert.equal(response.status,200);assert.equal(store.loadLive('finance@example.com').financePayments.length,4);
 assert.equal((await api.POST(new Request('http://127.0.0.1:3000/api/finance',{method:'POST',headers:{...headers,origin:'https://other.invalid'},body:recovered}))).status,400);
 console.log('PASS: monthly API authentication, calendar month validation, versioned exports, blocked close with no persistence, idempotent payment recording and cross-origin rejection.');
 console.log('PASS: monthly date attribution, partial month-end handover, no duplicate hours, unchanged adjacent month, pending edits/deletions, owner audit, frozen month revisions, actual-work gates, partial/idempotent payments, overpayment recovery, CSV snapshots and SQLite account isolation.');
 // Supply read-only UI fixtures separately from the real workspace.
 if(process.env.FINANCE_FIXTURE_PATH){const demo=structuredClone(s);demo.financeRecords=[];demo.financeSettlements=[];demo.financePayments=[];demo.rosters=[{weekStart:'2026-08-24',revision:1,shifts:[shift('ui1','2026-08-25'),shift('ui2','2026-08-26','17:00')],manualAvailability:[],updated:'2026-09-01'}];checkoutWeek(demo,{week:'2026-08-24',revision:1,previousId:'',confirmEarly:true,confirmReplace:false},'roster.manager@example.invalid','ui-handoff',now);fs.writeFileSync(process.env.FINANCE_FIXTURE_PATH,JSON.stringify(demo));}
}finally{fs.rmSync(temp,{recursive:true,force:true});}
