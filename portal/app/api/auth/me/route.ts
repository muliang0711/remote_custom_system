import {currentMember} from '@/lib/portal-auth';
import {validateRequest} from '@/lib/request-security';
export const runtime='nodejs';
export async function GET(request:Request){try{validateRequest(request);const member=currentMember(request);return Response.json({member},{status:member?200:401,headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Invalid request.'},{status:403})}}
