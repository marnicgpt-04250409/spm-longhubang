-- One database call updates a complete 20-question answer set.  This avoids
-- 20 independent HTTP/database round trips when a student submits a quiz.

create or replace function public.set_daily_quiz_item_answers(
  p_quiz_id uuid,
  p_answers jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.quiz_items as item
  set selected_option = answer.selected_option
  from pg_catalog.jsonb_to_recordset(p_answers) as answer(id uuid, selected_option text)
  where item.quiz_id = p_quiz_id
    and item.id = answer.id
    and answer.selected_option in ('A', 'B', 'C', 'D');

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.set_practice_quiz_item_answers(
  p_quiz_id uuid,
  p_answers jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.practice_items as item
  set selected_option = answer.selected_option
  from pg_catalog.jsonb_to_recordset(p_answers) as answer(id uuid, selected_option text)
  where item.quiz_id = p_quiz_id
    and item.id = answer.id
    and answer.selected_option in ('A', 'B', 'C', 'D');

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke execute on function public.set_daily_quiz_item_answers(uuid, jsonb) from public, anon;
revoke execute on function public.set_practice_quiz_item_answers(uuid, jsonb) from public, anon;
grant execute on function public.set_daily_quiz_item_answers(uuid, jsonb) to authenticated, service_role;
grant execute on function public.set_practice_quiz_item_answers(uuid, jsonb) to authenticated, service_role;
