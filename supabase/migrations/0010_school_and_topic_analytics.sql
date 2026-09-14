-- Schools power the school leaderboard. Topics let MyGuru explain where
-- students struggle without changing existing questions or quiz history.
alter table public.profiles
  add column if not exists school_name text;

alter table public.questions
  add column if not exists topic text;

alter table public.profiles
  drop constraint if exists profiles_school_name_length,
  add constraint profiles_school_name_length
    check (school_name is null or char_length(trim(school_name)) between 2 and 120);

alter table public.questions
  drop constraint if exists questions_topic_length,
  add constraint questions_topic_length
    check (topic is null or char_length(trim(topic)) between 2 and 120);

create index if not exists profiles_school_name_idx
  on public.profiles (school_name)
  where school_name is not null;

create index if not exists questions_subject_topic_idx
  on public.questions (subject, topic)
  where topic is not null;
