import {restaurants,type Restaurant} from './shift-templates';
import {leaveBalance,type LeaveType,type AnnualLeaveEntry} from './annual-leave';
import {randomUUID} from 'node:crypto';
import {saveLive,type LiveState} from './live-store';
import {candidate} from './hiring-candidates';
import {hiringProgress} from './hiring-model';
import {employeeToday,validBirthDate,employeeLevel,type OfficialEmployee,type EmployeeType} from './employee-model';
import {log} from './demo-store';
export function documentsLink(value:string){if(!value)return undefined;let u:URL;try{u=new URL(value)}catch{throw Error('Enter a Google Drive folder URL.')}if(u.protocol!=='https:'||u.hostname!=='drive.google.com'||!/^\/drive\/(?:u\/\d+\/)?folders\/[-\w]+\/?$/.test(u.pathname))throw Error('Use the Google Drive folder link containing this person’s documents.');return u.href}
function category(type:string,level:string){if(!['Part-Time','Full-Time','Casual'].includes(type))throw Error('Choose Part-time, Full-time or Casual.');if(type==='Casual'&&!['1','2'].includes(level))throw Error('Choose Casual Level 1 or Level 2.');if(level&&!['1','2'].includes(level))throw Error('Choose Level 1 or Level 2.');return {type:type as EmployeeType,level:Number(level||1) as 1|2,casualLevel:type==='Casual'?Number(level) as 1|2:undefined}}
export function promoteCandidate(s:LiveState,email:string,id:string,type:string,level:string){const existing=s.employees?.find(e=>e.sourceCandidateId===id);if(existing)return existing;const c=candidate(s,id);if(!hiringProgress(c,s.assignments).completed)throw Error('Complete all hiring stages and the Employee Information Form before moving to Official Employee.');const selected=category(type,level),now=new Date().toISOString();const e:OfficialEmployee={id:randomUUID(),personId:c.personId||c.id,name:c.name,email:c.email,phone:c.phone,position:c.position,notes:c.notes,...selected,status:'Active',sourceCandidateId:c.id,hiringHistory:{...c},created:now,updated:now,documentsUrl:c.documentsUrl};s.employees??=[];s.employees.push(e);s.hiring!.candidates=s.hiring!.candidates.filter(p=>p.id!==id);log(s,`${c.name}: HR confirmed transfer to Official Employee`);saveLive(email,s);return e}
export function updateEmployee(s:LiveState,email:string,id:string,input:Record<string,string>){const e=s.employees?.find(e=>e.id===id);if(!e)throw Error('Employee not found.');const name=input.name.trim();if(!name||name.length>160||input.phone.length>60||input.position.length>160||input.notes.length>4000)throw Error('Check the name, phone, position and notes lengths.');if(!['Active','Inactive'].includes(input.status))throw Error('Choose Active or Inactive.');const birth=input.dateOfBirth===undefined?e.dateOfBirth:input.dateOfBirth.trim();if(birth&&(!validBirthDate(birth)||birth>employeeToday()))throw Error('Enter a valid date of birth that is not in the future.');const department=input.department===undefined?e.department:input.department||undefined;if(department&&!['Floor','Kitchen'].includes(department))throw Error('Choose Front of house or Back of house.');const manualAge=input.manualAge===undefined?e.manualAge:input.manualAge.trim()===''?undefined:Number(input.manualAge);if(manualAge!==undefined&&(!Number.isInteger(manualAge)||manualAge<0||manualAge>120))throw Error('Enter a whole-number age between 0 and 120.');const pay=input.hourlyRate===undefined?{}:payDetails(input.hourlyRate,input.currency||'AUD');Object.assign(e,{...pay,dateOfBirth:birth||undefined,manualAge,department,name,phone:input.phone,position:input.position,notes:input.notes,...category(input.type,input.level||input.casualLevel||String(employeeLevel(e))),status:input.status,documentsUrl:documentsLink(input.documentsUrl),updated:new Date().toISOString()});if(e.status==='Inactive')removeEmployeeFromGroups(s,e);log(s,`${name}: employee profile updated`);saveLive(email,s)}
export function updateCandidateDocuments(s:LiveState,email:string,id:string,value:string){const c=candidate(s,id);c.documentsUrl=documentsLink(value);c.updated=new Date().toISOString();saveLive(email,s)}

export function payDetails(rate:string,currency:string){const code=currency.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(code))throw Error('Enter a three-letter currency code, e.g. AUD.');if(rate!==''&&(!/^\d+(?:\.\d{1,4})?$/.test(rate)||Number(rate)>100000))throw Error('Enter an hourly rate between 0 and 100000, with up to four decimal places.');return {hourlyRate:rate===''?undefined:Number(rate),currency:code};}

export function adjustEmployeeLevel(s:LiveState,email:string,id:string,level:string){
 const e=s.employees?.find(e=>e.id===id);if(!e)throw Error('Employee not found.');
 if(!['1','2'].includes(level))throw Error('Choose Level 1 or Level 2.');
 const from=employeeLevel(e),to=Number(level) as 1|2;if(from===to)return;
 const at=new Date().toISOString();e.level=to;if(e.type==='Casual')e.casualLevel=to;
 e.levelHistory=[...(e.levelHistory||[]),{from,to,at,by:email}];e.updated=at;
 log(s,`${e.name}: Level ${from} → Level ${to} (manual adjustment)`);saveLive(email,s);
}

function recordLeave(s:LiveState,email:string,id:string,input:Record<string,string>,leaveType:LeaveType){
 const e=s.employees?.find(e=>e.id===id);if(!e)throw Error('Employee not found.');
 const field=leaveType==='annual'?'annualLeaveEntries':'sickLeaveEntries';
 const entries=e[field]||[];
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId||''))throw Error('Reload the leave form and try again.');
 if(entries.some(entry=>entry.id===input.requestId))return;
 if(String(entries.length)!==input.revision)throw Error('Leave records changed. Reopen this form and try again.');
 if(!['opening','taken','adjustment'].includes(input.kind))throw Error('Choose a leave record type.');
 if(!validBirthDate(input.date)||input.date>employeeToday())throw Error('Choose a valid date up to today. Future leave requests are not recorded here.');
 if(!/^-?\d+(?:\.\d{1,4})?$/.test(input.hours)||!Number.isFinite(Number(input.hours))||Math.abs(Number(input.hours))>100000)throw Error('Enter hours with up to four decimal places.');
 const hours=Number(input.hours);
 if(input.kind==='opening'&&hours<0||input.kind==='taken'&&hours<=0||input.kind==='adjustment'&&hours===0)throw Error('Opening hours must be zero or more; used hours must be positive; adjustments must be non-zero.');
 const reason=(input.reason||'').trim();if(!reason||reason.length>1000)throw Error('Record the source or reason (up to 1,000 characters).');
 const opening=entries.find(entry=>entry.kind==='opening');
 if(input.kind==='opening'&&opening)throw Error('An opening balance already exists. Record an adjustment to correct it.');
 if(input.kind==='opening'&&entries.some(entry=>entry.date<input.date))throw Error('Choose an opening date on or before existing leave records.');
 if(opening&&input.date<opening.date)throw Error('This date is before the opening balance.');
 if(input.kind==='taken'&&hours>leaveBalance(s,id,leaveType,input.date).remaining+1e-9)throw Error('Used hours exceed the recorded available balance. Correct the opening balance or records first.');
 const now=new Date().toISOString();const entry:AnnualLeaveEntry={id:input.requestId,kind:input.kind as AnnualLeaveEntry['kind'],date:input.date,hours,reason,by:email,created:now};
 e[field]=[...entries,entry];e.updated=now;
 log(s,`${e.name}: ${leaveType} leave ${input.kind}, ${hours} hours on ${input.date}. ${reason}`);saveLive(email,s);
}

export function recordAnnualLeave(s:LiveState,email:string,id:string,input:Record<string,string>){return recordLeave(s,email,id,input,'annual')}
export function recordSickLeave(s:LiveState,email:string,id:string,input:Record<string,string>){return recordLeave(s,email,id,input,'sick')}

export function assignEmployeeShops(s:LiveState,email:string,id:string,shops:string){
 const e=s.employees?.find(e=>e.id===id);if(!e)throw Error('Employee not found.');
 const values=JSON.parse(shops||'[]');
 if(!Array.isArray(values)||values.some(v=>!restaurants.includes(v))||new Set(values).size!==values.length)throw Error('Choose CARLTONS, SPENCER, both shops or unassigned.');
 e.assignedShops=restaurants.filter(shop=>values.includes(shop)) as Restaurant[];e.updated=new Date().toISOString();
 log(s,`${e.name}: assigned shops updated to ${e.assignedShops.join(' + ')||'Unassigned'}`);saveLive(email,s);
}

function removeEmployeeFromGroups(s:LiveState,e:OfficialEmployee){for(const g of s.groups)g.members=g.members.filter(p=>p.id!==e.id&&p.id!==e.personId&&p.email.toLowerCase()!==e.email.toLowerCase());}
export function setEmployeeStatus(s:LiveState,email:string,id:string,status:string){const e=s.employees?.find(e=>e.id===id);if(!e)throw Error('Employee not found.');if(status!=='Active'&&status!=='Inactive')throw Error('Choose Active or Inactive.');e.status=status;e.updated=new Date().toISOString();if(status==='Inactive')removeEmployeeFromGroups(s,e);log(s,`${e.name}: ${status}${status==='Inactive'?' · removed from current employee groups':''}`);saveLive(email,s);}

export function saveEmployeeGroup(s:LiveState,account:string,input:Record<string,string>){const field=(key:string)=>input[key]?.trim()||'';const name=field('name'),id=field('id'),existing=id?s.groups.find(g=>g.id===id):undefined;if(id&&!existing)throw Error('Employee group not found.');if(existing&&field('original')!==JSON.stringify(existing))throw Error('This group changed. Reload it before saving.');const lines=field('members').split('\n').filter(line=>line.trim());if(!name||name.length>100||lines.length>100)throw Error('Provide a group name and up to 100 employees.');const members=lines.map(line=>{const [name,email,...extra]=line.split(',').map(v=>v.trim());if(!name||!email||extra.length||!/^[-\w.+]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email))throw Error('Use Name, email@example.com on each line.');const address=email.toLowerCase(),employee=s.employees?.find(e=>e.email.toLowerCase()===address);if(employee?.status==='Inactive')throw Error(`${name} is inactive. Activate their profile before adding them to a group.`);const prior=existing?.members.find(p=>p.email.toLowerCase()===address);return {id:prior?.id||employee?.personId||employee?.id||randomUUID(),name,email:address}});const data={name,description:field('description'),members:[...new Map(members.map(p=>[p.email,p])).values()]};if(existing)Object.assign(existing,data);else s.groups.push({id:randomUUID(),...data});log(s,`${name} group ${existing?'updated':'created'}`);saveLive(account,s);}
