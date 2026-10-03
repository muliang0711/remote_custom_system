# Monthly finance and timetable handover

## Ownership and sequence

Timetable owns the correctness of shifts and actual worked hours. Checkout is the explicit handover to Finance. Finance reads one calendar-month report, confirms a monthly settlement and records payments already completed outside the portal.

The authenticated Google account is recorded for each checkout, settlement and payment. This MVP records responsibility; it does not introduce separate Timetable/Finance roles or enforce a separation of duties between different people.

## Timetable checkout

- Staff roster CSV remains on Timetable, filtered by the selected week, shop and department. Availability recording/collection links remain removed from its toolbar.
- Checkout includes all shops and departments. Candidate trials are excluded from pay.
- The portal uses fixed UTC+10. Checkout before the week ends requires the early-checkout confirmation.
- The Checkout through selector can submit only the first part of a week, including a month-end cutoff. Later work remains pending. A subsequent checkout must cover all previously submitted dates plus any additional dates.
- Checkout saves employee details, rates, shift details, submitter, time and version. A resubmission requires a reason. Duplicate identical submissions reuse the saved version.
- Old weekly snapshots remain in storage and are automatically read by work date. No migration of financial amounts is performed.

## Monthly report

`/finance` opens years, then months. `/finance?month=2026-10` directly opens October's report, not a list of weeks.

Each work date belongs to its calendar month: the 28 September–4 October week contributes September dates to September and October dates to October. Only the latest checkout for each source week is used, preventing duplicate hours across versions. Saved amounts are used without recalculating current profiles.

The report shows employee type, work days, scheduled and confirmed actual hours, confirmed base pay, outstanding balances, payment status and expandable daily/shift details. A collapsed audit area shows the account and time behind each handover, all checkout versions, settlement versions and payment entries.

Known shifts not submitted, modified after checkout, deleted or moved after checkout are listed as pending. They block month close and further payment recording until the roster owner submits a correction. The system cannot detect work days that were never entered as shifts; the monthly reviewer explicitly confirms completeness.

## Settlement and payments

- Monthly settlement is allowed after the last day of the calendar month (UTC+10).
- All known work must be handed over, actual work must be confirmed, and required rate inputs must be available.
- A settlement freezes the month and records the reviewer and time. A revision requires a reason. Old settlements remain readable.
- An adjacent month's changes do not invalidate a settlement if this month's handed-over facts remain unchanged.
- Employee balances use the latest settled base pay minus the immutable payment ledger. States include Unpaid, Part paid, Paid and Overpaid.
- Record payment accepts a positive amount, completed-transfer date, reference/note and explicit confirmation. It records bookkeeping only; it does not move money. Partial payments are supported, duplicate request IDs are idempotent, and amounts above the outstanding balance are rejected.
- After payment, a changed checkout requires a revised settlement. Existing payment records stay intact; a higher total leaves a supplemental payment due, while a lower total shows a recovery balance. Record recovery records money already recovered.
- This initial version has no payment-entry reversal UI. Do not enter a payment until the external transaction is verified.

Monthly summary and daily-detail CSVs use UTF-8 BOM and spreadsheet-formula escaping. Settlement-selected exports retain the saved work and pay amounts; summary payment columns explicitly show the current ledger, even when an older settlement is selected. Draft exports are clearly labeled.

Amounts retain the existing base-pay scope: tax, super, overtime premiums, allowances and leave payments are excluded. Overtime warnings remain visible. This is not a bank integration or a full net-pay engine.

## Verification

- `node scripts/verify-monthly-finance.mjs`
- `node scripts/verify-finance.mjs`
- `node scripts/verify-roster.mjs`
- `npx tsc --noEmit`
- `npm run demo:build`

Tests use temporary SQLite databases and fake authentication. Browser checks use a separate local preview with mock employees, including a successful monthly settlement and partial payment. No real employee payment records or Google data are modified during these tests.
