-- Unlimited practice attempts are deliberately separated from the one scored
-- daily attempt.  They preserve a student's learning history without affecting
-- the daily leaderboard.
create table if not exists public.practice_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  subject text not null,
  status text not null default 'active' check (status in ('active', 'submitted')),
  correct_count integer check (correct_count between 0 and 20),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.practice_items (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.practice_quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  ordinal integer not null check (ordinal between 1 and 20),
  selected_option text check (selected_option in ('A', 'B', 'C', 'D')),
  unique(quiz_id, ordinal)
);

create index if not exists practice_quizzes_user_history_idx
  on public.practice_quizzes(user_id, completed_at desc);
create index if not exists practice_items_quiz_idx on public.practice_items(quiz_id, ordinal);

alter table public.practice_quizzes enable row level security;
alter table public.practice_items enable row level security;

drop policy if exists "users read own practice quizzes" on public.practice_quizzes;
drop policy if exists "users read own practice items" on public.practice_items;

create policy "users read own practice quizzes" on public.practice_quizzes for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users read own practice items" on public.practice_items for select to authenticated
using (exists (select 1 from public.practice_quizzes where id = quiz_id and user_id = (select auth.uid())));
