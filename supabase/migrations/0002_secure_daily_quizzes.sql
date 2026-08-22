-- Scores are calculated only in the server API using the service role.  Students
-- may read their own history, but cannot create or alter scored records directly.
drop policy if exists "users manage own quizzes" on public.daily_quizzes;
drop policy if exists "users manage own quiz items" on public.quiz_items;

create policy "users read own quizzes" on public.daily_quizzes for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users read own quiz items" on public.quiz_items for select to authenticated
using (exists (select 1 from public.daily_quizzes where id = quiz_id and user_id = (select auth.uid())));

-- A profile is created safely when a user first signs in.  Role remains server-owned.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'SPM 学生'))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_profile() from public;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_profile();
