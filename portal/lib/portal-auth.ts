import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export const portalCookie='jym_portal';
export const sessionSeconds=7*24*60*60;
export type Member={id:string;email:string;name:string;role:'admin'|'member';active:number};
export class AccessError extends Error {constructor(message:string,public status=401){super(message)}}
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function requestCookie(request:Request,name=portalCookie){return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||''}
export function normalizeEmail(value:string){const email=value.trim().toLowerCase();if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AccessError('Enter a valid email address.',400);return email}
function database(){
 const dir=process.env.GOOGLE_DATA_DIR||path.join(process.cwd(),'.google-data');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'members.sqlite');if(!fs.existsSync(file)){try{fs.closeSync(fs.openSync(file,'wx',0o600))}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e}}
 const db=new DatabaseSync(file);db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS member(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','member')),active INTEGER NOT NULL DEFAULT 1,google_sub TEXT UNIQUE);
 CREATE TABLE IF NOT EXISTS login_session(token_hash TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES member(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS setting(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS oauth_state(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);`);
 if(process.env.PORTAL_ADMIN_EMAIL){const email=normalizeEmail(process.env.PORTAL_ADMIN_EMAIL);db.prepare("INSERT INTO member(id,email,name,role) SELECT ?,?,'Administrator','admin' WHERE NOT EXISTS(SELECT 1 FROM member)").run(randomUUID(),email)}
 return db;
}
function using<T>(fn:(db:DatabaseSync)=>T):T{const db=database();try{return fn(db)}finally{db.close()}}
export function hasMembers(){return using(db=>!!db.prepare('SELECT 1 FROM member LIMIT 1').get())}
export function currentMember(request:Request):Member|null {const token=requestCookie(request);if(!token)return null;return using(db=>(db.prepare('SELECT m.id,m.email,m.name,m.role,m.active FROM member m JOIN login_session s ON s.member_id=m.id WHERE s.token_hash=? AND s.expires>? AND m.active=1').get(digest(token),Date.now()) as Member|undefined)||null)}
export function requireMember(request:Request){const m=currentMember(request);if(!m)throw new AccessError('Sign in with your approved Google account.');return m}
export function requireAdmin(request:Request){const m=requireMember(request);if(m.role!=='admin')throw new AccessError('Only an administrator can manage members or the company Google connection.',403);return m}
export function createLogin(identity:{sub:string;email:string;name?:string;email_verified?:boolean}){if(identity.email_verified!==true||!identity.sub)throw new AccessError('Google must verify your email address.',403);const email=normalizeEmail(identity.email);return using(db=>{
 db.exec('BEGIN IMMEDIATE');try{const m=db.prepare('SELECT * FROM member WHERE email=? AND active=1').get(email) as (Member&{google_sub:string|null})|undefined;if(!m||m.google_sub&&m.google_sub!==identity.sub)throw new AccessError('This Google account is not an approved member. Contact your administrator.',403);
 db.prepare('UPDATE member SET google_sub=?,name=? WHERE id=?').run(identity.sub,(identity.name||m.name).slice(0,100),m.id);db.prepare('DELETE FROM login_session WHERE expires<=?').run(Date.now());const token=randomBytes(32).toString('base64url');db.prepare('INSERT INTO login_session VALUES(?,?,?)').run(digest(token),m.id,Date.now()+sessionSeconds*1000);db.exec('COMMIT');return token}catch(e){db.exec('ROLLBACK');throw e}
 })}
export function logout(request:Request){using(db=>db.prepare('DELETE FROM login_session WHERE token_hash=?').run(digest(requestCookie(request))))}
export function rememberOAuth(state:string){using(db=>{db.prepare('DELETE FROM oauth_state WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO oauth_state VALUES(?,?)').run(digest(state),Date.now()+600000)})}
export function consumeOAuth(state:string){const ok=using(db=>db.prepare('DELETE FROM oauth_state WHERE hash=? AND expires>?').run(digest(state),Date.now()).changes);if(!ok)throw new AccessError('Sign-in request expired or was already used. Try again.',400)}
export function listMembers(){return using(db=>db.prepare('SELECT id,email,name,role,active FROM member ORDER BY rowid').all() as Member[])}
export function editMember(request:Request,input:{email?:string;id?:string;role?:string;active?:boolean}){const actor=requireAdmin(request);return using(db=>{db.exec('BEGIN IMMEDIATE');try{
 const role=input.role;if(role!=='admin'&&role!=='member')throw new AccessError('Choose an administrator or member role.',400);
 const active=input.active===false?0:1;let target=input.id||'';
 if(target){const old=db.prepare('SELECT * FROM member WHERE id=?').get(target) as Member|undefined;if(!old)throw new AccessError('Member not found.',404);if(old.id===actor.id&&(role!=='admin'||!active))throw new AccessError('Ask another administrator to change your own access.',400);if(active&&!old.active&&Number((db.prepare('SELECT COUNT(*) AS n FROM member WHERE active=1').get() as {n:number}).n)>=5)throw new AccessError('This workspace allows five active members.',400);db.prepare('UPDATE member SET role=?,active=? WHERE id=?').run(role,active,target);db.prepare('DELETE FROM login_session WHERE member_id=?').run(target);
 }else{if(Number((db.prepare('SELECT COUNT(*) AS n FROM member WHERE active=1').get() as {n:number}).n)>=5)throw new AccessError('This workspace allows five active members.',400);const email=normalizeEmail(input.email||'');if(db.prepare('SELECT 1 FROM member WHERE email=?').get(email))throw new AccessError('This email is already registered. Update the existing member.',400);target=randomUUID();db.prepare('INSERT INTO member(id,email,name,role) VALUES(?,?,?,?)').run(target,email,email,role)}
 db.prepare('INSERT INTO audit(actor,action,target,created) VALUES(?,?,?,?)').run(actor.email,'member-access-updated',target,new Date().toISOString());db.exec('COMMIT');return target}catch(e){db.exec('ROLLBACK');throw e}})}
// Preserve the existing mailbox-keyed workspace. Changing personal login never changes this key.
export function bindCompanyMailbox(email:string){using(db=>{db.prepare("INSERT OR IGNORE INTO setting VALUES('company-mailbox',?)").run(normalizeEmail(email));const saved=db.prepare("SELECT value FROM setting WHERE key='company-mailbox'").get() as {value:string};if(saved.value!==normalizeEmail(email))throw new AccessError('Reconnect the existing company mailbox '+saved.value+'. Changing the company mailbox requires a separate data migration.',409)})}

export function companyMailbox(){return using(db=>(db.prepare("SELECT value FROM setting WHERE key='company-mailbox'").get() as {value:string}|undefined)?.value||'')}
