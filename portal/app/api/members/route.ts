import {requireAdmin,listMembers,editMember,AccessError} from '@/lib/portal-auth';
import {validateRequest} from '@/lib/request-security';
export const runtime='nodejs';
const failure=(e:unknown)=>Response.json({error:e instanceof Error?e.message:'Request failed.'},{status:e instanceof AccessError?e.status:400,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){try{validateRequest(request);requireAdmin(request);return Response.json({members:listMembers()},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
export async function POST(request:Request){try{validateRequest(request,true);requireAdmin(request);if(Number(request.headers.get('content-length'))>4096)throw Error('Request too large.');const body=await request.json() as Parameters<typeof editMember>[1];editMember(request,body);return Response.json({members:listMembers()},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
