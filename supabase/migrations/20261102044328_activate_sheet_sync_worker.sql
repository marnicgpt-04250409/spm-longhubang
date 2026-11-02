-- Apply only once the worker is deployed and generated load-test users are gone.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
-- Keep worker authentication headers inaccessible to browser roles.
revoke usage on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
grant usage on schema net to postgres;
grant all on all tables in schema net to postgres;
grant usage on all sequences in schema net to postgres;

create function public.queue_completed_quiz_sheet_sync() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status='submitted' and old.status is distinct from new.status then
    perform public.request_sheet_sync();
  end if;
  return null;
end;
$$;
create function public.queue_profile_sheet_sync() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.request_sheet_sync();
  return null;
end;
$$;
revoke all on function public.queue_completed_quiz_sheet_sync() from public,anon,authenticated;
revoke all on function public.queue_profile_sheet_sync() from public,anon,authenticated;
grant execute on function public.queue_completed_quiz_sheet_sync() to service_role;
grant execute on function public.queue_profile_sheet_sync() to service_role;

create trigger daily_completed_sheet_sync after update of status on public.daily_quizzes
  for each row execute function public.queue_completed_quiz_sheet_sync();
create trigger practice_completed_sheet_sync after update of status on public.practice_quizzes
  for each row execute function public.queue_completed_quiz_sheet_sync();
create trigger profile_sheet_sync after insert or update of nickname,school_name or delete on public.profiles
  for each row execute function public.queue_profile_sheet_sync();

-- The version persists across HTTP/network failures; idle ticks make no requests.
-- Cleanup is scoped to this job's own old execution history.
select cron.schedule('myguru-sheet-sync', '* * * * *', $job$
  select net.http_post(
    url := 'https://spm-longhubang.vercel.app/api/internal/sheet-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='myguru_sheet_sync_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000
  ) from public.sheet_sync_state
  where singleton and requested_version>synced_version and next_attempt_at<=now()
    and (lease_until is null or lease_until<=now());
  delete from cron.job_run_details
    where jobid=(select jobid from cron.job where jobname='myguru-sheet-sync')
      and end_time<now()-interval '7 days';
$job$);
select public.request_sheet_sync();
