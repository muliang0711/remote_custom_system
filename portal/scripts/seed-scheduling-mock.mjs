// Local, additive fixtures. Never creates shifts, calls Google, or sends mail.
// Run with --verify for an isolated database and scheduling/payroll checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {DatabaseSync, backup} from 'node:sqlite';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jym-scheduling-mock-'));
const verify = process.argv.includes('--verify');
if (verify) process.env.GOOGLE_DATA_DIR = path.join(temp, 'data');
else process.env.GOOGLE_DATA_DIR ||= path.join(root, '.google-data');
const groupId = 'mock-scheduling-2026';
const groupKey = 'employee-group:' + groupId;
const groupName = 'Mock · Scheduling Test';
const start = '2026-08-31', end = '2026-10-10';

try {
  // Match the app's real persistence and calculation modules, without a web server.
  for (const name of ['google-auth', 'live-store', 'people-db', 'business-rules',
    'shift-templates', 'employee-model', 'timetable-model', 'roster-model',
    'floor-planning', 'floor-scheduler', 'pay-rates']) {
    const source = fs.readFileSync(path.join(root, 'lib', name + '.ts'), 'utf8');
    fs.writeFileSync(path.join(temp, name + '.mjs'), ts.transpileModule(source, {
      compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
    }).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g, (_, n) => `from './${n}.mjs'`));
  }
  const load = n => import(pathToFileURL(path.join(temp, n + '.mjs')));
  const auth = await load('google-auth');
  const store = await load('live-store');
  const model = await load('timetable-model');
  const email = verify ? 'mock-verification@example.test' : auth.readConnection()?.email;
  if (!email) throw Error('Connect the local portal to Google before inserting fixtures.');
  const filename = path.join(auth.secretDir, 'portal.sqlite');
  let backupPath;
  if (!verify && fs.existsSync(filename)) {
    backupPath = filename + '.before-scheduling-mock-' + Date.now() + '.bak';
    const db = new DatabaseSync(filename);
    try { await backup(db, backupPath); fs.chmodSync(backupPath, 0o600); }
    finally { db.close(); }
  }

  function seed() {
    const s = store.loadLive(email);
    const untouched = JSON.stringify([s.rosters, s.financeRecords, s.financePayments, s.financeSettlements, s.assignments]);
    const now = new Date().toISOString();
    const names = ['Avery Tan', 'Blair Lim', 'Cameron Wong', 'Drew Lee',
      'Eden Chen', 'Finley Ng', 'Harper Goh', 'Jules Teo', 'Kai Ong',
      'Logan Lau', 'Milan Low', 'Noel Ho', 'Parker Foo', 'Quinn Yap', 'Reese Yeo', 'Sky Koh'];
    const types = ['Full-Time', 'Part-Time', 'Casual', 'Casual', 'Part-Time', 'Casual', 'Casual', 'Part-Time'];
    const births = ['1995-03-12', '2001-04-18', '2006-05-20', '2007-02-15',
      '2008-06-22', '2009-07-10', '2010-01-10', '1999-11-08'];
    s.employees ??= [];
    let addedEmployees = 0, addedCollections = 0;
    const people = names.map((name, index) => {
      const id = `${groupId}-employee-${String(index + 1).padStart(2, '0')}`;
      const existing = s.employees.find(e => e.id === id);
      if (existing) return existing; // Preserve edits made while testing.
      const i = index % 8, type = types[i], level = i % 2 + 1;
      const history = {id: id + '-hired', personId: id, name: '[Mock] ' + name,
        email: id + '@example.test', phone: '', position: 'Floor team member',
        notes: 'MOCK DATA — fictional employee for scheduling and finance testing.',
        employment: type, interview: 'Passed', trial: 'Passed', created: now, updated: now};
      const employee = {...history, id, type, status: 'Active', level,
        dateOfBirth: births[i], currency: 'AUD',
        assignedShops: index < 8 ? ['CARLTONS'] : ['SPENCER'],
        ...(type === 'Casual' ? {casualLevel: level} : {}),
        sourceCandidateId: history.id, hiringHistory: history};
      s.employees.push(employee); addedEmployees++;
      return employee;
    });
    if (!s.groups.some(g => g.id === groupId)) s.groups.push({id: groupId, name: groupName,
      description: `Fictional employees; availability ${start} to ${end}. No shifts pre-arranged.`,
      members: people.map(({id, name, email}) => ({id, name, email}))});
    s.timetable ??= {settings: {...model.defaultSettings, employeeIds: []}, weeks: []};
    s.timetable.groups ??= {};
    const settings = {...model.defaultSettings, employeeIds: people.map(e => e.id),
      openHour: 10.5, closeHour: 22, slotMinutes: 30, enabled: false};
    s.timetable.groups[groupKey] ??= {employeeGroupId: groupId, name: groupName,
      settings, configured: true, hoursConfigured: true, formSource: 'builtin'};
    for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
      const weekStart = model.dayAdd(start, weekIndex * 7);
      if (s.timetable.weeks.some(w => w.group === groupKey && w.weekStart === weekStart)) continue;
      const id = `${groupId}-week-${weekStart}`;
      const responses = people.map((employee, index) => {
        const hours = {}, shiftChoices = {};
        for (const [day, date] of model.weekDates(weekStart).entries()) {
          const i = index % 8;
          const off = (i + weekIndex) % 7;
          const choices = date > end || day === off ? [] :
            i === 4 ? ['early'] : i === 5 ? ['late'] :
            i === 2 ? ['early', 'late'] : i === 3 ? ['full', 'late'] : ['early', 'late', 'full'];
          shiftChoices[date] = choices;
          const slots = new Set();
          for (const key of choices) {
            const shift = model.floorAvailabilityShifts[key];
            for (let h = shift.start; h < shift.end; h += 0.5)
              if (!('breakStart' in shift) || h < shift.breakStart || h >= shift.breakEnd) slots.add(h);
          }
          hours[date] = [...slots].sort((a, b) => a - b);
        }
        return {employeeId: employee.id, responseId: id + '-reply-' + employee.id,
          submittedAt: now, slotMinutes: 30, hours, shiftChoices};
      });
      s.timetable.weeks.push({id, group: groupKey, groupName, sample: true,
        weekStart, settings: structuredClone(settings), employeeIds: people.map(e => e.id),
        recipients: people.map(({id, name, email}) => ({id, name, email})),
        responses, responseErrors: [], created: now});
      addedCollections++;
    }
    assert.equal(JSON.stringify([s.rosters, s.financeRecords, s.financePayments, s.financeSettlements, s.assignments]), untouched);
    store.saveLive(email, s);
    const saved = store.loadLive(email);
    assert.equal(JSON.stringify([saved.rosters, saved.financeRecords, saved.financePayments, saved.financeSettlements, saved.assignments]), untouched);
    assert.equal(saved.employees.filter(e => people.some(p => p.id === e.id)).length, 16);
    assert.equal(saved.timetable.weeks.filter(w => w.group === groupKey).length, 6);
    return {saved, addedEmployees, addedCollections};
  }

  const result = seed();
  if (verify) {
    const repeated = seed();
    assert.equal(repeated.addedEmployees, 0);
    assert.equal(repeated.addedCollections, 0);
    assert.deepEqual(repeated.saved, result.saved);
    assert.equal(result.saved.rosters, undefined);
    const scheduler = await load('floor-scheduler');
    const payroll = await load('roster-model');
    let checkedShifts = 0;
    for (const batch of result.saved.timetable.weeks) {
      // Calculate only on an isolated copy; no planned shift is persisted.
      const preview = structuredClone(result.saved);
      const closed = {CARLTONS: [], SPENCER: []};
      if (batch.weekStart === '2026-10-05') closed.CARLTONS = closed.SPENCER = ['2026-10-11'];
      const plan = scheduler.planFloorWeek(preview, batch.weekStart,
        scheduler.floorTeamsFromProfiles(preview), closed, new Date().toISOString());
      assert.equal(plan.missing.length, 0, 'Fixture should cover every requested Floor role');
      assert.equal(plan.shifts.length, batch.weekStart === '2026-10-05' ? 36 : 42);
      preview.rosters = [{weekStart: batch.weekStart, shifts: plan.shifts, manualAvailability: [], revision: 0}];
      const rows = payroll.payrollRows(preview, batch.weekStart);
      assert.ok(rows.every(r => r.issues.length === 0 && r.rateCents > 0));
      checkedShifts += rows.length;
    }
    assert.equal(store.loadLive(email).rosters, undefined);
    console.log(JSON.stringify({verified: true, employees: 16, collections: 6,
      replies: 96, checkedPreviewShifts: checkedShifts, persistedShifts: 0, idempotent: true}));
  } else console.log(JSON.stringify({addedEmployees: result.addedEmployees,
    addedCollections: result.addedCollections, group: groupName, start, end,
    shiftsCreated: 0, emailsSent: 0, backup: backupPath}));
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
