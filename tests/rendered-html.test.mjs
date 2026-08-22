import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function renderHome() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the real SPM 龙虎榜 entry page", async () => {
  const response = await renderHome();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /SPM 龙虎榜 \| 每日冲刺/);
  assert.match(html, /My Guru Education/);
  assert.match(html, /Google 登录/);
  assert.match(html, /教师中心/);
  assert.match(html, /今天还没有成绩，完成首轮任务即可上榜。/);
  assert.doesNotMatch(html, /Nur Aina|陈宇轩|Malayan Union/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

test("keeps the daily task, practice history, and ranking safeguards in source", async () => {
  const [daily, practice, leaderboard, migration, page] = await Promise.all([
    readFile(new URL("../app/api/daily/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/practice/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/leaderboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/0005_practice_history_and_subjects.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(daily, /quiz\.status\s*===\s*"submitted"[\s\S]{0,100}?question\.correct_option/);
  assert.match(daily, /至少需要 20 道/);
  assert.match(practice, /from\("practice_quizzes"\)/);
  assert.match(practice, /from\("practice_items"\)/);
  assert.match(practice, /from\("practice_quizzes"\)[\s\S]{0,100}?\.update\(/);
  assert.match(migration, /alter table public\.practice_quizzes enable row level security/);
  assert.match(migration, /alter table public\.practice_items enable row level security/);
  assert.match(leaderboard, /previousScore/);
  assert.match(leaderboard, /rank = index \+ 1/);
  assert.match(page, /我的练习记录/);
  assert.match(page, /继续练习/);
  assert.doesNotMatch(page, /Nur Aina|陈宇轩|Malayan Union/);
});
