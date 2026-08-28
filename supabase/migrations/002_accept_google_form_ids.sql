-- New study links identify each participant by the ID of their assigned
-- Google Form. Keep legacy FormN values valid so existing rows remain intact.
alter table public.interaction_logs
  drop constraint if exists interaction_logs_form_code_check;

alter table public.interaction_logs
  add constraint interaction_logs_form_code_check
  check (
    form_code = 'unassigned'
    or form_code ~ '^[A-Za-z0-9_-]{20,200}$'
    or form_code ~ '^Form(0|[1-9][0-9]*)$'
  );

comment on column public.interaction_logs.form_code is
  'Google Form ID assigned to the participant; unassigned when absent. Legacy FormN values may exist in older rows.';
