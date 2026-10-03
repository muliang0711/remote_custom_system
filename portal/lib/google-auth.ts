import {requireMember,bindCompanyMailbox,companyMailbox} from './portal-auth';
import {validateRequest} from './request-security';
import fs from 'node:fs';
import path from 'node:path';
import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
export const secretDir=process.env.GOOGLE_DATA_DIR||path.join(process.cwd(),'.google-data');
export const appOrigin=()=>process.env.APP_ORIGIN||'http://127.0.0.1:3000';
export const scopes=['https://www.googleapis.com/auth/forms.responses.readonly','https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/drive.readonly','https://www.googleapis.com/auth/drive.file'];
export type Connection={accessToken:string;refreshToken:string;expiresAt:number;email:string;sessionHash:string;sessionExpires:number;connectedAt:string};
export function clientConfig():{clientId:string;clientSecret:string}|null{if(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET)return {clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET};const p=path.join(secretDir,'oauth-client.enc');return fs.existsSync(p)?decrypt<{clientId:string;clientSecret:string}>(fs.readFileSync(p,'utf8')):null}
export function configured(){return !!clientConfig()}
export function saveClientConfig(clientId:string,clientSecret:string){const content=encrypt({clientId,clientSecret});fs.writeFileSync(path.join(secretDir,'oauth-client.enc'),content,{mode:0o600})}
function key(){fs.mkdirSync(secretDir,{recursive:true,mode:0o700});const p=path.join(secretDir,'encryption.key');if(!fs.existsSync(p))fs.writeFileSync(p,randomBytes(32),{mode:0o600,flag:'wx'});return fs.readFileSync(p)}
export function encrypt(value:unknown){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url')}
export function decrypt<T>(value:string):T{const b=Buffer.from(value,'base64url');const cipher=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString())}
export function readConnection():Connection|null{const p=path.join(secretDir,'connection.enc');return fs.existsSync(p)?decrypt<Connection>(fs.readFileSync(p,'utf8')):null}
export function saveConnection(c:Connection){const p=path.join(secretDir,'connection.enc');const encrypted=encrypt(c);fs.writeFileSync(p+'.tmp',encrypted,{mode:0o600});fs.renameSync(p+'.tmp',p)}
export function forgetConnection(){const p=path.join(secretDir,'connection.enc');if(fs.existsSync(p))fs.unlinkSync(p)}
export function hash(value:string){return createHash('sha256').update(value).digest('hex')}
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export function cookie(request:Request,name:string){return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||''}
export function session(request:Request){requireMember(request);const c=readConnection();if(c)bindCompanyMailbox(c.email);const email=companyMailbox();if(!email)throw Error('Ask an administrator to connect the company Google account.');return {email}}
export function localRequest(request:Request,mutation=false){validateRequest(request,mutation);requireMember(request)}
export class GoogleError extends Error {status:number;constructor(status:number){super(status===401?'Google authorization expired. Reconnect your account.':status===403?'Google denied access. Check enabled APIs, granted permissions and file access.':status===429?'Google rate limit reached. Try again later.':`Google API request failed (${status}).`);this.status=status}}
async function tokenRequest(body:URLSearchParams){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body,signal:AbortSignal.timeout(30000),cache:'no-store'});if(!r.ok)throw new GoogleError(r.status);return await r.json() as {access_token:string;refresh_token?:string;expires_in:number;scope?:string}}
export async function exchangeCode(code:string,verifier:string){return tokenRequest(new URLSearchParams({code,client_id:clientConfig()!.clientId,client_secret:clientConfig()!.clientSecret,redirect_uri:appOrigin()+'/api/google/callback',grant_type:'authorization_code',code_verifier:verifier}))}
let refreshPromise:Promise<string>|undefined;
async function accessToken(){const c=readConnection();if(!c)throw Error('Connect your Google account first.');if(c.expiresAt>Date.now()+60000)return c.accessToken;if(!refreshPromise)refreshPromise=(async()=>{try{const t=await tokenRequest(new URLSearchParams({client_id:clientConfig()!.clientId,client_secret:clientConfig()!.clientSecret,refresh_token:c.refreshToken,grant_type:'refresh_token'}));const latest=readConnection();if(!latest||latest.email!==c.email)throw Error('Google connection changed.');saveConnection({...latest,accessToken:t.access_token,expiresAt:Date.now()+t.expires_in*1000});return t.access_token}finally{refreshPromise=undefined}})();return refreshPromise}
export async function googleFetch(url:string,init:RequestInit={}){const parsed=new URL(url);if(parsed.protocol!=='https:'||!['www.googleapis.com','gmail.googleapis.com','forms.googleapis.com','sheets.googleapis.com'].includes(parsed.hostname))throw Error('Unsupported Google API endpoint.');const response=await fetch(url,{...init,headers:{...init.headers,Authorization:`Bearer ${await accessToken()}`},cache:'no-store',signal:AbortSignal.timeout(45000)});if(!response.ok)throw new GoogleError(response.status);return response}
export async function googleJson<T>(url:string,init:RequestInit={}):Promise<T>{return await(await googleFetch(url,init)).json() as T}
