-- Real database state-machine test. No external calls; every change rolls back.
begin;
set local lock_timeout = '2s';
do $$
declare
  token uuid := gen_random_uuid();
  replacement uuid := gen_random_uuid();
  state public.sheet_sync_state;
  result jsonb;
  acquired integer := 0;
begin
  update public.sheet_sync_state set requested_version=0,synced_version=0,claimed_version=null,
    lease_token=null,lease_until=null,next_attempt_at=now(),failures=0,last_error=null where singleton;
  for i in 1..20 loop perform public.request_sheet_sync(); end loop;
  result := public.claim_sheet_sync(token);
  if (result->>'claimed')::boolean is not true then raise exception 'First claim failed'; end if;
  for i in 1..20 loop
    result := public.claim_sheet_sync(gen_random_uuid());
    if (result->>'claimed')::boolean then acquired := acquired+1; end if;
  end loop;
  if acquired <> 0 then raise exception 'Multiple workers acquired the lease'; end if;
  perform public.request_sheet_sync();
  if not public.finish_sheet_sync(token,true,null) then raise exception 'Acknowledgement failed'; end if;
  select * into state from public.sheet_sync_state where singleton;
  if state.requested_version<>21 or state.synced_version<>20 then raise exception 'Concurrent change was lost'; end if;
  if (public.claim_sheet_sync(replacement)->>'claimed')::boolean then raise exception 'Cooldown ignored'; end if;
  update public.sheet_sync_state set next_attempt_at=now() where singleton;
  perform public.claim_sheet_sync(token);
  perform public.finish_sheet_sync(token,false,'Provider HTTP 429');
  select * into state from public.sheet_sync_state where singleton;
  if state.requested_version<>21 or state.synced_version<>20 or state.failures<>1 or state.next_attempt_at<=now() then
    raise exception 'Failure lost the pending version or retry delay';
  end if;
  update public.sheet_sync_state set next_attempt_at=now() where singleton;
  perform public.claim_sheet_sync(token);
  update public.sheet_sync_state set lease_until=now()-interval '1 second' where singleton;
  result := public.claim_sheet_sync(replacement);
  if (result->>'claimed')::boolean is not true then raise exception 'Expired worker blocked recovery'; end if;
  if public.finish_sheet_sync(token,true,null) then raise exception 'Stale worker acknowledged a replacement lease'; end if;
  if not public.finish_sheet_sync(replacement,true,null) then raise exception 'Replacement could not finish'; end if;
  select * into state from public.sheet_sync_state where singleton;
  if state.requested_version<>state.synced_version or state.failures<>0 then raise exception 'Recovery did not drain pending changes'; end if;
  if has_function_privilege('authenticated','public.claim_sheet_sync(uuid)','execute')
    or has_function_privilege('anon','public.request_sheet_sync()','execute')
    or has_table_privilege('authenticated','public.sheet_sync_state','select') then raise exception 'Queue exposed to browser'; end if;
end;
$$;
rollback;
