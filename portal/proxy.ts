import {NextRequest,NextResponse} from 'next/server';
import {currentMember} from './lib/portal-auth';
import {appOrigin,validateRequest} from './lib/request-security';
export function proxy(request:NextRequest){
 try{validateRequest(request)}catch{return NextResponse.json({error:'Invalid portal address.'},{status:403})}
 const pathname=request.nextUrl.pathname;
 if(pathname==='/login'||pathname.startsWith('/api/auth/'))return NextResponse.next();
 const member=currentMember(request);
 if(!member){if(pathname.startsWith('/api/'))return NextResponse.json({error:'Sign in with your approved Google account.'},{status:401,headers:{'Cache-Control':'no-store'}});return NextResponse.redirect(new URL('/login',appOrigin()))}
 if((pathname==='/members'||pathname==='/google')&&member.role!=='admin')return NextResponse.redirect(new URL('/?mode=live',appOrigin()));
 const response=NextResponse.next();response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.svg|favicon.ico).*)']};
