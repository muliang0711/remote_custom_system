import {requireAdmin} from '@/lib/portal-auth';
import {localRequest,session,forgetConnection} from '@/lib/google-auth';
import {NextResponse} from 'next/server';
import {exclusive} from '@/lib/live-store';
export const runtime='nodejs';
export async function POST(request:Request){try{localRequest(request,true);requireAdmin(request);session(request);await exclusive(async()=>{requireAdmin(request);forgetConnection()});const r=NextResponse.json({ok:true});r.cookies.set('jym_session','',{path:'/',maxAge:0});return r}catch(e){return Response.json({error:(e as Error).message},{status:400})}}
