export const appOrigin=()=>process.env.APP_ORIGIN||'http://127.0.0.1:3000';
export function validateRequest(request:Request,mutation=false){
 const expected=new URL(appOrigin());const local=['localhost','127.0.0.1','[::1]'].includes(expected.hostname);
 if(expected.username||expected.password||expected.pathname!=='/'||expected.search||expected.hash||(!local&&expected.protocol!=='https:')||!['http:','https:'].includes(expected.protocol))throw Error('APP_ORIGIN must be an HTTPS origin (HTTP is allowed only on localhost).');
 if(request.headers.get('host')!==expected.host)throw Error('Unexpected request host.');
 if(mutation&&(request.headers.get('origin')!==expected.origin||request.headers.get('x-portal-request')!=='1'))throw Error('Request must originate from the portal.');
}
export const secureCookies=()=>new URL(appOrigin()).protocol==='https:';
