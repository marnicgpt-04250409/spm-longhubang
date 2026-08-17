create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'student' check (role in ('student', 'teacher')),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_checkin_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  filename text not null,
  storage_path text not null unique,
  subject text,
  status text not null default 'review' check (status in ('processing', 'review', 'published', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.uploads(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  prompt text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.daily_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  subject text not null,
  status text not null default 'active' check (status in ('active', 'submitted')),
  correct_count integer check (correct_count between 0 and 20),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, local_date)
);

create table if not exists public.quiz_items (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.daily_quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  ordinal integer not null check (ordinal between 1 and 20),
  selected_option text check (selected_option in ('A', 'B', 'C', 'D')),
  unique(quiz_id, ordinal)
);

create index if not exists questions_published_subject_idx on public.questions(status, subject);
create index if not exists daily_quizzes_leaderboard_idx on public.daily_quizzes(local_date, correct_count desc, completed_at asc);
create index if not exists uploads_owner_idx on public.uploads(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.uploads enable row level security;
alter table public.questions enable row level security;
alter table public.daily_quizzes enable row level security;
alter table public.quiz_items enable row level security;

drop policy if exists "profiles are visible to signed-in users" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "published questions are readable" on public.questions;
drop policy if exists "teachers manage own questions" on public.questions;
drop policy if exists "teachers manage own uploads" on public.uploads;
drop policy if exists "users manage own quizzes" on public.daily_quizzes;
drop policy if exists "users manage own quiz items" on public.quiz_items;
drop policy if exists "teachers upload private papers" on storage.objects;
drop policy if exists "teachers access own private papers" on storage.objects;

create policy "profiles are visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "published questions are readable" on public.questions for select using (status = 'published' or author_id = auth.uid());
create policy "teachers manage own questions" on public.questions for all to authenticated using (author_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')) with check (author_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher'));
create policy "teachers manage own uploads" on public.uploads for all to authenticated using (user_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')) with check (user_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher'));
create policy "users manage own quizzes" on public.daily_quizzes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own quiz items" on public.quiz_items for all to authenticated using (exists (select 1 from public.daily_quizzes where id = quiz_id and user_id = auth.uid())) with check (exists (select 1 from public.daily_quizzes where id = quiz_id and user_id = auth.uid()));

insert into storage.buckets (id, name, public) values ('question-papers', 'question-papers', false) on conflict (id) do nothing;
create policy "teachers upload private papers" on storage.objects for insert to authenticated with check (bucket_id = 'question-papers' and exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher'));
create policy "teachers access own private papers" on storage.objects for select to authenticated using (bucket_id = 'question-papers' and owner_id = auth.uid()::text);
