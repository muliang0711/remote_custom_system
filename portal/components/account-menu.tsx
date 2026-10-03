'use client';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import type {Member} from '@/lib/portal-auth';
export function AccountMenu(){const router=useRouter();const [member,setMember]=useState<Member|null>(null);useEffect(()=>{void fetch('/api/auth/me').then(r=>{if(r.status===401){router.replace('/login');return null}return r.json() as Promise<{member:Member|null}>}).then(data=>setMember(data?.member||null))},[router]);async function logout(){const r=await fetch('/api/auth/logout',{method:'POST',headers:{'x-portal-request':'1'}});if(r.ok)router.replace('/login')}return <div className="account-menu"><strong>{member?.name||'Company workspace'}</strong><small>{member?.email}</small>{member?.role==='admin'&&<><a href="/members">Manage members</a><a href="/google">Company Google connection</a></>}<button onClick={()=>location.reload()}>Refresh workspace</button><button onClick={()=>void logout()}>Sign out</button></div>}
