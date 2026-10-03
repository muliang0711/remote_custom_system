import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import ts from 'typescript';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'floor-planning-'));
try{
 for(const n of ['timetable-model','floor-scheduler','floor-planning','roster-model','employee-model','business-rules','shift-templates','pay-rates'])fs.writeFileSync(path.join(tmp,n+'.mjs'),ts.transpileModule(fs.readFileSync('lib/'+n+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,n)=>`from './${n}.mjs'`));
 const {floorCoverage,overtimeByShift}=await import(pathToFileURL(path.join(tmp,'floor-planning.mjs')));
 const {shiftTemplates,templateBreak}=await import(pathToFileURL(path.join(tmp,'shift-templates.mjs')));
 const shifts=shiftTemplates.filter(t=>t.restaurant==='CARLTONS').map((t,i)=>({...t,templateId:t.id,id:String(i),date:'2026-09-28',employeeId:String(i),breakMinutes:templateBreak(t),employee:{type:'Part-Time'},notes:''}));
 const coverage=floorCoverage(shifts,'CARLTONS','2026-09-28','10:30','22:00');
 assert.deepEqual(coverage.gaps.map(g=>[g.start,g.end,g.staff]),[[630,720,1],[870,930,1],[990,1080,1]]);
 assert.equal(coverage.missingStaffMinutes,240);
 assert.equal(floorCoverage(shifts,'SPENCER','2026-09-28','10:30','22:00').missingStaffMinutes,1380);
 const unknown=structuredClone(shifts);delete unknown[0].breakStart;delete unknown[0].breakEnd;assert.deepEqual(floorCoverage(unknown,'CARLTONS','2026-09-28','10:30','22:00').unknownBreaks,['0']);
 // Test thresholds are fixtures only, not production defaults.
 const limits=Object.fromEntries(['Part-Time','Full-Time','Casual'].map(type=>[type,{dailyHours:8,weeklyHours:12}]));
 const work=[{...shifts[0],id:'a',employeeId:'one',start:'08:00',end:'14:00',breakMinutes:0},{...shifts[0],id:'b',employeeId:'one',restaurant:'SPENCER',start:'15:00',end:'19:00',breakMinutes:0},{...shifts[0],id:'c',employeeId:'one',category:'Kitchen',date:'2026-09-29',start:'08:00',end:'12:00',breakMinutes:0}];
 const ot=overtimeByShift(work,limits);assert.equal(ot.get('a').minutes,0);assert.equal(ot.get('b').dailyMinutes,120);assert.equal(ot.get('c').weeklyMinutes,120);
 assert.throws(()=>overtimeByShift(work,{}),/Set valid/);
 const {floorTeamsFromProfiles,planFloorWeek,availableForFloor}=await import(pathToFileURL(path.join(tmp,'floor-scheduler.mjs')));
 const {floorOvertimeLimits}=await import(pathToFileURL(path.join(tmp,'floor-planning.mjs')));
 const week='2026-09-28',dates=Array.from({length:7},(_,i)=>new Date(Date.UTC(2026,8,28+i)).toISOString().slice(0,10));
 const people=Array.from({length:8},(_,i)=>({id:'e'+i,name:'Mock '+i,email:'e'+i+'@demo.invalid',phone:'',position:'Floor',type:'Casual',status:'Active',casualLevel:1}));
 const s={employees:people,rosters:[{weekStart:week,revision:0,shifts:[],manualAvailability:people.flatMap(e=>dates.map(date=>({employeeId:e.id,date,start:'10:30',end:'22:00'})))}]};
 assert.throws(()=>planFloorWeek(s,week,{CARLTONS:['e0'],SPENCER:['e0']},{CARLTONS:[],SPENCER:[]},''),/Explicitly allow/);
 for(const day of dates){const specs=shop=>shiftTemplates.filter(t=>t.restaurant===shop).map(({id,restaurant,...spec})=>spec);assert.deepEqual(specs('CARLTONS'),specs('SPENCER'));}
 const teams={CARLTONS:people.slice(0,4).map(e=>e.id),SPENCER:people.slice(4).map(e=>e.id)},closed={CARLTONS:[],SPENCER:[]};
 let plan=planFloorWeek(s,week,teams,closed,'2026-09-27T00:00:00Z');
 assert.equal(plan.shifts.length,42);assert.equal(plan.missing.length,0);
 assert.equal([...overtimeByShift(plan.shifts,floorOvertimeLimits).values()].reduce((n,v)=>n+v.minutes,0),0);
 assert.equal(plan.shifts.filter(sh=>sh.restaurant==='SPENCER'&&sh.date==='2026-10-04'&&sh.autoFloorRole==='full')[0].templateId,'SPENCER-FULL');
 const oneShopState=structuredClone(s);oneShopState.rosters[0].shifts=structuredClone(plan.shifts);
 const otherShopBefore=structuredClone(plan.shifts.filter(sh=>sh.restaurant==='SPENCER'));
 const single=planFloorWeek(oneShopState,week,teams,{CARLTONS:[week],SPENCER:[]},'later',[],['CARLTONS']);
 assert.deepEqual(single.shifts.filter(sh=>sh.restaurant==='SPENCER'),otherShopBefore);
 assert.ok(!single.shifts.some(sh=>sh.restaurant==='CARLTONS'&&sh.date===week));
 assert.ok(single.missing.every(m=>m.restaurant==='CARLTONS'));
 console.log('PASS: single-shop arrangement preserves every other-shop shift and applies closures only in the selected shop.');
 // Reruns replace their own generated assignments, preserving manual and confirmed work.
 s.rosters[0].shifts=plan.shifts;const before=plan.shifts.length;
 plan=planFloorWeek(s,week,teams,closed,'2026-09-27T01:00:00Z');assert.equal(plan.shifts.length,before);assert.equal(new Set(plan.shifts.map(sh=>sh.id)).size,before);
 const locked={...plan.shifts[0],notes:'Owner edit',autoFloorRole:undefined};s.rosters[0].shifts=[locked];
 plan=planFloorWeek(s,week,teams,closed,'2026-09-27T02:00:00Z');assert.deepEqual(plan.shifts.find(sh=>sh.id===locked.id),locked);
 const edited={...locked,start:'11:00',end:'17:00',floorRole:undefined,templateId:undefined};s.rosters[0].shifts=[edited];const withEdited=planFloorWeek(s,week,teams,closed,'');assert.equal(new Set(withEdited.shifts.map(sh=>sh.id)).size,withEdited.shifts.length);assert.deepEqual(withEdited.shifts.find(sh=>sh.id===edited.id),edited);
 s.rosters[0].shifts=[];
 const limited={CARLTONS:['e0','e1'],SPENCER:[]};plan=planFloorWeek(s,week,limited,closed,'');assert.ok(plan.missing.some(m=>m.restaurant==='SPENCER'));assert.ok([...overtimeByShift(plan.shifts,floorOvertimeLimits).values()].some(v=>v.minutes>0));
 plan=planFloorWeek(s,week,teams,{CARLTONS:['2026-09-28'],SPENCER:[]},'');assert.equal(plan.shifts.filter(sh=>sh.restaurant==='CARLTONS'&&sh.date==='2026-09-28').length,0);
 // Shared staff never overlap between shops, and no shifts are invented without availability.
 plan=planFloorWeek(s,week,{CARLTONS:['e0'],SPENCER:['e0']},closed,'',['e0']);for(const a of plan.shifts)for(const b of plan.shifts)if(a.id!==b.id&&a.employeeId===b.employeeId&&a.date===b.date)assert.ok(a.end<=b.start||b.end<=a.start);
 const noAvailability={employees:people,rosters:[{weekStart:week,shifts:[],manualAvailability:[]}]};assert.equal(planFloorWeek(noAvailability,week,teams,closed,'').shifts.length,0);
 // An actual full-day checkbox includes its unpaid break, but must not be merged with other choices.
 const formState={employees:people,rosters:[{weekStart:week,shifts:[],manualAvailability:[]}],timetable:{weeks:[{weekStart:week,employeeIds:['e0'],responses:[{employeeId:'e0',hours:{},shiftChoices:{[week]:['full']}}]}]}};
 assert.equal(availableForFloor(formState,week,'e0',week,shiftTemplates.find(t=>t.id==='CARLTONS-FULL')),true);
 assert.equal(availableForFloor(formState,week,'e0',week,shiftTemplates.find(t=>t.id==='CARLTONS-EARLY')),false);
 formState.timetable.weeks[0].responses[0].shiftChoices[week]=['early','late'];assert.equal(availableForFloor(formState,week,'e0',week,shiftTemplates.find(t=>t.id==='CARLTONS-FULL')),false);
 const source={employees:[{id:'c',status:'Active',assignedShops:['CARLTONS']},{id:'s',status:'Active',assignedShops:['SPENCER']},{id:'both',status:'Active',assignedShops:['CARLTONS','SPENCER']},{id:'missing',status:'Active'},{id:'inactive',status:'Inactive',assignedShops:['CARLTONS']}]};
 assert.deepEqual(floorTeamsFromProfiles(source),{CARLTONS:['c','both'],SPENCER:['s','both']});
 for(const shop of ['CARLTONS','SPENCER']){const hours=shiftTemplates.filter(t=>t.restaurant===shop).map(t=>{const mins=v=>Number(v.slice(0,2))*60+Number(v.slice(3));return (mins(t.end)-mins(t.start)-templateBreak(t))/60});assert.deepEqual(hours,[6,4,9]);}
 console.log('PASS: scheduling teams derive exclusively from active employee profiles; missing shop excluded; both shops use paid hours 6 / 4 / 9 after unpaid breaks.');
 console.log('PASS: 42 Floor roles across both shops, zero overtime with enough staff, fallback overtime, unfilled roles, closed days, weekend template, cross-shop conflict prevention, rerun/manual preservation and exact form-choice availability.');
 console.log('PASS: two-person coverage excludes breaks and other shops, identifies unspecified breaks, and daily/weekly overtime counts work across shops and departments using explicit thresholds.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
