import type {OfficialEmployee} from './employee-model';
export type AvailabilitySettings={sendDay?:number;slotMinutes?:30|60;employeeIds:string[];timezone:string;sendTime:string;enabled:boolean;openHour:number;closeHour:number};
export type AvailabilityReply={slotMinutes?:30|60;shiftChoices?:Record<string,FloorAvailabilityShift[]>;answers?:{label:string;values:string[]}[];mappingError?:string;employeeId:string;responseId:string;submittedAt:string;hours:Record<string,number[]>};
export type AvailabilityWeek={customForm?:boolean;groupName?:string;recipients?:{id:string;name:string;email:string}[];group?:AvailabilityGroup;sample?:boolean;id:string;weekStart:string;settings:AvailabilitySettings;employeeIds:string[];formId?:string;formReady?:boolean;formCreation?:'creating'|'uncertain';formUrl?:string;questionIds?:Record<string,string>;assignmentId?:string;responses:AvailabilityReply[];responseErrors:string[];lastChecked?:string;error?:string;created:string};
export type TimetableState={groups?:Partial<Record<AvailabilityGroup,AvailabilityGroupConfig>>;settings:AvailabilitySettings;weeks:AvailabilityWeek[];customForm?:{id:string;name:string;url:string;savedAt:string};lastAutomationAttempt?:string;automationError?:string};
export const defaultSettings:AvailabilitySettings={employeeIds:[],timezone:'Etc/GMT-10',sendTime:'08:00',sendDay:4,enabled:false,openHour:8,closeHour:20};
export function dayAdd(date:string,days:number){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function weekDates(start:string){return Array.from({length:7},(_,i)=>dayAdd(start,i))}
export function localClock(now:Date,timezone:string){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`}}
export function nextMonday(date:string){const dow=new Date(date+'T00:00:00Z').getUTCDay();return dayAdd(date,((8-dow)%7)||7)}
export function hourLabel(hour:number){return `${String(Math.floor(hour)).padStart(2,'0')}:${String(Math.round((hour%1)*60)).padStart(2,'0')}`}
export function eligibleEmployees(employees:OfficialEmployee[]){return employees.filter(e=>e.status==='Active'&&['Part-Time','Casual'].includes(e.type))}

export type AvailabilityGroup=string;
export type AvailabilityGroupConfig={profileRecipients?:boolean;restaurant?:import('./shift-templates').Restaurant;department?:'Floor'|'Kitchen';employeeGroupId?:string;name?:string;hoursConfigured?:boolean;settings:AvailabilitySettings;configured:boolean;formSource:'builtin'|'custom';customForm?:{id:string;name:string;url:string;savedAt:string};lastAutomationAttempt?:string;automationError?:string};

export const floorAvailabilityShifts={
 early:{label:'Early',start:10.5,end:17.5,breakStart:14.5,breakEnd:15.5},
 late:{label:'Late',start:18,end:22},
 full:{label:'Full day',start:12,end:22,breakStart:16.5,breakEnd:17.5},
} as const;
export type FloorAvailabilityShift=keyof typeof floorAvailabilityShifts;
export function parseCustomAvailability(w:AvailabilityWeek,form:{items?:{title?:string;questionItem?:{question?:{questionId?:string}}}[]},response:{responseId:string;createTime:string;lastSubmittedTime?:string;answers?:Record<string,{textAnswers?:{answers?:{value:string}[]}}>},employeeId:string):AvailabilityReply{
 const answers=(form.items||[]).map(item=>({label:item.title||'Untitled question',values:(response.answers?.[item.questionItem?.question?.questionId||'']?.textAnswers?.answers||[]).map(a=>a.value)}));
 const hours:Record<string,number[]>={},shiftChoices:Record<string,FloorAvailabilityShift[]>={},issues:string[]=[];
 const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],chinese=['星期一','星期二','星期三','星期四','星期五','星期六','星期日'];
 for(const [i,date] of weekDates(w.weekStart).entries()){
  const matched=answers.filter(a=>a.label===date||a.label.toLowerCase().includes(weekdays[i].toLowerCase())||a.label.includes(chinese[i]));
  if(matched.length!==1||!matched[0].values.length){issues.push(`${weekdays[i]}: missing or ambiguous answer`);continue;}
  const values=matched[0].values;const unavailable=values.filter(v=>/^Not available(?:\s*\/|$)/i.test(v)||v==='当天不能上班');
  if(unavailable.length){if(values.length!==1){issues.push(`${weekdays[i]}: Not available must be selected alone`);continue;}hours[date]=[];shiftChoices[date]=[];continue;}
  const choices:FloorAvailabilityShift[]=[];let invalid=false;
  for(const value of values){const kind=/^(Early\s*\/\s*早班|早班)/i.test(value)?'early':/^(Late\s*\/\s*晚班|晚班)/i.test(value)?'late':/^(Full day\s*\/\s*全天|全天)/i.test(value)?'full':undefined;
   if(!kind){invalid=true;break;}const spec=floorAvailabilityShifts[kind];const times=value.match(/\d{1,2}:\d{2}/g)||[];const expected=[hourLabel(spec.start),hourLabel(spec.end),...('breakStart' in spec?[hourLabel(spec.breakStart),hourLabel(spec.breakEnd)]:[])];
   if(JSON.stringify(times)!==JSON.stringify(expected)){invalid=true;break;}choices.push(kind);
  }
  if(invalid){issues.push(`${weekdays[i]}: unrecognized shift or changed times`);continue;}
  shiftChoices[date]=[...new Set(choices)];const slots=new Set<number>();for(const key of choices){const spec=floorAvailabilityShifts[key];for(let h=spec.start;h<spec.end;h+=0.5)if(!('breakStart' in spec)||h<spec.breakStart||h>=spec.breakEnd)slots.add(h);}hours[date]=[...slots].sort((a,b)=>a-b);
 }
 const submittedAt=response.lastSubmittedTime||response.createTime;if(!Number.isFinite(Date.parse(submittedAt)))throw Error('Invalid submission time.');
 return {employeeId,responseId:response.responseId,submittedAt,hours,slotMinutes:30,shiftChoices,answers,mappingError:issues.length?issues.join('; '):undefined};
}
