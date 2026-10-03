// Isolated tests: fake identities only; never contacts Google or modifies real company data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jym-multiuser-'));
process.env.GOOGLE_DATA_DIR=path.join(temp,'data');process.env.DEMO_DATA_DIR=path.join(temp,'demo');
process.env.PORTAL_ADMIN_EMAIL='admin@example.com';process.env.GOOGLE_POLL_INTERVAL_SECONDS='0';
process.env.GOOGLE_CLIENT_ID='test.apps.googleusercontent.com';process.env.GOOGLE_CLIENT_SECRET='test-secret';
const port=process.env.MULTIUSER_TEST_PORT||'3197';const base='http://127.0.0.1:'+port;process.env.APP_ORIGIN=base;
for(const file of fs.readdirSync('lib').filter(f=>f.endsWith('.ts'))){const name=file.slice(0,-3);const source=fs.readFileSync('lib/'+file,'utf8');fs.writeFileSync(path.join(temp,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,n)=>`from './${n}.mjs'`))}
fs.symlinkSync(path.resolve('node_modules'),path.join(temp,'node_modules'),'dir');
const load=n=>import(pathToFileURL(path.join(temp,n+'.mjs')));
const {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet}=await import('jose');const keypair=await generateKeyPair('RS256');const jwk=await exportJWK(keypair.publicKey);const keys=createLocalJWKSet({keys:[{...jwk,kid:'test',alg:'RS256'}]});const identity=await load('google-login');const claims={email:'admin@example.com',email_verified:true,nonce:'nonce'};const signed=(extra={})=>new SignJWT({...claims,...extra}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('admin-subject').setIssuer('https://accounts.google.com').setAudience(process.env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime('5m').sign(keypair.privateKey);const jwt=await signed();assert.equal((await identity.verifyGoogleIdentity(jwt,process.env.GOOGLE_CLIENT_ID,'nonce',keys)).email,claims.email);await assert.rejects(()=>identity.verifyGoogleIdentity(jwt,'wrong-audience','nonce',keys));await assert.rejects(()=>identity.verifyGoogleIdentity(jwt,process.env.GOOGLE_CLIENT_ID,'wrong-nonce',keys));await assert.rejects(async()=>identity.verifyGoogleIdentity(await signed({email_verified:false}),process.env.GOOGLE_CLIENT_ID,'nonce',keys));console.log('PASS Google identity: locally signed JWT, audience, nonce and verified-email validation.');
const auth=await load('portal-auth'),google=await load('google-auth'),store=await load('live-store');
const request=token=>new Request(base,{headers:{host:'127.0.0.1:'+port,cookie:'jym_portal='+token}});
const signIn=(n,email=n===0?'admin@example.com':`owner${n}@example.com`)=>auth.createLogin({sub:'subject-'+n,email,email_verified:true,name:'Owner '+n});
const tokens=[signIn(0)];const admin=request(tokens[0]);
for(let i=1;i<5;i++){auth.editMember(admin,{email:`owner${i}@example.com`,role:'member'});tokens.push(signIn(i))}
assert.equal(auth.listMembers().filter(m=>m.active).length,5);
assert.throws(()=>auth.editMember(admin,{email:'sixth@example.com',role:'member'}),/five/);
assert.throws(()=>signIn(6,'outsider@example.com'),/approved/);
assert.throws(()=>auth.createLogin({sub:'hijack',email:'admin@example.com',email_verified:true}),/approved/);
assert.throws(()=>auth.createLogin({sub:'subject-1',email:'owner1@example.com',email_verified:false}),/verify/);
assert.throws(()=>auth.editMember(request(tokens[1]),{email:'attacker@example.com',role:'admin'}),/administrator/);
assert.throws(()=>auth.editMember(admin,{id:auth.listMembers()[0].id,role:'member'}),/own access/);
google.saveConnection({accessToken:'fake',refreshToken:'fake',expiresAt:Date.now()+3600000,email:'company@example.com',sessionHash:'legacy',sessionExpires:0,connectedAt:new Date().toISOString()});
for(const token of tokens)assert.equal(google.session(request(token)).email,'company@example.com');
assert.throws(()=>google.session(new Request(base,{headers:{cookie:'jym_session=legacy'}})),/Sign in/);
assert.throws(()=>auth.bindCompanyMailbox('different@example.com'),/migration/);const savedConnection=google.readConnection();google.forgetConnection();assert.equal(google.session(request(tokens[1])).email,'company@example.com');google.saveConnection(savedConnection);
const snapshot=store.loadLive('company@example.com');const firstRevision=snapshot.workspaceRevision;store.saveLive('company@example.com',snapshot);assert.equal(snapshot.workspaceRevision,firstRevision,'No-op save must not invalidate edits');snapshot.lastCollected=new Date().toISOString();store.saveLive('company@example.com',snapshot);assert.equal(snapshot.workspaceRevision,firstRevision,'Polling timestamp must not invalidate edits');
const changed=store.loadLive('company@example.com');changed.groups.push({id:'seed',name:'Existing company data',members:[]});store.saveLive('company@example.com',changed);assert.ok(changed.workspaceRevision>firstRevision);assert.throws(()=>store.checkWorkspaceRevision(new Request(base,{headers:{'x-workspace-revision':String(firstRevision)}}),changed),/workspace changed/);
auth.rememberOAuth('test-state');auth.consumeOAuth('test-state');assert.throws(()=>auth.consumeOAuth('test-state'),/already used/);
const secondSession=signIn(1);auth.logout(request(tokens[1]));assert.equal(auth.currentMember(request(tokens[1])),null);assert.ok(auth.currentMember(request(secondSession)));tokens[1]=secondSession;
console.log('PASS unit: five independent sessions, allowlist, roles, verified identity, pinned company data, logout isolation, revisions and one-use OAuth state.');
let output='';const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',port],{env:process.env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/login')).status===200){ready=true;break}}catch{}if(server.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,100))}assert.ok(ready,output);
 const get=(url,token)=>fetch(base+url,{headers:token?{cookie:'jym_portal='+token}:{},redirect:'manual'});
 const post=async(url,token,fields={},revision)=>{const body=new FormData();for(const [k,v] of Object.entries(fields))body.set(k,v);return fetch(base+url,{method:'POST',headers:{origin:base,'x-portal-request':'1',...(token?{cookie:'jym_portal='+token}:{}),...(revision===undefined?{}:{'x-workspace-revision':String(revision)})},body,redirect:'manual'})};
 for(const url of ['/api/live','/api/portal','/api/members','/api/files/anything.pdf','/api/google/status','/api/finance'])assert.equal((await get(url)).status,401,url);
 assert.equal((await get('/employees')).status,307);assert.match((await (await get('/login')).text()),/Continue with Google/);
 for(const token of tokens){const r=await get('/api/live',token);assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).groups[0].name,'Existing company data')}
 assert.equal((await get('/api/members',tokens[1])).status,403);
 assert.notEqual((await post('/api/google/disconnect',tokens[1])).status,200);assert.ok(google.readConnection());
 let response=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin:'https://evil.example','x-portal-request':'1'}});assert.equal(response.status,400);
 response=await post('/api/auth/login');assert.equal(response.status,200);const login=await response.json();const loginUrl=new URL(login.url);assert.equal(loginUrl.searchParams.get('scope'),'openid email profile');assert.equal(loginUrl.searchParams.get('redirect_uri'),base+'/api/auth/callback');assert.match(response.headers.get('set-cookie'),/HttpOnly/);
 response=await get('/api/auth/callback?state=forged&code=forged');assert.equal(response.status,307);assert.match(response.headers.get('location'),/login\?error=/);
 let state=await (await get('/api/live',tokens[0])).json();
 const attempts=await Promise.all(tokens.map((token,i)=>post('/api/live',token,{action:'group',name:'Team '+i,members:`Employee ${i}, employee${i}@example.com`},state.workspaceRevision)));
 assert.equal(attempts.filter(r=>r.ok).length,1,'Only one concurrent write may use a revision');
 for(let i=0;i<5;i++)if(!attempts[i].ok){assert.match((await attempts[i].json()).error,/workspace changed/);state=await (await get('/api/live',tokens[i])).json();const r=await post('/api/live',tokens[i],{action:'group',name:'Team '+i,members:`Employee ${i}, employee${i}@example.com`},state.workspaceRevision);assert.equal(r.status,200,await r.text())}
 state=await (await get('/api/live',tokens[0])).json();assert.equal(state.groups.length,6,'All five updates and original data remain');
 const csrf=await fetch(base+'/api/live',{method:'POST',headers:{cookie:'jym_portal='+tokens[0],origin:'https://evil.example','x-portal-request':'1'}});assert.equal(csrf.status,400);
 assert.notEqual((await post('/api/live',tokens[0],{action:'group',name:'Missing revision',members:''})).status,200);
 const finance=await (await get('/api/finance?month=2026-09',tokens[0])).json();assert.equal(finance.workspaceRevision,state.workspaceRevision);
 const member=auth.listMembers().find(m=>m.email==='owner4@example.com');auth.editMember(admin,{id:member.id,role:'member',active:false});assert.equal((await get('/api/live',tokens[4])).status,401);assert.throws(()=>signIn(4),/approved/);
 const logout=await post('/api/auth/logout',tokens[2]);assert.equal(logout.status,200);assert.equal((await get('/api/live',tokens[2])).status,401);assert.equal((await get('/api/live',tokens[3])).status,200);assert.ok(google.readConnection());
 const db=new DatabaseSync(path.join(process.env.GOOGLE_DATA_DIR,'members.sqlite'));db.prepare('UPDATE login_session SET expires=0 WHERE member_id=?').run(auth.listMembers().find(m=>m.email==='owner3@example.com').id);db.close();assert.equal((await get('/api/live',tokens[3])).status,401);
 process.env.TEST_URL=base;process.env.TEST_COOKIE='jym_portal='+tokens[0];await import('./verify-demo.mjs');
 console.log('PASS HTTP: protected pages/files/APIs, independent five-user reads, admin-only connection changes, sign-in scope/PKCE cookie, CSRF, forged callback, concurrent writes, no data loss, session expiry and immediate revocation. No real Google request sent.');
}finally{server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));fs.rmSync(temp,{recursive:true,force:true})}
