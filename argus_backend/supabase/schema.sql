-- ARGUS PostgreSQL schema for Supabase
-- Run this once in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  design_name varchar(255) not null,
  design_id varchar(255) default 'figma-current-page',
  figma_page_name varchar(255),
  file_type varchar(50) default 'Figma',
  model_name varchar(255) default 'Random Forest UI Issue Classifier',
  model_version varchar(50) default '2.0',
  analysis_method varchar(255) default 'trained_metadata_model_with_dynamic_feedback',
  scan_mode varchar(50) default 'manual',
  node_count integer default 0,
  total_issues integer default 0,
  total_suggestions integer default 0,
  started_at timestamptz default now(),
  completed_at timestamptz,
  terminated_at timestamptz,
  status varchar(30) default 'started' check (status in ('started','completed','failed','terminated')),
  last_analysis_id uuid,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references analysis_sessions(id) on delete cascade,
  design_name varchar(255) not null,
  file_type varchar(50) not null,
  scan_mode varchar(50) default 'manual',
  model_name varchar(255) default 'Random Forest UI Issue Classifier',
  model_version varchar(50) default '2.0',
  analysis_method varchar(255) default 'trained_metadata_model_with_dynamic_feedback',
  node_count integer default 0,
  nodes jsonb not null default '[]'::jsonb,
  total_issues integer default 0,
  issues jsonb not null default '[]'::jsonb,
  status varchar(30) default 'completed',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table analysis_sessions
  drop constraint if exists analysis_sessions_last_analysis_id_fkey;
alter table analysis_sessions
  add constraint analysis_sessions_last_analysis_id_fkey
  foreign key (last_analysis_id) references analyses(id) on delete set null;

create table if not exists detected_issues (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references analysis_sessions(id) on delete cascade,
  analysis_id uuid references analyses(id) on delete set null,
  issue_key varchar(700) not null,
  node_id varchar(255),
  node_name varchar(255),
  node_type varchar(100),
  issue_type varchar(255) not null,
  description text not null,
  severity varchar(20) not null check (severity in ('low','medium','high')),
  principle varchar(255),
  confidence_score double precision default 0.85,
  status varchar(20) default 'open' check (status in ('open','resolved','ignored')),
  first_detected_at timestamptz default now(),
  last_detected_at timestamptz default now(),
  resolved_at timestamptz,
  occurrence_count integer default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, issue_key)
);

create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references analysis_sessions(id) on delete cascade,
  issue_id uuid not null references detected_issues(id) on delete cascade,
  analysis_id uuid references analyses(id) on delete set null,
  description text not null,
  short_suggestion text,
  detailed_suggestion text,
  explanation text,
  evidence_summary text,
  priority varchar(20) not null check (priority in ('low','medium','high')),
  fix_type varchar(100) default 'general',
  generated_by varchar(255) default 'Argus Dynamic AI Feedback Generator v1.0',
  generated_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, issue_id)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references analysis_sessions(id) on delete cascade,
  analysis_id uuid references analyses(id) on delete set null,
  title varchar(500) not null,
  summary text not null,
  report_format varchar(20) default 'TXT',
  file_path text,
  generated_at timestamptz default now(),
  total_issues integer default 0,
  high_severity_count integer default 0,
  medium_severity_count integer default 0,
  low_severity_count integer default 0,
  issues jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  export_history jsonb not null default '[]'::jsonb,
  status varchar(30) default 'generated' check (status in ('generated','exported','export_failed','export_cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_analyses_session_id on analyses(session_id);
create index if not exists idx_detected_issues_session_id on detected_issues(session_id);
create index if not exists idx_detected_issues_analysis_id on detected_issues(analysis_id);
create index if not exists idx_suggestions_session_id on suggestions(session_id);
create index if not exists idx_suggestions_issue_id on suggestions(issue_id);
create index if not exists idx_reports_session_id on reports(session_id);

-- The Express backend uses a direct PostgreSQL connection string, not the public Supabase REST API.
-- Therefore no public table access is required. Keep credentials only in the backend .env file.
