import {NextResponse} from 'next/server';
import {logout,portalCookie} from '@/lib/portal-auth';
import {validateRequest} from '@/lib/request-security';
export const runtime='nodejs';
export async function POST(request:Request){try{validateRequest(request,true);logout(request);const response=NextResponse.json({ok:true});response.cookies.set(portalCookie,'',{path:'/',maxAge:0});return response}catch{return Response.json({error:'Invalid request.'},{status:403})}}
