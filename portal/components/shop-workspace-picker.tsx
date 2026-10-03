'use client';
import {Store,ArrowRight} from 'lucide-react';
import {restaurants} from '@/lib/shift-templates';
import {PortalSidebar} from './portal-sidebar';
import {SidebarProvider,SidebarTrigger} from './ui/sidebar';

export function ShopWorkspacePicker({area,href,description}:{area:'finance'|'availability';href:string;description:string}){
 const title=area==='finance'?'Finance':'Availability Collection';
 return <SidebarProvider><PortalSidebar active={area}/><div className="workspace"><header className="topbar"><div><SidebarTrigger/><span>Workflows / {title}</span></div></header><main className="availability-page"><div className="page-heading"><div><p className="eyebrow">{title}</p><h1>Choose your shop</h1><p>{description}</p></div></div><div className="timetable-shop-grid">{restaurants.map(shop=><a className="panel timetable-shop-card" key={shop} href={`${href}${href.includes('?')?'&':'?'}restaurant=${shop}`}><Store size={30}/><h2>{shop}</h2><p>Floor · Kitchen</p><span>Open {title.toLowerCase()} <ArrowRight size={18}/></span></a>)}</div>{area==='finance'&&<p><a className="text-link" href="/finance?legacy=1">Previous combined reports &amp; payments →</a></p>}{area==='availability'&&<p><a className="text-link" href="/availability?restaurant=legacy">Previous unassigned collections →</a></p>}</main></div></SidebarProvider>;
}
