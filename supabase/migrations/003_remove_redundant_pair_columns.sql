-- pair_code is the canonical study-pair identifier and already encodes the
-- task, source, target, and modality. Remove their redundant table columns.
alter table public.interaction_logs
  drop column if exists task_id,
  drop column if exists source_id,
  drop column if exists target_id,
  drop column if exists modality;

comment on column public.interaction_logs.pair_code is
  'Canonical identifier encoding task, source, target, and modality.';
