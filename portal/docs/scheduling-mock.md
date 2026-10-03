# Scheduling mock data

Run `node scripts/seed-scheduling-mock.mjs` from `portal` to add the fixtures to the locally connected Google account's SQLite workspace. An SQLite backup is created before insertion. Run `node scripts/seed-scheduling-mock.mjs --verify` to validate the fixtures in a temporary database without changing the website.

- Employee Group: **Mock · Scheduling Test**.
- 16 active Official Employees, all named `[Mock] …`, with fictional `example.test` emails. Eight belong to CARLTONS and eight to SPENCER.
- Full-Time, Part-Time and Casual profiles include dates of birth, levels 1/2 and AUD currency for the existing payroll calculations. Ages cover under 17, 17, 18, 19 and 20+ during the fixture period.
- Six weekly collections start on 2026-08-31, 09-07, 09-14, 09-21, 09-28 and 10-05. Each contains 16 saved replies with early, late, full-day and unavailable choices, including the standard unpaid breaks.
- Availability ends on **2026-10-10**. The final Monday–Sunday calendar includes October 11 as unavailable for everyone.
- Collections are marked as samples. Scheduled sending is disabled, and no Google Form, email, shift, payment or finance settlement is created.
- Re-running only adds missing employees, the group and weekly collections. It preserves existing fixture edits and all existing roster and finance data.

In your signed-in browser, open `/availability/visualize?group=employee-group%3Amock-scheduling-2026&week=2026-09-28`. Use the week arrows to view earlier or later replies. You can also find the group under Employee Groups and Availability Collection. These replies are already saved; no form preparation or sending is needed.

Next open `/timetable?week=2026-09-28` and test Auto Arrange, then Add employee shift. The mock employees' assigned shops and availability are ready for those actions. Existing employees and shifts remain present. For the final week, October 11 will produce coverage gaps unless you close that day or provide additional availability.

Finance estimates become available after shifts are added. Actual-pay testing requires confirming completed working hours; the application only permits confirmation after the work has finished in UTC+10. Use past September dates for that flow.

The isolated verification checks database round trips, repeat insertion, no persisted shifts, all 246 requested Floor positions across the date range, and valid payroll preview rates. Those generated verification shifts exist only in memory and are discarded.
