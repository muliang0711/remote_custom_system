-- SQLite design draft: run only after replacing destructive person persistence.
-- Existing dependency: person PRIMARY KEY(account_id,id).
-- Dates/timestamps: ISO-8601 TEXT; UTC for timestamps. IDs are application UUIDs.
PRAGMA foreign_keys = ON;

CREATE TABLE hiring_form (
  account_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('acknowledgement','employee_detail')),
  schema_version TEXT NOT NULL,
  schema_json TEXT NOT NULL CHECK(json_valid(schema_json)),
  field_map_json TEXT NOT NULL CHECK(json_valid(field_map_json)),
  verified_email_checked_at TEXT,
  PRIMARY KEY(account_id,form_id,schema_version)
);

CREATE TABLE candidate_profile (
  account_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  nickname TEXT,
  contact_email TEXT,
  date_of_birth TEXT,
  residential_address TEXT,
  country_of_origin TEXT,
  recruitment_source TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  visa_work_rights_text TEXT,
  reported_work_or_trial_date TEXT,
  drive_folder_id TEXT,
  field_provenance_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(field_provenance_json)),
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(account_id,person_id),
  FOREIGN KEY(account_id,person_id) REFERENCES person(account_id,id)
);

CREATE TABLE payroll_detail (
  account_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  tfn TEXT,
  tfn_status TEXT NOT NULL DEFAULT 'pending' CHECK(tfn_status IN ('pending','provided')),
  bank_account_name TEXT,
  bsb TEXT,
  bank_account_number TEXT,
  has_super_fund INTEGER CHECK(has_super_fund IN (0,1)),
  super_fund_name TEXT,
  super_usi TEXT,
  super_membership_number TEXT,
  source_submission_id TEXT,
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(account_id,person_id),
  FOREIGN KEY(account_id,person_id) REFERENCES person(account_id,id)
);

CREATE TABLE form_submission (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  person_id TEXT,
  assignment_id TEXT,
  form_id TEXT NOT NULL,
  response_id TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  last_submitted_at TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  respondent_email TEXT,
  answers_json TEXT NOT NULL CHECK(json_valid(answers_json)),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK(status IN ('received','needs_review','processing','completed','failed','superseded')),
  error_code TEXT,
  reviewed_by TEXT,
  review_reason TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(account_id,id),
  UNIQUE(account_id,form_id,response_id,last_submitted_at),
  FOREIGN KEY(account_id,person_id) REFERENCES person(account_id,id),
  FOREIGN KEY(account_id,form_id,schema_version)
    REFERENCES hiring_form(account_id,form_id,schema_version)
);
CREATE INDEX submission_person ON form_submission(account_id,person_id,submitted_at);
CREATE INDEX submission_review ON form_submission(account_id,status,created_at);

CREATE TABLE candidate_document (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK(document_type IN
    ('passport','visa','resume','acknowledgement_pdf','employee_detail_pdf')),
  drive_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER CHECK(byte_size >= 0),
  status TEXT NOT NULL CHECK(status IN ('ready','unavailable','superseded')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(account_id,id),
  UNIQUE(account_id,submission_id,document_type,drive_file_id),
  FOREIGN KEY(account_id,person_id) REFERENCES person(account_id,id),
  FOREIGN KEY(account_id,submission_id) REFERENCES form_submission(account_id,id)
);
CREATE INDEX document_person_type ON candidate_document(account_id,person_id,document_type,created_at);
CREATE INDEX document_drive_id ON candidate_document(account_id,drive_file_id);

-- Durable inbox, replay protection and worker queue; secrets are not stored here.
CREATE TABLE form_ingest_job (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  form_id TEXT NOT NULL,
  response_id TEXT NOT NULL,
  submission_id TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('fetch_response','index_files','archive_pdf')),
  nonce TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','running','completed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  available_at TEXT NOT NULL,
  lease_until TEXT,
  lease_owner TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(account_id,id),
  UNIQUE(account_id,dedupe_key),
  UNIQUE(account_id,nonce),
  FOREIGN KEY(account_id,submission_id) REFERENCES form_submission(account_id,id)
);
CREATE INDEX ingest_pending ON form_ingest_job(status,available_at,lease_until);
-- fetch_response dedupe_key = event nonce (reconciliation uses its own event UUID).
-- File/PDF dedupe_key = submission ID + job kind. Completed jobs retained for retry safety.
-- Application transaction must ensure document.person_id equals submission.person_id,
-- and payroll.source_submission_id belongs to the same account/person.
