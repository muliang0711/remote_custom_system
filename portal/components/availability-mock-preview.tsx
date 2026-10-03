'use client';
import {useState} from 'react';
import {AvailabilityResultsView} from './availability-results-view';
import {defaultSettings,weekDates,floorAvailabilityShifts,hourLabel,type AvailabilityWeek,type FloorAvailabilityShift} from '@/lib/timetable-model';
import type {Assignment} from '@/lib/demo-store';

export function AvailabilityMockPreview(){
 const [week,setWeek]=useState('2026-10-05');
 const people=['Alex Chen','Jamie Tan','Morgan Lee','Taylor Wong','Casey Lim','Jordan Yu','Riley Koh','Sam Ng'].map((name,i)=>({id:'mock-'+i,name,email:`mock.employee${i+1}@example.invalid`,position:i<2?'Senior floor staff':'Floor staff',type:i%2?'Casual':'Part-Time',level:i<2?2:1,phone:'Mock contact'}));
 const days=weekDates(week);
 const patterns:FloorAvailabilityShift[][]=[['early','late','full'],['early','full'],['late'],['full'],['early','late'],['late','full']];
 const responses=people.slice(0,6).map((p,i)=>{
  const shiftChoices=Object.fromEntries(days.map((d,j)=>[d,(i+j)%5===0&&j>0?[]:patterns[(i+j)%patterns.length]]));
  const hours=Object.fromEntries(days.map(d=>{const slots=new Set<number>();for(const key of shiftChoices[d]){const sh=floorAvailabilityShifts[key];for(let h=sh.start;h<sh.end;h+=.5)if(!('breakStart' in sh)||h<sh.breakStart||h>=sh.breakEnd)slots.add(h);}return [d,[...slots].sort((a,b)=>a-b)];}));
  return {employeeId:p.id,responseId:'mock-response-'+i,submittedAt:`2026-10-03T0${i+1}:15:00Z`,slotMinutes:30 as const,hours,shiftChoices,answers:days.map(d=>({label:d,values:shiftChoices[d].length?shiftChoices[d].map(k=>{const sh=floorAvailabilityShifts[k];return `${sh.label} · ${hourLabel(sh.start)}–${hourLabel(sh.end)}`;}):['Not available']}))};
 });
 const batch:AvailabilityWeek={id:'mock-preview',sample:true,group:'mock-floor',groupName:'Mock front of house',weekStart:week,settings:{...defaultSettings,slotMinutes:30},employeeIds:people.map(p=>p.id),recipients:people,responses,responseErrors:[],created:'2026-10-01T00:00:00Z',customForm:true};
 const assignment:Assignment={id:'mock-assignment',name:'Mock availability',docId:'mock',groups:[],due:'',message:'',created:batch.created,recipients:people.map((p,i)=>({...p,status:i<6?'Completed':'Pending',threadId:'',delivery:i===7?'failed':'sent'}))};
 return <AvailabilityResultsView shop="CARLTONS" department="Floor" week={week} batch={batch} people={people} assignment={assignment} busy={false} error="" loading={false} onWeek={setWeek} onRefresh={()=>{}}/>;
}
