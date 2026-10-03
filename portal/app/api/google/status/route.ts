import {requireAdmin} from '@/lib/portal-auth';
import {appOrigin,configured,localRequest,readConnection} from '@/lib/google-auth';
export const runtime='nodejs';
export async function GET(request:Request){try{localRequest(request);requireAdmin(request);const email=readConnection()?.email||'';return Response.json({configured:configured(),connected:!!email,email,redirectUri:appOrigin()+'/api/google/callback'},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Unexpected request host.'},{status:403})}}
