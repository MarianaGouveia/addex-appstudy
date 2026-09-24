-- A database round trip without reading or writing participant data.
create or replace function public.study_health_check()
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select true;
$$;

revoke all on function public.study_health_check() from public;
grant execute on function public.study_health_check() to anon;

comment on function public.study_health_check() is
  'Minimal availability check; does not access study logs.';

notify pgrst, 'reload schema';
