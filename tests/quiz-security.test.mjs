import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadModule(file, prelude = "") {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const withoutImports = source.replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, "");
  const { outputText } = ts.transpileModule(prelude + withoutImports, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

for (const [route, relation] of [["daily", "quiz_items"], ["practice", "practice_items"]]) {
  for (const status of ["active", "submitted"]) {
    test(`${route} ${status} returns only safe quiz fields and correctly gates answers`, async () => {
      const raw = {
        id: "quiz-test", subject: "Biologi", status, correct_count: 0, completed_at: null,
        [relation]: [{ id: "item-test", ordinal: 1, selected_option: null, questions: {
          id: "question-test", subject: "Biologi", prompt: "Diagram 1 shows a cell.", topic: "Cell biology",
          option_a: "One", option_b: "Two", option_c: "Three", option_d: "Four",
          correct_option: "C", explanation: "PRIVATE_ANSWER_EXPLANATION", image_path: "diagram.png", image_alt: "A cell",
        } }],
      };
      const prelude = `
        const rawQuiz = ${JSON.stringify(raw)};
        const requireStudentNickname = async () => ({id: "student-test"});
        const malaysiaDate = () => "2026-11-02";
        const signedQuestionImageUrls = async () => new Map([["diagram.png", "https://example.test/diagram.png"]]);
        const apiError = (error) => { throw error; };
        const getAdminClient = () => ({from: () => {
          const query = {select: () => query, eq: () => query, maybeSingle: async () => ({data: rawQuiz, error: null})};
          return query;
        }});
      `;
      const { GET } = await loadModule(`../app/api/${route}/route.ts`, prelude);
      const response = await GET(new Request("https://example.test/api/quiz?subject=Biologi&quizId=quiz-test"));
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.quiz[relation], undefined);
      assert.equal(payload.quiz.items.length, 1);
      const question = payload.quiz.items[0].question;
      assert.equal(question.imageUrl, "https://example.test/diagram.png");
      assert.deepEqual(question.options, ["One", "Two", "Three", "Four"]);
      if (status === "submitted") {
        assert.equal(question.correctOption, "C");
        assert.equal(question.explanation, "PRIVATE_ANSWER_EXPLANATION");
      } else {
        assert.equal(question.correctOption, undefined);
        assert.equal(question.explanation, undefined);
        assert.doesNotMatch(JSON.stringify(payload), /correct_option|PRIVATE_ANSWER_EXPLANATION/);
      }
    });
  }
}

test("publication rejects missing diagrams and placeholder options while permitting complete text questions", async () => {
  const { questionPublicationIssue } = await loadModule("../lib/question-publication.ts");
  const base = {prompt: "Apakah fungsi ribosom?", option_a: "Sintesis protein", option_b: "Respirasi", option_c: "Pengangkutan", option_d: "Pencernaan"};
  assert.equal(questionPublicationIssue(base), null);
  assert.match(questionPublicationIssue({...base, prompt: "Rajah 9 menunjukkan haiwan amfibia."}), /尚未附图/);
  assert.equal(questionPublicationIssue({...base, prompt: "Diagram 1 shows a cell.", image_path: "cell.png"}), null);
  assert.match(questionPublicationIssue({...base, option_a: "Pilihan A"}), /占位/);
  assert.match(questionPublicationIssue({...base, option_d: "Pilihan D dalam rajah"}), /占位/);
  assert.match(questionPublicationIssue({...base, option_d: base.option_a}), /重复/);
});

for (const route of ["daily", "practice"]) {
  test(`${route} start uses verified ownership and preserves resumed attempts`, async () => {
    const handler = await loadModule(`../app/api/${route}/route.ts`, `
      export const calls = [];
      export let outcome = {id: "reserved-quiz", existing: false};
      export function setOutcome(value) { outcome = value; }
      const requireStudentNickname = async () => ({id: "verified-student"});
      const apiError = (error) => { throw error; };
      const getAdminClient = () => ({rpc: async (name, args) => {
        calls.push({name, args}); return {data: outcome, error: null};
      }});
    `);
    const start = subject => handler.POST(new Request("https://example.test", {method: "POST",body: JSON.stringify({subject,userId: "forged"})}));
    assert.equal((await start(" Biologi ")).status, 201);
    assert.deepEqual(handler.calls[0], {name: "start_quiz_attempt",args: {p_kind: route,p_user_id: "verified-student",p_subject: "Biologi"}});
    handler.setOutcome({id: "reserved-quiz",existing: true});
    const resumed = await start("Biologi");
    assert.equal(resumed.status, 200);
    assert.equal((await resumed.json()).id, "reserved-quiz");
    handler.setOutcome({error: "Insufficient questions",status: 422});
    assert.equal((await start("Biologi")).status, 422);
    assert.equal((await start("")).status, 400);
    assert.equal(handler.calls.length, 3);
  });
  test(`${route} submission delegates ownership and scoring to the atomic transaction`, async () => {
    const quizId = "10000000-0000-4000-8000-000000000000";
    const answers = Array.from({length: 20}, (_, i) => ({
      itemId: `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`, option: "B",
    }));
    const prelude = `
      export const calls = [];
      export const effects = [];
      export let outcome = {correct: 13, streak: 2};
      export function setOutcome(value) { outcome = value; }
      const requireStudentNickname = async () => ({id: "verified-student"});
      const after = (callback) => effects.push(callback);
      const syncGoogleSheetSnapshot = async () => {};
      const apiError = (error) => { throw error; };
      const getAdminClient = () => ({rpc: async (name, args) => {
        calls.push({name, args}); return {data: outcome, error: null};
      }});
    `;
    const handler = await loadModule(`../app/api/${route}/route.ts`, prelude);
    const submit = (body) => handler.PATCH(new Request("https://example.test", {
      method: "PATCH", body: JSON.stringify(body),
    }));
    const response = await submit({quizId, answers, userId: "forged-user"});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), route === "daily" ? {correct: 13, streak: 2} : {correct: 13});
    assert.deepEqual(handler.calls[0], {name: "submit_quiz_attempt", args: {
      p_kind: route, p_user_id: "verified-student", p_quiz_id: quizId,
      p_answers: answers.map(a => ({id: a.itemId, selected_option: a.option})),
    }});
    assert.equal(handler.effects.length, 0, "submission must not run provider writes");
    handler.setOutcome({error: "Already submitted", status: 409});
    assert.equal((await submit({quizId, answers})).status, 409);
    assert.equal(handler.effects.length, 0, "rejected retries must not sync the sheet");
    for (const body of [{quizId, answers: [null, ...answers.slice(1)]}, {quizId: "invalid", answers}, {quizId, answers: answers.slice(1)}]) {
      assert.equal((await submit(body)).status, 400);
    }
    assert.equal(handler.calls.length, 2, "invalid input must not reach the database");
  });
}
