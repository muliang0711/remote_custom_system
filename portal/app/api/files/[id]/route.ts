import {localRequest} from '@/lib/google-auth';
import fs from 'node:fs';
import path from 'node:path';
import {files,load} from '@/lib/demo-store';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{localRequest(_request)}catch{return new Response('Sign in required',{status:401})}load();const {id}=await params;if(!/^[a-zA-Z0-9-]+\.pdf$/.test(id))return new Response('Not found',{status:404});try{return new Response(fs.readFileSync(path.join(files,id)),{headers:{'Cache-Control':'private, no-store','Content-Type':'application/pdf','Content-Disposition':'inline','X-Content-Type-Options':'nosniff'}})}catch{return new Response('File not found',{status:404})}}
