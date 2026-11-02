import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const base = "https://spm-longhubang.vercel.app";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || new URL(url).hostname !== "yntycoemqtkawiuyplvz.supabase.co") {
  throw new Error("The intended SPM backend credentials are required.");
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const email = `launch-check-${crypto.randomUUID()}@example.test`;
const password = crypto.randomBytes(32).toString("base64url");
let userId;
let token;
const results = [];

async function cleanupQaAccount(id) {
  // Remove only this generated account's unsubmitted QA sessions.
  for (const [quizzes, items] of [["daily_quizzes", "quiz_items"], ["practice_quizzes", "practice_items"]]) {
    const owned = await admin.from(quizzes).select("id").eq("user_id", id);
    if (owned.error) throw owned.error;
    const ids = (owned.data ?? []).map((row) => row.id);
    if (ids.length) {
      const children = await admin.from(items).delete().in("quiz_id", ids);
      if (children.error) throw children.error;
      const parents = await admin.from(quizzes).delete().eq("user_id", id);
      if (parents.error) throw parents.error;
    }
  }
  const profile = await admin.from("profiles").delete().eq("id", id);
  if (profile.error) throw profile.error;
  const deleted = await admin.auth.admin.deleteUser(id);
  if (deleted.error) throw deleted.error;
  console.log(JSON.stringify({ temporaryQaAccountRemoved: true }));
}

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { response, body };
}

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const profile = await admin.from("profiles").upsert({
    id: userId, display_name: "上线检查", nickname: `检查${Date.now()}`, school_name: "其他", role: "student",
  });
  if (profile.error) throw profile.error;
  const authClient = createClient(url, key, { auth: { persistSession: false } });
  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  token = signedIn.data.session.access_token;
  const anonymous = createClient(url, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const anonymousAnswers = await anonymous.from("questions").select("id,correct_option").limit(1);
  assert.equal(anonymousAnswers.data?.length ?? 0, 0, "Anonymous database access must not reveal answers");
  const studentAnswers = await authClient.from("questions").select("id,correct_option").limit(1);
  assert.equal(studentAnswers.data?.length ?? 0, 0, "Student database access must not reveal answers");
  const directProfileUpdate = await authClient.from("profiles").update({ role: "student", streak_days: 0 }).eq("id", userId).select("id");
  assert.ok(directProfileUpdate.error || !directProfileUpdate.data?.length, "Browser clients must not update server-owned profile fields");
  const visibleProfiles = await authClient.from("profiles").select("id");
  if (visibleProfiles.error) throw visibleProfiles.error;
  assert.deepEqual(visibleProfiles.data.map((row) => row.id), [userId], "Student can read only their own profile");
  const nameUpdate = await api("/api/me", { method: "PATCH", body: JSON.stringify({ nickname: `检查${Date.now()}`, schoolName: "其他" }) });
  assert.equal(nameUpdate.response.status, 200, "Names must still be editable through the authenticated server API");
  const { body: subjectBody, response: subjectResponse } = await api("/api/subjects");
  assert.equal(subjectResponse.status, 200);
  for (const subject of subjectBody.subjects) {
    const started = await api("/api/daily", { method: "POST", body: JSON.stringify({ subject }) });
    assert.equal(started.response.status, 201, `${subject}: daily creation failed`);
    const loaded = await api(`/api/daily?subject=${encodeURIComponent(subject)}`);
    assert.equal(loaded.response.status, 200, `${subject}: daily load failed`);
    const quiz = loaded.body.quiz;
    assert.equal(quiz.items.length, 20);
    assert.equal(quiz.quiz_items, undefined, "Raw question relations must not be returned");
    assert.ok(quiz.items.every((item) => item.question.subject === subject));
    assert.ok(quiz.items.every((item) => item.question.correctOption === undefined && item.question.explanation === undefined));
    const repeated = await api("/api/daily", { method: "POST", body: JSON.stringify({ subject }) });
    assert.equal(repeated.body.id, quiz.id, "Daily questions must remain fixed");
    const reloaded = await api(`/api/daily?subject=${encodeURIComponent(subject)}`);
    assert.deepEqual(reloaded.body.quiz.items.map((item) => item.question.id), quiz.items.map((item) => item.question.id));
    results.push({ subject, dailyQuestions: quiz.items.length, fixedOnReentry: true, answersHidden: true });
  }
  const practice = await api("/api/practice", { method: "POST", body: JSON.stringify({ subject: "Biologi" }) });
  assert.equal(practice.response.status, 201);
  const loadedPractice = await api(`/api/practice?quizId=${practice.body.id}`);
  assert.equal(loadedPractice.response.status, 200);
  assert.equal(loadedPractice.body.quiz.items.length, 20);
  assert.equal(loadedPractice.body.quiz.practice_items, undefined);
  assert.ok(loadedPractice.body.quiz.items.every((item) => item.question.subject === "Biologi" && item.question.correctOption === undefined));
  for (const [kind, quizId, items] of [
    ["practice", practice.body.id, loadedPractice.body.quiz.items],
    ["daily", (await api("/api/daily?subject=Biologi")).body.quiz.id,
      (await api("/api/daily?subject=Biologi")).body.quiz.items],
  ]) {
    const invalidAnswers = Array.from({length: 20}, () => ({itemId: items[0].id, option: "A"}));
    const rejected = await api(`/api/${kind}`, {method: "PATCH", body: JSON.stringify({quizId, answers: invalidAnswers})});
    assert.equal(rejected.response.status, 400, `${kind}: atomic transaction must reject duplicate item IDs`);
    const ownedAnswers = items.map(item => ({itemId: item.id, option: "A"}));
    const absent = await api(`/api/${kind}`, {method: "PATCH", body: JSON.stringify({quizId: crypto.randomUUID(), answers: ownedAnswers})});
    assert.equal(absent.response.status, 404, `${kind}: atomic transaction must reject unknown quiz`);
  }
  const teacher = await api("/api/teacher/questions");
  assert.equal(teacher.response.status, 403, "Students must not access teacher question management");
  const invalid = await api("/api/daily", { method: "POST", body: JSON.stringify({ subject: "" }) });
  assert.equal(invalid.response.status, 400);
  console.log(JSON.stringify({ daily: results, biologyPractice: "passed", studentTeacherAccess: "blocked", invalidSubject: "rejected", directAnswerAccess: "blocked", directRoleAndStreakUpdate: "blocked", serverNameUpdate: "passed", submittedScores: 0 }));
} finally {
  if (userId) {
    await cleanupQaAccount(userId);
  }
}
