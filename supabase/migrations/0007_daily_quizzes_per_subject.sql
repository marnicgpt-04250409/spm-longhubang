-- Students choose a subject before starting.  Each subject therefore needs its
-- own daily first attempt; streaks are still updated only once per date.
alter table public.daily_quizzes
  drop constraint if exists daily_quizzes_user_id_local_date_key;

alter table public.daily_quizzes
  add constraint daily_quizzes_user_date_subject_unique
  unique (user_id, local_date, subject);
