// Verify every amount against the supplied requirement, without network access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'portal-pay-rates-'));
try {
  const output=ts.transpileModule(fs.readFileSync('lib/pay-rates.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const modulePath=path.join(temp,'pay-rates.mjs');fs.writeFileSync(modulePath,output);
  const rates=await import(pathToFileURL(modulePath));
  const source=fs.readFileSync('docs/pay-rate-table-requirements.md','utf8');
  let tables=0,amounts=0;
  for(const section of source.split(/^### /m).slice(1)){
    const title=section.split('\n')[0];
    const rows=section.split('\n').filter(line=>/^\| Level [123] \|/.test(line));
    if(!rows.length)continue;
    tables++;
    const employment=title.startsWith('Casual')?'Casual':'Full-time/Part-time';
    const age=title.includes('20+')?'20+':title.includes('Under 17')?'Under 17':title.match(/Age (\d+)/)[1];
    assert.equal(rows.length,3);
    for(const line of rows){
      const cells=line.split('|').map(cell=>cell.trim()).filter(Boolean);
      const level=Number(cells[0].replace('Level ',''));
      rates.payDayTypes.forEach((day,index)=>{
        const actual=rates.hourlyRateCents(employment,level,age,day);
        assert.equal(rates.formatHourlyRate(actual),cells[index+1],`${employment} / ${age} / ${level} / ${day}`);
        assert.ok(Number.isSafeInteger(actual)&&actual>0);
        if(employment==='Full-time/Part-time')for(const separate of ['Full-time','Part-time'])assert.equal(rates.hourlyRateCents(separate,level,age,day),actual);
        amounts++;
      });
    }
  }
  assert.equal(tables,10);assert.equal(amounts,120);
  assert.equal(rates.payRateVersion.effectiveFrom,'2026-07-01');
  assert.equal(rates.payRateVersion.currency,'AUD');
  assert.throws(()=>rates.hourlyRateCents('Casual',4,'20+','Weekday'),/Unsupported/);
  assert.throws(()=>rates.hourlyRateCents('Casual',1,'21','Weekday'),/Unsupported/);
  assert.throws(()=>rates.hourlyRateCents('Casual',1,'20+','Holiday'),/Unsupported/);
  assert.throws(()=>rates.hourlyRateCents('Contractor',1,'20+','Weekday'),/Unsupported/);
  console.log('PASS: all 120 supplied rates, 10 tables, Full-time/Part-time equivalence, exact cents and display rounding, version metadata and invalid lookup rejection.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
