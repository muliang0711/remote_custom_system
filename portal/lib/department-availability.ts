import type {OfficialEmployee} from './employee-model';
import {restaurants,type Restaurant} from './shift-templates';
export type Department='Floor'|'Kitchen';
export const departmentKey=(shop:string,department:string)=>`department:${shop}:${department}`;
export function departmentScope(key:string){const match=/^department:(CARLTONS|SPENCER):(Floor|Kitchen)$/.exec(key);return match?{restaurant:match[1] as Restaurant,department:match[2] as Department}:undefined;}
export function departmentRecipients(employees:OfficialEmployee[],shop:Restaurant,department:Department){
 if(!restaurants.includes(shop))return [];
 const byEmail=new Map<string,OfficialEmployee[]>();
 for(const e of employees){if(e.status!=='Active')continue;const email=e.email.trim().toLowerCase();if(!email)continue;byEmail.set(email,[...(byEmail.get(email)||[]),e]);}
 return [...byEmail.entries()].flatMap(([email,records])=>{const types=new Set(records.map(e=>e.department).filter(Boolean));if(types.size>1)return [];const e=records.find(e=>e.department===department&&e.assignedShops?.includes(shop));return e?[{id:e.id,name:e.name,email}]:[];});
}
