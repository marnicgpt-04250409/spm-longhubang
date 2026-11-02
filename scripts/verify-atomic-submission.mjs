import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
assert.equal(new URL(url).hostname, "yntycoemqtkawiuyplvz.supabase.co");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
let userId;
const checked = (result) => { if (result.error) throw result.error; return result.data; };
const wrong = (answer) => answer === "A" ? "B" : "A";
const priorDay = days => {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate()-days);
  return date.toISOString().slice(0,10);
};

async function seed(kind, localDate = today, subject = "Matematik") {
  const quizTable = kind === "daily" ? "daily_quizzes" : "practice_quizzes";
  const itemTable = kind === "daily" ? "quiz_items" : "practice_items";
  const questions = checked(await admin.from("questions").select("id,correct_option").eq("subject", subject).eq("status", "published").limit(20));
  const quiz = checked(await admin.from(quizTable).insert({user_id:userId,subject,local_date:localDate}).select("id").single());
  const items = checked(await admin.from(itemTable).insert(questions.map((q,index)=>({quiz_id:quiz.id,question_id:q.id,ordinal:index+1}))).select("id,question_id,ordinal"));
  const answerById = new Map(questions.map((q)=>[q.id,q.correct_option]));
  return {id:quiz.id, quizTable, itemTable, answers:items.sort((a,b)=>a.ordinal-b.ordinal).map((item,index)=>({id:item.id,selected_option:index<13?answerById.get(item.question_id):wrong(answerById.get(item.question_id))})), wrongAnswers:items.map((item)=>({id:item.id,selected_option:wrong(answerById.get(item.question_id))})), answerById};
}
async function submit(kind, quiz, answers = quiz.answers, owner = userId) {
  return checked(await admin.rpc("submit_quiz_attempt", {p_kind:kind,p_user_id:owner,p_quiz_id:quiz.id,p_answers:answers}));
}
async function cleanup() {
  if (!userId) return;
  const result = await admin.auth.admin.deleteUser(userId);
  if (result.error) throw result.error;
  console.log(JSON.stringify({temporarySubmissionAccountRemoved:true}));
}

try {
  const created = checked(await admin.auth.admin.createUser({email:`submission-check-${crypto.randomUUID()}@example.test`,password:crypto.randomBytes(32).toString("base64url"),email_confirm:true}));
  userId = created.user.id;
  const quiz = await seed("daily");
  assert.equal((await submit("daily",quiz,quiz.answers.slice(0,19))).status,400);
  assert.equal((await submit("daily",quiz,Array(20).fill(quiz.answers[0]))).status,400);
  assert.equal((await submit("daily",quiz,quiz.answers,crypto.randomUUID())).status,404);
  const unchanged = checked(await admin.from("quiz_items").select("selected_option").eq("quiz_id",quiz.id));
  assert.ok(unchanged.every((item)=>item.selected_option===null));
  const outcomes = await Promise.all(Array.from({length:20},(_,index)=>submit("daily",quiz,index%2?quiz.answers:quiz.wrongAnswers)));
  assert.equal(outcomes.filter((r)=>!r.error).length,1);
  assert.equal(outcomes.filter((r)=>r.status===409).length,19);
  const saved = checked(await admin.from("daily_quizzes").select("status,correct_count").eq("id",quiz.id).single());
  const savedItems = checked(await admin.from("quiz_items").select("selected_option,question_id").eq("quiz_id",quiz.id));
  const actualScore = savedItems.filter((item)=>item.selected_option===quiz.answerById.get(item.question_id)).length;
  assert.equal(saved.correct_count,actualScore);
  assert.equal(saved.status,"submitted");
  const profile = checked(await admin.from("profiles").select("streak_days,last_checkin_date").eq("id",userId).single());
  assert.equal(profile.streak_days,1);
  assert.equal(profile.last_checkin_date,today);
  const practice = await seed("practice");
  const practiceResult = await submit("practice",practice);
  assert.equal(practiceResult.correct,13);
  assert.equal((await submit("practice",practice)).status,409);
  const afterPractice = checked(await admin.from("daily_quizzes").select("correct_count").eq("id",quiz.id).single());
  assert.equal(afterPractice.correct_count,saved.correct_count);
  const expired = await seed("daily",priorDay(1));
  assert.equal((await submit("daily",expired)).status,404);
  const expiredItems = checked(await admin.from("quiz_items").select("selected_option").eq("quiz_id",expired.id));
  assert.ok(expiredItems.every(item=>item.selected_option===null));
  checked(await admin.from("profiles").update({streak_days:5,last_checkin_date:priorDay(1)}).eq("id",userId));
  const continued = await seed("daily",today,"Sains");
  assert.equal((await submit("daily",continued)).streak,6);
  const sameDay = await seed("daily",today,"Biologi");
  assert.equal((await submit("daily",sameDay)).streak,6);
  checked(await admin.from("profiles").update({streak_days:5,last_checkin_date:priorDay(2)}).eq("id",userId));
  const reset = await seed("daily",today,"Fizik");
  assert.equal((await submit("daily",reset)).streak,1);
  const resumed = await seed("practice",priorDay(1));
  assert.equal((await submit("practice",resumed)).correct,13);
  const completion = checked(await admin.from("practice_quizzes").select("local_date").eq("id",resumed.id).single());
  assert.equal(completion.local_date,today);
  console.log(JSON.stringify({invalidAnswersRejected:true,wrongOwnerRejected:true,simultaneousSubmissions:20,successfulSubmissions:1,duplicatesRejected:19,scoreMatchesSavedAnswers:true,practiceScore:13,practiceDoesNotChangeDailyScore:true,expiredDailyRejected:true,consecutiveDayStreak:6,sameDayStreakUnchanged:true,missedDayResetsStreak:true,resumedPracticeCountedOnCompletionDate:true}));
} finally {
  await cleanup();
}
