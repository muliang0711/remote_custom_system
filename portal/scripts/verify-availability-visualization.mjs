import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import ts from 'typescript';import {pathToFileURL} from 'node:url';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'availability-visualization-'));
try{
fs.writeFileSync(temp+'/model.mjs',ts.transpileModule(fs.readFileSync('lib/timetable-model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const m=await import(pathToFileURL(temp+'/model.mjs'));
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];const form={items:days.map((title,i)=>({title:title+' / 星期',questionItem:{question:{questionId:String(i)}}}))};
const early='Early / 早班 · 10:30–17:30 (break 14:30–15:30)',late='Late / 晚班 · 18:00–22:00',full='Full day / 全天 · 12:00–22:00 (break 16:30–17:30)',none='Not available / 当天不能上班';
const w={weekStart:'2026-09-28'};const response={responseId:'r1',createTime:'2026-09-27T00:00:00Z',answers:Object.fromEntries(days.map((_,i)=>[i,{textAnswers:{answers:(i===0?[early,late,full]:i===1?[early]:i===2?[full]:[none]).map(value=>({value}))}}]))};
const reply=m.parseCustomAvailability(w,form,response,'p1');assert.equal(reply.mappingError,undefined);assert.equal(reply.slotMinutes,30);assert.deepEqual(reply.shiftChoices['2026-09-28'],['early','late','full']);assert.equal(reply.hours['2026-09-28'].length,23);assert.equal(reply.hours['2026-09-29'].length,12);assert.ok(!reply.hours['2026-09-29'].includes(14.5));assert.equal(reply.hours['2026-09-30'].length,18);assert.ok(!reply.hours['2026-09-30'].includes(16.5));assert.deepEqual(reply.hours['2026-10-04'],[]);assert.equal(reply.answers.length,7);
const conflict=structuredClone(response);conflict.answers[0].textAnswers.answers.push({value:none});const bad=m.parseCustomAvailability(w,form,conflict,'p1');assert.match(bad.mappingError,/alone/);assert.ok(!('2026-09-28' in bad.hours));
const changed=structuredClone(response);changed.answers[1].textAnswers.answers=[{value:early.replace('10:30','11:00')}];assert.match(m.parseCustomAvailability(w,form,changed,'p1').mappingError,/changed times/);
const missing=structuredClone(response);delete missing.answers[2];assert.match(m.parseCustomAvailability(w,form,missing,'p1').mappingError,/Wednesday/);
const next=m.parseCustomAvailability({weekStart:'2026-10-05'},form,response,'p1');assert.equal(next.hours['2026-09-28'],undefined);assert.deepEqual(next.shiftChoices['2026-10-05'],['early','late','full']);
console.log('PASS: reusable weekday mapping, exact three shift options, break exclusion, union without double counting, seven-day mapping, raw answers, unavailable vs missing, conflicting answers and changed-time rejection.');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
