import {LoginForm} from '@/components/login-form';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){const params=await searchParams;return <LoginForm initialError={typeof params.error==='string'?params.error:''}/>;}
