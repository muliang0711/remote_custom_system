// Fill only missing payroll attributes on the five known fictional demo employees.
// Does not change real people, existing DOB/Level choices, shifts, or form responses.
import {DatabaseSync,backup} from 'node:sqlite';
import path from 'node:path';
import assert from 'node:assert/strict';
const filename=path.join(process.env.GOOGLE_DATA_DIR||path.join(process.cwd(),'.google-data'),'portal.sqlite');
const db=new DatabaseSync(filename);
try{
 const rows=db.prepare('SELECT e.account_id,e.id,e.record_json,p.name,p.email FROM official_employee e JOIN person p ON p.account_id=e.account_id AND p.id=e.person_id').all();
 const births=['2001-04-12','2008-03-20','2007-02-15','2006-01-10','1995-06-22'];
 const updates=rows.flatMap(row=>{
  const match=/^mock-employee-([1-5])$/.exec(row.id);
  if(!match||!row.name.startsWith('[Mock] ')||row.email!==row.id+'@demo.example')return [];
  const value=JSON.parse(row.record_json),before=JSON.stringify(value);
  value.dateOfBirth ||= births[Number(match[1])-1];value.level ??= value.casualLevel??1;
  return JSON.stringify(value)===before?[]:[{...row,value}];
 });
 if(updates.length){
  await backup(db,filename+'.before-mock-payroll-'+Date.now()+'.bak');
  db.exec('BEGIN IMMEDIATE');
  try{
   for(const row of updates){const result=db.prepare('UPDATE official_employee SET record_json=? WHERE account_id=? AND id=? AND record_json=?').run(JSON.stringify(row.value),row.account_id,row.id,row.record_json);assert.equal(result.changes,1,'Profile changed during repair; retry.');}
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 console.log(JSON.stringify({updatedMockEmployees:updates.map(row=>row.name),realEmployeesChanged:0,shiftsChanged:0}));
}finally{db.close();}
