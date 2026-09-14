-- Track where a question came from so MyGuru originals and teacher submissions
-- are visibly distinct during review.  Existing questions remain compatible.
alter table public.questions
  add column if not exists source_type text not null default 'manual'
    check (source_type in ('manual', 'pdf', 'teacher_submission', 'myguru_original')),
  add column if not exists source_label text,
  add column if not exists difficulty text
    check (difficulty is null or difficulty in ('基础', '中等', '进阶')),
  add column if not exists source_key text,
  add column if not exists content_hash text;

create unique index if not exists questions_source_key_unique
  on public.questions(source_key) where source_key is not null;
create unique index if not exists questions_content_hash_unique
  on public.questions(content_hash) where content_hash is not null;
