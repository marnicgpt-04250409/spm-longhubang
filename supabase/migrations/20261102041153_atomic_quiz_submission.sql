-- The authenticated server supplies the verified user ID. Browser roles cannot
-- execute this function. A row lock makes simultaneous retries deterministic.
create or replace function public.submit_quiz_attempt(
  p_kind text, p_user_id uuid, p_quiz_id uuid, p_answers jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  attempt record;
  profile record;
  today date := (pg_catalog.now() at time zone 'Asia/Kuala_Lumpur')::date;
  item_count integer;
  matched_count integer;
  unique_count integer;
  correct integer;
  streak integer;
begin
  if p_kind not in ('daily', 'practice') or p_kind is null
    or pg_catalog.jsonb_typeof(p_answers) is distinct from 'array' then
    return pg_catalog.jsonb_build_object('error', '提交资料不完整。', 'status', 400);
  end if;
  if pg_catalog.jsonb_array_length(p_answers) <> 20 then
    return pg_catalog.jsonb_build_object('error', '必须提交完整的 20 题。', 'status', 400);
  end if;

  if p_kind = 'daily' then
    select * into attempt from public.daily_quizzes
      where id = p_quiz_id and user_id = p_user_id and local_date = today for update;
  else
    select * into attempt from public.practice_quizzes
      where id = p_quiz_id and user_id = p_user_id for update;
  end if;
  if attempt.id is null then
    return pg_catalog.jsonb_build_object('error', '找不到这次任务。', 'status', 404);
  end if;
  if attempt.status <> 'active' then
    return pg_catalog.jsonb_build_object('error', '这次任务已经提交。', 'status', 409);
  end if;

  if p_kind = 'daily' then
    select count(*) into item_count from public.quiz_items where quiz_id = p_quiz_id;
    select count(*), count(distinct item.id) into matched_count, unique_count
      from public.quiz_items item
      join pg_catalog.jsonb_to_recordset(p_answers) as answer(id uuid, selected_option text)
        on item.id = answer.id and answer.selected_option in ('A','B','C','D')
      where item.quiz_id = p_quiz_id;
  else
    select count(*) into item_count from public.practice_items where quiz_id = p_quiz_id;
    select count(*), count(distinct item.id) into matched_count, unique_count
      from public.practice_items item
      join pg_catalog.jsonb_to_recordset(p_answers) as answer(id uuid, selected_option text)
        on item.id = answer.id and answer.selected_option in ('A','B','C','D')
      where item.quiz_id = p_quiz_id;
  end if;
  if item_count <> 20 or matched_count <> 20 or unique_count <> 20 then
    return pg_catalog.jsonb_build_object('error', '答案与题目不一致。', 'status', 400);
  end if;

  if p_kind = 'daily' then
    update public.quiz_items item set selected_option = answer.selected_option
      from pg_catalog.jsonb_to_recordset(p_answers) as answer(id uuid, selected_option text)
      where item.quiz_id = p_quiz_id and item.id = answer.id;
    select count(*) into correct from public.quiz_items item
      join public.questions question on question.id = item.question_id
      where item.quiz_id = p_quiz_id and item.selected_option = question.correct_option;
    update public.daily_quizzes set status = 'submitted', correct_count = correct, completed_at = pg_catalog.now()
      where id = p_quiz_id;

    -- Different subjects completed by the same student also serialize here.
    select streak_days, last_checkin_date into profile from public.profiles where id = p_user_id for update;
    streak := case when profile.last_checkin_date = today then profile.streak_days
      when profile.last_checkin_date = today - 1 then profile.streak_days + 1 else 1 end;
    update public.profiles set streak_days = streak, last_checkin_date = today where id = p_user_id;
    return pg_catalog.jsonb_build_object('correct', correct, 'streak', streak);
  else
    update public.practice_items item set selected_option = answer.selected_option
      from pg_catalog.jsonb_to_recordset(p_answers) as answer(id uuid, selected_option text)
      where item.quiz_id = p_quiz_id and item.id = answer.id;
    select count(*) into correct from public.practice_items item
      join public.questions question on question.id = item.question_id
      where item.quiz_id = p_quiz_id and item.selected_option = question.correct_option;
    update public.practice_quizzes set status = 'submitted', correct_count = correct, completed_at = pg_catalog.now()
      where id = p_quiz_id;
    return pg_catalog.jsonb_build_object('correct', correct);
  end if;
end;
$$;

revoke all on function public.submit_quiz_attempt(text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_quiz_attempt(text, uuid, uuid, jsonb) to service_role;
