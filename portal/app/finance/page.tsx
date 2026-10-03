import {ShopWorkspacePicker} from '@/components/shop-workspace-picker';
import {restaurants,type Restaurant} from '@/lib/shift-templates';
import {FinanceWorkspace} from '@/components/finance-workspace';
import {TrialFinanceWorkspace} from '@/components/trial-finance-workspace';
import {localClock} from '@/lib/timetable-model';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string;date?:string;restaurant?:string;legacy?:string}>}){const params=await searchParams;return params.view==='trial'&&restaurants.includes(params.restaurant as Restaurant)?<TrialFinanceWorkspace restaurant={params.restaurant as Restaurant} initialDate={params.date||localClock(new Date(),'Etc/GMT-10').date}/>:params.legacy==='1'?<FinanceWorkspace/>:restaurants.includes(params.restaurant as Restaurant)?<FinanceWorkspace restaurant={params.restaurant as Restaurant}/>:<ShopWorkspacePicker area="finance" href="/finance" description="Each shop has its own monthly payroll, settlement and payment status."/>}
