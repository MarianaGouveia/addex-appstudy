-- Visits are grouped by session and can be ordered using their timestamps.
-- A Google Form identifier is no longer collected with interaction telemetry.
alter table public.interaction_logs
  drop column if exists form_code;

create index if not exists interaction_logs_pair_received_idx
  on public.interaction_logs (pair_code, received_at);

