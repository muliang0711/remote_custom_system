import type {Restaurant} from './shift-templates';
import type {AnnualLeaveEntry} from './annual-leave';
import type {Candidate} from './hiring-model';
export type EmployeeType='Part-Time'|'Full-Time'|'Casual';
export type OfficialEmployee={assignedShops?:Restaurant[];department?:'Floor'|'Kitchen';annualLeaveEntries?:AnnualLeaveEntry[];sickLeaveEntries?:AnnualLeaveEntry[];dateOfBirth?:string;manualAge?:number;level?:1|2;levelHistory?:{from:1|2;to:1|2;at:string;by:string}[];hourlyRate?:number;currency?:string;id:string;personId:string;name:string;email:string;phone:string;position:string;notes:string;type:EmployeeType;casualLevel?:1|2;status:'Active'|'Inactive';sourceCandidateId:string;hiringHistory:Candidate;created:string;updated:string;documentsUrl?:string};
export function employeeCategory(e:OfficialEmployee){return e.type==='Casual'?`Casual Level ${e.casualLevel}`:e.type}

export function employeeLevel(e:OfficialEmployee):1|2{return e.level??e.casualLevel??1}

// Date-only arithmetic: age is evaluated in the portal's fixed UTC+10 timezone.
export function employeeToday(now=new Date()){return new Date(now.getTime()+10*60*60*1000).toISOString().slice(0,10)}
export function validBirthDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value}
export function employeeAge(dateOfBirth?:string,asOf=employeeToday()):number|undefined{
 if(!dateOfBirth||!validBirthDate(dateOfBirth)||!validBirthDate(asOf)||dateOfBirth>asOf)return undefined;
 return Number(asOf.slice(0,4))-Number(dateOfBirth.slice(0,4))-(asOf.slice(5)<dateOfBirth.slice(5)?1:0);
}

export function profileAge(employee?:Pick<OfficialEmployee,'dateOfBirth'|'manualAge'>,asOf=employeeToday()):number|undefined{
 if(employee?.dateOfBirth)return employeeAge(employee.dateOfBirth,asOf);
 const age=employee?.manualAge;return typeof age==='number'&&Number.isInteger(age)&&age>=0&&age<=120?age:undefined;
}
