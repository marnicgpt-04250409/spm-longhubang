import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

assert.equal(new URL(process.env.SUPABASE_URL).hostname, "yntycoemqtkawiuyplvz.supabase.co");
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const checked = result => { if (result.error) throw result.error; return result.data; };
const subject = "Biologi";
let userId;
async function start(kind, requestedSubject = subject) {
  return checked(await admin.rpc("start_quiz_attempt", {p_kind: kind, p_user_id: userId, p_subject: requestedSubject}));
}
async function items(kind, id) {
  return checked(await admin.from(kind === "daily" ? "quiz_items" : "practice_items").select("id,question_id,ordinal").eq("quiz_id", id).order("ordinal"));
}
async function finish(kind, id, rows) {
  const result = checked(await admin.rpc("submit_quiz_attempt", {p_kind: kind,p_user_id: userId,p_quiz_id: id,p_answers: rows.map(row => ({id: row.id,selected_option: "A"}))}));
  assert.equal(result.error, undefined);
}
try {
  userId = checked(await admin.auth.admin.createUser({email: `selection-check-${crypto.randomUUID()}@example.test`,email_confirm: true})).user.id;
  const bank = checked(await admin.from("questions").select("id").eq("subject",subject).eq("status","published"));
  const seen = new Map(bank.map(row => [row.id, 0]));
  assert.ok(bank.length >= 40);
  assert.equal((await start("daily", "")).status, 400);
  assert.equal((await start("practice", "Nonexistent QA subject")).status, 422);
  const concurrent = await Promise.all(Array.from({length: 20}, () => start("daily")));
  assert.equal(new Set(concurrent.map(row => row.id)).size, 1);
  assert.equal(concurrent.filter(row => !row.existing).length, 1);
  const dailyId = concurrent[0].id;
  const dailyRows = await items("daily", dailyId);
  assert.equal(dailyRows.length, 20);
  for (const row of dailyRows) seen.set(row.question_id, 1);
  await finish("daily", dailyId, dailyRows);
  const rounds = Math.ceil(bank.length / 20);
  for (let round = 0; round < rounds; round++) {
    const starts = await Promise.all(Array.from({length: round === 0 ? 20 : 1}, () => start("practice")));
    assert.equal(new Set(starts.map(row => row.id)).size, 1);
    assert.equal(starts.filter(row => !row.existing).length, 1);
    const rows = await items("practice", starts[0].id);
    assert.equal(rows.length, 20);
    assert.equal(new Set(rows.map(row => row.question_id)).size, 20);
    const unseenBefore = [...seen.values()].filter(count => count === 0).length;
    assert.equal(rows.filter(row => seen.get(row.question_id) === 0).length, Math.min(20, unseenBefore));
    const chosenIds = new Set(rows.map(row => row.question_id));
    const unselectedCounts = [...seen].filter(([id]) => !chosenIds.has(id)).map(([,count]) => count);
    assert.ok(Math.max(...rows.map(row => seen.get(row.question_id))) <= Math.min(...unselectedCounts));
    for (const row of rows) seen.set(row.question_id, seen.get(row.question_id) + 1);
    await finish("practice", starts[0].id, rows);
  }
  assert.ok([...seen.values()].every(count => count > 0));
  const unchanged = await start("daily");
  assert.equal(unchanged.id, dailyId);
  assert.equal(unchanged.existing, true);
  assert.deepEqual(await items("daily", dailyId), dailyRows.map(row => ({...row})));
  console.log(JSON.stringify({subject,publishedQuestions: bank.length,concurrentDailyStarts: 20,concurrentPracticeStarts: 20,oneCompleteAttemptPerStart: true,allUnseenQuestionsUsedBeforeRepeats: true,leastSeenQuestionsPreferred: true,dailyRemainsLocked: true,practiceRounds: rounds}));
} finally {
  if (userId) checked(await admin.auth.admin.deleteUser(userId));
  console.log(JSON.stringify({temporarySelectionAccountRemoved: true}));
}
