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
  for (const status of ["in_progress", "submitted"]) {
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
