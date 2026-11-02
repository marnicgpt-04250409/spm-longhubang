create table public.sheet_sync_state (
  singleton boolean primary key default true check (singleton),
  requested_version bigint not null default 0,
  synced_version bigint not null default 0,
  claimed_version bigint,
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  failures integer not null default 0,
  last_error text,
  last_synced_at timestamptz
);
alter table public.sheet_sync_state enable row level security;
revoke all on public.sheet_sync_state from anon, authenticated;
grant all on public.sheet_sync_state to service_role;
insert into public.sheet_sync_state(singleton) values(true);

create function public.request_sheet_sync() returns bigint
language sql security invoker set search_path = '' as $$
  update public.sheet_sync_state set requested_version = requested_version + 1 where singleton
    returning requested_version;
$$;

create function public.claim_sheet_sync(p_token uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare state public.sheet_sync_state;
begin
  select * into state from public.sheet_sync_state where singleton for update;
  if p_token is null or state.requested_version <= state.synced_version
    or state.lease_until > pg_catalog.now() or state.next_attempt_at > pg_catalog.now() then
    return pg_catalog.jsonb_build_object('claimed',false);
  end if;
  update public.sheet_sync_state set lease_token=p_token, lease_until=pg_catalog.now()+interval '180 seconds',
    claimed_version=requested_version where singleton;
  return pg_catalog.jsonb_build_object('claimed',true,'version',state.requested_version);
end;
$$;

create function public.finish_sheet_sync(p_token uuid, p_success boolean, p_error text) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  if p_success then
    update public.sheet_sync_state set synced_version=claimed_version, claimed_version=null,
      lease_token=null, lease_until=null, next_attempt_at=pg_catalog.now()+interval '60 seconds',
      failures=0, last_error=null, last_synced_at=pg_catalog.now()
      where singleton and lease_token=p_token and lease_until>pg_catalog.now();
  else
    update public.sheet_sync_state set claimed_version=null, lease_token=null, lease_until=null,
      next_attempt_at=pg_catalog.now()+pg_catalog.make_interval(secs => least(900,60*pg_catalog.power(2,least(failures,4)))::integer),
      failures=failures+1,last_error=pg_catalog.left(p_error,200)
      where singleton and lease_token=p_token and lease_until>pg_catalog.now();
  end if;
  return found;
end;
$$;

revoke all on function public.request_sheet_sync() from public,anon,authenticated;
revoke all on function public.claim_sheet_sync(uuid) from public,anon,authenticated;
revoke all on function public.finish_sheet_sync(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.request_sheet_sync() to service_role;
grant execute on function public.claim_sheet_sync(uuid) to service_role;
grant execute on function public.finish_sheet_sync(uuid,boolean,text) to service_role;

-- Install triggers only after worker deployment and the capacity test cleanup.
-- This migration intentionally does not start any external requests.
