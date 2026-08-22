-- This trigger runs as the database owner when auth.users receives a new row.
-- It must not be exposed as a callable RPC to browser roles.
revoke execute on function public.handle_new_profile() from anon, authenticated;
