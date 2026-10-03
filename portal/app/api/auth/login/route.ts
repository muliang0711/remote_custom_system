import {NextResponse} from 'next/server';
import {randomBytes,createHash} from 'node:crypto';
import {encrypt} from '@/lib/google-auth';
import {loginConfig} from '@/lib/google-login';
import {hasMembers,rememberOAuth} from '@/lib/portal-auth';
import {appOrigin,validateRequest,secureCookies} from '@/lib/request-security';
export const runtime='nodejs';
export async function POST(request:Request){try{validateRequest(request,true);const config=loginConfig();if(!config||!hasMembers())return NextResponse.json({error:'Ask the server administrator to configure Google sign-in and the initial administrator email.'},{status:503});const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url'),nonce=randomBytes(32).toString('base64url');rememberOAuth(state);const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:appOrigin()+'/api/auth/callback',response_type:'code',scope:'openid email profile',prompt:'select_account',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();const response=NextResponse.json({url:url.href},{headers:{'Cache-Control':'no-store'}});response.cookies.set('jym_login',encrypt({state,verifier,nonce,expires:Date.now()+600000}),{httpOnly:true,secure:secureCookies(),sameSite:'lax',path:'/api/auth',maxAge:600});return response}catch{return NextResponse.json({error:'Could not start sign-in. Check the configured portal address.'},{status:400})}}
