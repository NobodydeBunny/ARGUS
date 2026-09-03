-- ARGUS V6 multi-frame migration for an EXISTING Supabase database.
-- Run once in Supabase Dashboard -> SQL Editor before starting this build.

alter table analysis_sessions
  add column if not exists frame_count integer default 0;

alter table analyses
  add column if not exists frame_count integer default 0;

alter table analyses
  add column if not exists frames jsonb not null default '[]'::jsonb;

alter table detected_issues
  add column if not exists frame_id varchar(255);

alter table detected_issues
  add column if not exists frame_name varchar(255);

create index if not exists idx_detected_issues_frame_id
  on detected_issues(frame_id);
