import type {LiveState} from './live-store';
import {isAvailable,minutes,netMinutes,overlap,type Shift} from './roster-model';
import {floorAvailabilityShifts,weekDates,type FloorAvailabilityShift} from './timetable-model';
import {restaurants,shiftTemplates,templateApplies,templateBreak,type Restaurant,type ShiftTemplate} from './shift-templates';
import {floorOvertimeLimits,overtimeByShift} from './floor-planning';
export type FloorTeams=Record<Restaurant,string[]>;
export type FloorClosures=Record<Restaurant,string[]>;
export function floorTeamsFromProfiles(s:LiveState):FloorTeams{
 return Object.fromEntries(restaurants.map(shop=>[shop,(s.employees||[]).filter(e=>e.status==='Active'&&e.assignedShops?.includes(shop)).map(e=>e.id)])) as FloorTeams;
}
const time=(value:number)=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
function covers(parts:[number,number][],start:number,end:number){let point=start;for(const [a,b] of [...parts].sort((a,b)=>a[0]-b[0])){if(b<=point)continue;if(a>point)return false;point=b;if(point>=end)return true}return point>=end}
export function availableForFloor(s:LiveState,week:string,id:string,date:string,t:ShiftTemplate){
 const parts:[number,number][]=t.breakStart&&t.breakEnd?[[minutes(t.start),minutes(t.breakStart)],[minutes(t.breakEnd),minutes(t.end)]]:[[minutes(t.start),minutes(t.end)]];
 const manual=(s.rosters?.find(w=>w.weekStart===week)?.manualAvailability||[]).filter(a=>a.employeeId===id&&a.date===date).map(a=>[minutes(a.start),minutes(a.end)] as [number,number]);
 if(parts.every(([a,b])=>covers(manual,a,b)))return true;
 const batches=s.timetable?.weeks.filter(b=>b.weekStart===week&&b.employeeIds.includes(id)&&(!b.group||!s.timetable?.groups?.[b.group]?.restaurant||s.timetable.groups[b.group]?.restaurant===t.restaurant&&s.timetable.groups[b.group]?.department==='Floor'))||[];
 const replies=batches.map(b=>b.responses.find(r=>r.employeeId===id)).filter(r=>r&&!r.mappingError);
 const choices=replies.flatMap(r=>r?.shiftChoices?.[date]||[]);
 if(replies.some(r=>r?.shiftChoices))return choices.some((key:FloorAvailabilityShift)=>{
  const choice=floorAvailabilityShifts[key];const offered:[number,number][]='breakStart' in choice?[[choice.start*60,choice.breakStart*60],[choice.breakEnd*60,choice.end*60]]:[[choice.start*60,choice.end*60]];
  return parts.every(([a,b])=>covers([...manual,...offered],a,b));
 });
 return parts.every(([a,b])=>isAvailable(s,week,id,date,{start:time(a),end:time(b)},t.restaurant));
}
const roleOf=(t:ShiftTemplate)=>t.id.includes('FULL')?'full':t.id.includes('EARLY')?'early':'late';
export function planFloorWeek(s:LiveState,week:string,teams:FloorTeams,closed:FloorClosures,now:string,crossShopEmployeeIds:string[]=[],shops:readonly Restaurant[]=restaurants){
 const shared=teams.CARLTONS.filter(id=>teams.SPENCER.includes(id));
 if(shared.some(id=>!crossShopEmployeeIds.includes(id)))throw Error('Explicitly allow cross-shop work before selecting an employee for both shops.');
 const old=s.rosters?.find(w=>w.weekStart===week),selected=new Set(Object.values(teams).flat());
 const shifts=(old?.shifts||[]).filter(sh=>!((sh.restaurant?shops.includes(sh.restaurant):shops.length===restaurants.length)&&!sh.actual&&(sh.autoFloorRole||(selected.has(sh.employeeId)&&(sh.category==='Floor'||!sh.category)&&sh.notes==='Automatically allocated from employee-confirmed availability. Review unpaid breaks if needed.'&&sh.created===sh.updated))));
 for(const sh of shifts)if(selected.has(sh.employeeId)&&sh.restaurant&&!teams[sh.restaurant].includes(sh.employeeId))throw Error(`${sh.employee.name} already has a retained shift in ${sh.restaurant}. Update the employee’s permitted shop or that shift before auto arranging.`);
 const original=new Set(shifts.map(sh=>sh.id));
 const missing:{restaurant:Restaurant;date:string;role:string;reason:string}[]=[];
 const tasks=weekDates(week).flatMap(date=>shops.flatMap(restaurant=>closed[restaurant].includes(date)?[]:(['full','early','late'] as const).flatMap(role=>{
  const templates=shiftTemplates.filter(t=>t.restaurant===restaurant&&roleOf(t)===role&&templateApplies(t,date));
  const existing=shifts.some(sh=>sh.category==='Floor'&&sh.restaurant===restaurant&&sh.date===date&&(sh.floorRole===role||sh.autoFloorRole===role||templates.some(t=>sh.templateId===t.id||sh.start===t.start&&sh.end===t.end)));
  if(existing)return [];
  const options=templates.flatMap(t=>(s.employees||[]).filter(e=>e.status==='Active'&&teams[restaurant].includes(e.id)&&availableForFloor(s,week,e.id,date,t)).map(e=>({e,t})));
  return [{date,restaurant,role,options}];
 })));
 // Most constrained slots first; try several orderings and retain the best complete week.
 const slotId=(task:{restaurant:string;date:string;role:string})=>{let id=`floor-${week}-${task.restaurant}-${task.date}-${task.role}`;while(original.has(id))id+='-next';return id;};
 const attempts:Shift[][]=[];
 for(let attempt=0;attempt<12;attempt++){
  const plan=[...shifts];
  const tasksInOrder=[...tasks].sort((a,b)=>a.options.length-b.options.length||(attempt%2?a.date.localeCompare(b.date):b.date.localeCompare(a.date))||a.restaurant.localeCompare(b.restaurant)||a.role.localeCompare(b.role));
  for(const task of tasksInOrder){
   const options=task.options.filter(({e,t})=>!plan.some(sh=>sh.employeeId===e.id&&sh.date===task.date&&overlap(sh,t)));
   const baseOT=[...overtimeByShift(plan,floorOvertimeLimits).values()].reduce((n,v)=>n+v.minutes,0);
   const ranked=options.map(({e,t},index)=>{
    const shift:Shift={id:slotId(task),employeeId:e.id,date:task.date,start:t.start,end:t.end,breakMinutes:templateBreak(t),breakStart:t.breakStart,breakEnd:t.breakEnd,restaurant:task.restaurant,category:'Floor',templateId:t.id,floorRole:task.role,autoFloorRole:task.role,notes:'Automatically arranged Floor shift. Review coverage gaps and overtime warnings.',employee:{name:e.name,email:e.email,phone:e.phone,position:e.position,type:e.type,casualLevel:e.casualLevel,currency:'AUD'},created:now,updated:now,ruleVersion:1};
    const ot=[...overtimeByShift([...plan,shift],floorOvertimeLimits).values()].reduce((n,v)=>n+v.minutes,0)-baseOT;
    const load=plan.filter(sh=>sh.employeeId===e.id).reduce((n,sh)=>n+netMinutes(sh),0);
    return {shift,ot,load,tie:(index+attempt)%Math.max(1,options.length)};
   }).sort((a,b)=>a.ot-b.ot||a.load-b.load||a.tie-b.tie);
   if(ranked[0])plan.push(ranked[0].shift);
  }
  // Local reassignment reduces overtime after considering the entire week.
  for(let pass=0;pass<3;pass++)for(const task of tasks){
   const index=plan.findIndex(sh=>sh.id===slotId(task)&&!original.has(sh.id));if(index<0)continue;
   let best=[...overtimeByShift(plan,floorOvertimeLimits).values()].reduce((n,v)=>n+v.minutes,0);
   for(const {e,t} of task.options){if(plan.some((sh,i)=>i!==index&&sh.employeeId===e.id&&sh.date===task.date&&overlap(sh,t)))continue;
    const candidate={...plan[index],employeeId:e.id,start:t.start,end:t.end,breakMinutes:templateBreak(t),breakStart:t.breakStart,breakEnd:t.breakEnd,templateId:t.id,employee:{name:e.name,email:e.email,phone:e.phone,position:e.position,type:e.type,casualLevel:e.casualLevel,currency:'AUD'}};
    const trial=plan.map((sh,i)=>i===index?candidate:sh),ot=[...overtimeByShift(trial,floorOvertimeLimits).values()].reduce((n,v)=>n+v.minutes,0);
    if(ot<best){plan[index]=candidate;best=ot;}
   }
  }
  attempts.push(plan);
 }
 const totalOT=(plan:Shift[])=>[...overtimeByShift(plan,floorOvertimeLimits).values()].reduce((n,v)=>n+v.minutes,0);
 const result=attempts.sort((a,b)=>b.length-a.length||totalOT(a)-totalOT(b))[0]||shifts;
 for(const task of tasks)if(!result.some(sh=>sh.id===slotId(task)))missing.push({restaurant:task.restaurant,date:task.date,role:task.role,reason:!shiftTemplates.some(t=>t.restaurant===task.restaurant&&roleOf(t)===task.role&&templateApplies(t,task.date))?'Shift template not configured':'No available employee without a conflicting shift'});
 return {shifts:result.sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)),missing};
}
