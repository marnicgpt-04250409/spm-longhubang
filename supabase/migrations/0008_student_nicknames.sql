alter table public.profiles
  add column if not exists nickname text,
  add column if not exists nickname_set_at timestamptz;

create unique index if not exists profiles_nickname_unique
  on public.profiles (lower(nickname)) where nickname is not null;
