# Jymmanuel Document Portal — shared company workspace

Based on `Jymmanuel_Document_Portal_MVP_v4.docx`. This is a working, self-hosted local demonstration with a real local backend and durable files. The default demo workspace simulates Gmail and Drive. A separate live workspace now uses the real Gmail and Drive APIs after you connect your Google account.

## Five-user access

The portal now requires each approved member to sign in with their own Google account. Up to five active members share one company workspace. Personal sign-in requests only identity scopes; Gmail/Drive/Forms authorization remains a separate administrator-managed company connection. See [MULTIUSER-SETUP.md](MULTIUSER-SETUP.md) for setup, migration and Ubuntu runtime details.

Set `PORTAL_ADMIN_EMAIL` and a Google OAuth web client before first use. Register both `/api/auth/callback` (personal login) and `/api/google/callback` (company integration). Existing company data stays in place; old Google-session cookies no longer grant portal access.

## Run

Requires Node 22.13+ and npm. From this folder:

```sh
npm install
npm run demo:build
npm run demo:start
```

Open http://127.0.0.1:3000 and sign in. Use `/?mode=demo` for fictional demo data. For development, use `npm run demo` instead. Keep the terminal open while presenting. The server binds to loopback only. `Start Demo.command` starts the built application on macOS; if port 3000 is occupied by this demo, use the existing URL.

## Five-minute walkthrough

1. Open **Document library**. Search for a document and use **Open** to view a sample PDF. These are explicitly fictional demo documents and employees.
2. Upload a real test PDF (15 MB maximum), or add an existing Google Docs/Forms/Drive HTTPS link. External links open their native Google experience and require the viewer's own Google access.
3. Click **Send**, name the assignment, select employee groups, verify the names, add an optional due date/message, and confirm the demo send. Overlapping groups are deduplicated by email. The reusable master stays unchanged.
4. Open **Demo inbox**. Select your assignment and an employee. Open/download the assigned PDF, complete it with a local PDF tool, then choose **Simulate reply** and attach the completed PDF.
5. Open **Assignments**, select the assignment, and verify that the employee is **Completed**. Open their returned PDF. Each recipient has a separate simulated thread identifier and assignment-specific destination metadata.
6. Try a reply without a PDF, or change its sender, assignment ID, or thread. The reply enters **Manual review**, without completing the recipient. Dismissing a review does not accept a submission; correct and resubmit the simulated reply.
7. **Employee groups** supports creating groups with names and email addresses.

## Local storage and limitations

- `.demo-data/metadata.json`: documents, groups, assignments, recipients, statuses, simulated email threads, review queue and activity.
- `.demo-data/files/`: PDF binaries, separate from workflow metadata. Google-style submission paths are represented in metadata; they are not actual Drive folders.
- Files and workflow changes survive browser refreshes and server restarts. Back up the `.demo-data` folder to retain a demo workspace.
- Override `DEMO_DATA_DIR` for an isolated test workspace.
- The demo workspace does not use Google. The live workspace requires a Google OAuth session and supports real email delivery, Drive synchronization and scheduled Gmail collection. The app supports five approved members in a shared workspace and one server process. Configure HTTPS and the production origin before remote use; see MULTIUSER-SETUP.md.
- PDFs are checked for size and PDF header only. Full malicious-file scanning and deeper validation belong in the production integration.
- Google Forms use verified account email collection; matching responses update assignments and hiring stages.
- The two seeded completed records use sample PDFs, not real employee submissions.

## Real Gmail and Google Drive setup

Open http://127.0.0.1:3000/google for the guided setup. It includes direct links and the exact callback URI.

1. Create/select a Google Cloud project and enable Gmail API, Google Drive API and Google Forms API.
2. Configure Google Auth Platform branding, audience and data access. For a personal Gmail demo choose External / Testing and add your connected mailbox as a test user. An eligible Workspace organization can use Internal. Add the scopes listed below.
3. Create an OAuth client with application type **Web application**. Register `http://127.0.0.1:3000/api/google/callback` as the authorized redirect URI.
4. Download the OAuth client JSON and import it in the portal’s Google connection screen. It is encrypted locally; the secret is never returned to the browser. Alternatively copy `.env.example` to `.env.local`, enter the client ID and secret, then restart. Environment credentials take precedence over the imported JSON.
5. Click **Connect Google account** and approve the permissions in Google yourself.
6. Open the **live workspace**. It starts empty, separate from fictional demo data. Sync Drive and create employee groups with actual email addresses.
7. Upload a PDF template or select a Drive document; send an assignment after checking the recipient list and real-send confirmation.
8. Reply to the resulting assignment email with one completed PDF. The server collects every 60 seconds; **Check Gmail now** also runs collection. Review the returned Drive file from Assignments.

### Google access and implementation

- `https://www.googleapis.com/auth/gmail.send`: send a separate MIME email per employee; PDFs are attached, Google Docs/Forms use links.
- `https://www.googleapis.com/auth/gmail.readonly`: read assignment threads and matching assignment emails/attachments. The app does not alter mailbox labels, read status or messages.
- `https://www.googleapis.com/auth/drive.readonly`: retrieve metadata for existing accessible PDFs, Docs and Forms and download selected PDFs for delivery. This permission is account-wide; collection is limited in application code.
- `https://www.googleapis.com/auth/drive.file`: create portal-owned folders and upload template and returned PDFs. The app does not change existing file sharing permissions. Google document recipients must already have access; Forms use their responder URL.
- A dedicated `Jymmanuel Document Portal` Drive root holds `Templates`, `Assignments/YYYY-MM/<assignment>` and `Submissions/YYYY-MM/<assignment>/<employee>`.
- Live PDF binaries remain in Google Drive. The local workflow metadata stores Drive IDs, Gmail thread/message IDs, recipients, statuses and due dates.
- Tokens and imported OAuth client credentials are AES-256-GCM encrypted under `.google-data/`, with a locally generated key and owner-only filesystem permissions. Protect/back up that directory as a unit. Live metadata is stored in `.google-data/portal.sqlite`, separated by a hash of the mailbox address. Candidate and official employee records use dedicated SQL tables.
- OAuth uses state, PKCE, an HTTP-only callback cookie and a separate HTTP-only live-session cookie. Mutations require the configured host, same-origin requests and a custom header. Non-loopback origins must use HTTPS. No OAuth secret or access token is sent to frontend JavaScript.
- Personal portal sessions last seven days and are independent of the company Google grant. Google grants may expire or be revoked. Reconnect if authorization fails. Google testing-mode restrictions can require reauthorization. Review Google’s current verification requirements before broader rollout.
- A saved send request ID prevents resubmitting the same assignment from sending twice. Delivery state is persisted per recipient before the send. Uncertain network outcomes are never blindly retried; the collector attempts recovery using the unique RFC Message-ID in Gmail Sent. Explicitly failed/unsent recipients can be reviewed and retried.
- Replies must match the assignment ID in the subject, recipient email and Gmail thread. Exactly one PDF under 15 MB is accepted. Unknown assignments, changed threads, missing/multiple/invalid PDFs and additional returns go to manual review. Message IDs and Drive app properties prevent duplicate collection.
- Polling runs in the local Node server, even with the browser closed, while it remains running. `GOOGLE_POLL_INTERVAL_SECONDS=0` disables polling. Manual collection is still available. Run only one server instance against a data directory.
- Disconnect removes local saved tokens and stops collection; it preserves workflow metadata and Google files. Revoke the OAuth grant itself from Google account connections if needed.

### Before production rollout

Approved-member access control is implemented. Before broader rollout, consider a durable job queue, deployment-grade secret management, more extensive PDF validation/malware scanning, retention controls and appropriate monitoring. Large mailboxes and high assignment volumes need incremental Gmail history synchronization and bounded job processing. The local collector currently re-reads tracked assignment threads and scans matching new-mail pages, suitable for a small pilot. Run a single server process for the current collector and in-process workflow queue, even though SQLite handles transactional storage.

Official references: [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending), [Gmail thread matching](https://developers.google.com/workspace/gmail/api/guides/threads).

## Verification

Build with `npm run server:build`, then run `npm run verify:multiuser`. The suite starts its own isolated local server, creates five synthetic identities in temporary storage, tests permissions and concurrent writes, and runs the demo workflow checks. It never signs into real Google accounts or sends real email. Do not point regression tests at production storage.

### Google integration verification

Run `node scripts/verify-google.mjs`. All Google traffic in this test is mocked and credentials/data use a fresh temporary directory. It verifies credential encryption, cookie-session checks, host/origin rejection, empty account-specific workspaces, Gmail MIME attachments, group deduplication, send idempotency, ambiguous-send recovery, nested attachments, matching, Drive collection, duplicate prevention, manual review, persistence, refresh token handling and disconnect.

The implementation and mocked contracts have been checked. Live OAuth consent, real Gmail delivery and real Google Drive uploads still require your configured Google Cloud client and connected account. No real email was sent during implementation.

### Folder filtering

In Document library, choose **Folder → Templates** (or another Drive folder), then optionally select **PDFs** or search by name. The list and count show only files directly inside the selected folder. Nested folders appear as separate choices; full paths distinguish folders with the same name. **All folders** restores the full library. The selected folder is stored in the page URL so refresh preserves it. After upgrading or moving files in Drive, click **Sync Google Drive** to refresh folder locations.

### Documents added through Google link

Both PDF uploads and Google links appear in Templates. PDF uploads create a file there. A Google link creates a real Drive shortcut in Templates pointing to the existing PDF, Google Doc or Google Form, preserving its original ID, location and responses. If the file is already in Templates, it is reused. Re-adding the same link reuses its shortcut. Sync resolves shortcuts to a single library record, including the Templates folder association. After adding a file, the library switches to Templates and clears other filters. Existing documents can be filed using **Document details → Add to Templates**. Use the source editor/Drive URL; responder and shortened Forms URLs cannot identify a Drive source file.

## Employee directory (SQLite)

Employee → Candidate manages basic profiles. Hiring Process owns stage updates and Google Form tracking. After all stages finish, HR confirms a transfer from Candidate to Official Employee and selects Part-Time, Full-Time, Casual Level 1 or Casual Level 2. The transfer is atomic, preserves the permanent person ID and retains a recruitment snapshot. Employee category changes are recorded in employment_history; no automatic promotion, pay or leave rules are active.

Tables: workspace, person, hiring_candidate, official_employee, recruitment_history and employment_history. Other live workflow metadata remains a JSON document within the workspace SQL table. On first access, each legacy mailbox JSON is backed up as `.json.pre-sqlite.bak` before migration. Legacy JSON is no longer written or used after migration. Do not restore a legacy JSON file alone over a running SQLite installation. Stop the server and back up the entire `.google-data` directory (including any SQLite WAL files and encryption key) as a unit.

Name and email are required initially; other basic fields can be supplied later. A profile can link its Google Drive document folder and original Employee Information Form responses. Birth date, identity, visa, resume and bank details are not automatically mapped into SQLite. Google Sheet import and automatic Sheet synchronization are disabled in this version. Existing Sheets are preserved.

Run `node scripts/verify-employees.mjs` for isolated migration, transfer, rollback, history and account-isolation checks. Tests do not use live Google accounts.

## Trial: flexible hours and daily settlement

Timetable → Trial uses manually chosen start/end times, with no early/late/full-day template or fixed two/three-hour duration. Open **Settle trials in Finance**, or Finance → **Trial daily settlements**, to confirm actual work and enter the agreed total in AUD. The total is manually entered per trial; it is not calculated from the regular employee rate table.

Trial settlement is available after actual work finishes on the trial date (UTC+10), without weekly checkout or waiting for month end. After confirming the total, use **Record payment** to record the full payment already completed externally, with its actual date and reference. Older unpaid trials appear under **All unpaid trials through today**. No bank transfer is initiated.

Confirmed trial settlements preserve the person, schedule, actual hours, amount and operator. Their original timetable entries cannot be edited or deleted. Duplicate settlement/payment requests cannot create a second payment record. Trial amounts are kept outside ordinary monthly payroll to avoid double counting. Daily trial records can be exported as CSV.

Run `node scripts/verify-trial-finance.mjs` for isolated scheduling, amount/time validation, persistence, audit, authenticated API and concurrent-write tests. Tests do not touch real company records or Google services.
