-- Server-only transaction: reserve one complete quiz and prefer unseen questions
-- across daily and practice history. A profile lock serializes each student.
create or replace function public.start_quiz_attempt(p_kind text, p_user_id uuid, p_subject text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  today date := (pg_catalog.now() at time zone 'Asia/Kuala_Lumpur')::date;
  attempt_id uuid;
  chosen uuid[];
begin
  if p_kind is null or p_kind not in ('daily','practice') or p_subject is null or pg_catalog.btrim(p_subject) = '' then
    return pg_catalog.jsonb_build_object('error','请选择有效科目。','status',400);
  end if;
  p_subject := pg_catalog.btrim(p_subject);
  perform id from public.profiles where id = p_user_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('error','找不到学生资料。','status',404);
  end if;

  if p_kind = 'daily' then
    select id into attempt_id from public.daily_quizzes
      where user_id = p_user_id and local_date = today and subject = p_subject;
  else
    select attempt.id into attempt_id from public.practice_quizzes attempt
      where attempt.user_id = p_user_id and attempt.subject = p_subject and attempt.status = 'active'
        and (select count(*) from public.practice_items item where item.quiz_id = attempt.id) = 20
        and not exists (
          select 1 from public.practice_items item join public.questions question on question.id = item.question_id
          where item.quiz_id = attempt.id and question.status <> 'published'
        )
      order by attempt.created_at desc, attempt.id limit 1;
  end if;
  if attempt_id is not null then
    return pg_catalog.jsonb_build_object('id',attempt_id,'existing',true);
  end if;

  with history as (
    select item.question_id, quiz.created_at as seen_at from public.quiz_items item
      join public.daily_quizzes quiz on quiz.id = item.quiz_id
      where quiz.user_id = p_user_id and quiz.subject = p_subject
    union all
    select item.question_id, quiz.created_at from public.practice_items item
      join public.practice_quizzes quiz on quiz.id = item.quiz_id
      where quiz.user_id = p_user_id and quiz.subject = p_subject
  ), exposure as (
    select question_id, count(*) as seen_count, max(seen_at) as last_seen from history group by question_id
  ), candidates as (
    select question.id from public.questions question
      left join exposure on exposure.question_id = question.id
      where question.subject = p_subject and question.status = 'published'
      order by coalesce(exposure.seen_count,0), exposure.last_seen asc nulls first, pg_catalog.random()
      limit 20
  ) select pg_catalog.array_agg(id) into chosen from candidates;
  if coalesce(pg_catalog.cardinality(chosen),0) < 20 then
    return pg_catalog.jsonb_build_object('error','此科目至少需要 20 道已发布题目。','status',422);
  end if;

  if p_kind = 'daily' then
    insert into public.daily_quizzes(user_id,local_date,subject) values(p_user_id,today,p_subject) returning id into attempt_id;
    insert into public.quiz_items(quiz_id,question_id,ordinal)
      select attempt_id, id, ordinal from pg_catalog.unnest(chosen) with ordinality as selected(id,ordinal);
  else
    insert into public.practice_quizzes(user_id,local_date,subject) values(p_user_id,today,p_subject) returning id into attempt_id;
    insert into public.practice_items(quiz_id,question_id,ordinal)
      select attempt_id, id, ordinal from pg_catalog.unnest(chosen) with ordinality as selected(id,ordinal);
  end if;
  return pg_catalog.jsonb_build_object('id',attempt_id,'existing',false);
end;
$$;
revoke all on function public.start_quiz_attempt(text,uuid,text) from public,anon,authenticated;
grant execute on function public.start_quiz_attempt(text,uuid,text) to service_role;
