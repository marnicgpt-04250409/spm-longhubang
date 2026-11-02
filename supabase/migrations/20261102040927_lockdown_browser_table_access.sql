-- Student quiz payloads are served by authenticated server routes using the
-- service role. Direct browser SELECT must not reveal answer-key columns.
drop policy if exists "published questions are readable" on public.questions;
revoke select on public.questions from anon;

-- Profile changes, including names, go through /api/me. Teacher status,
-- streaks and dates are owned by the server, never by a browser UPDATE.
drop policy if exists "users update own profile" on public.profiles;
revoke update on public.profiles from anon, authenticated;

drop policy if exists "profiles are visible to signed-in users" on public.profiles;
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);
