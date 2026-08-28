create table if not exists public.interaction_logs (
  id uuid primary key,
  received_at timestamptz not null default now(),
  client_timestamp timestamptz not null,
  session_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  form_code text not null check (form_code ~ '^Form(0|[1-9][0-9]*)$'),
  pair_code text not null check (
    pair_code ~ '^(DR1_DB00175_DOID1936|DR2_DB01222_DOID2841|DR3_DB01039_DOID3393|DTI1_DB00714_NCBI1813|DTI2_DB01114_NCBI1565|DTI3_DB01183_4988)_(graph|text|hybrid|sumarize)$'
  ),
  task_id text not null check (task_id in ('DR1', 'DR2', 'DR3', 'DTI1', 'DTI2', 'DTI3')),
  source_id text not null check (char_length(source_id) between 1 and 40),
  target_id text not null check (char_length(target_id) between 1 and 40),
  modality text not null check (modality in ('graph', 'text', 'hybrid', 'sumarize')),
  persona text not null check (char_length(persona) <= 80),
  dataset text not null check (char_length(dataset) <= 80),
  event_name text not null check (char_length(event_name) between 1 and 80),
  elapsed_ms bigint not null check (elapsed_ms >= 0),
  event_data jsonb not null default '{}'::jsonb,
  schema_version smallint not null default 1 check (schema_version > 0),
  unique (session_id, sequence_number)
);

create index if not exists interaction_logs_form_pair_idx
  on public.interaction_logs (form_code, pair_code);

create index if not exists interaction_logs_session_sequence_idx
  on public.interaction_logs (session_id, sequence_number);

alter table public.interaction_logs enable row level security;

revoke all on table public.interaction_logs from anon, authenticated;
grant insert on table public.interaction_logs to anon;

drop policy if exists "study participants can append logs" on public.interaction_logs;
create policy "study participants can append logs"
  on public.interaction_logs
  for insert
  to anon
  with check (
    schema_version = 1
    and pg_column_size(event_data) <= 32768
  );

comment on table public.interaction_logs is
  'Pseudonymous interaction telemetry for the explanation study. Anonymous clients may insert but cannot read, update, or delete rows.';
