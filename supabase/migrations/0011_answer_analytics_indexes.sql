-- Keep question-level analytics and teacher reports responsive as answer history grows.
create index if not exists practice_items_question_id_idx
  on public.practice_items (question_id);

create index if not exists quiz_items_question_id_idx
  on public.quiz_items (question_id);

create index if not exists questions_author_id_idx
  on public.questions (author_id);

create index if not exists questions_upload_id_idx
  on public.questions (upload_id);
