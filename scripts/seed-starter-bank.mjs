import { createClient } from "@supabase/supabase-js";
import { starterQuestionBank } from "../lib/question-bank.ts";

const url = process.env.SPM_SUPABASE_URL;
const serviceRole = process.env.SPM_SUPABASE_SERVICE_ROLE_KEY;
const authorId = process.env.MYGURU_TEACHER_ID;
if (!url || !serviceRole || !authorId) throw new Error("Set SPM Supabase credentials and MYGURU_TEACHER_ID before seeding.");

const client = createClient(url, serviceRole, { auth: { persistSession: false } });
const sourceKeys = starterQuestionBank.map((question) => question.sourceKey);
const { data: existing, error: readError } = await client
  .from("questions")
  .select("source_key")
  .in("source_key", sourceKeys);
if (readError) throw readError;
const existingKeys = new Set((existing ?? []).map((question) => question.source_key));
const rows = starterQuestionBank
  .filter((question) => !existingKeys.has(question.sourceKey))
  .map((question) => ({
    author_id: authorId,
    subject: question.subject,
    prompt: question.prompt,
    option_a: question.optionA,
    option_b: question.optionB,
    option_c: question.optionC,
    option_d: question.optionD,
    correct_option: question.correctOption,
    answer_confirmed: true,
    explanation: question.explanation,
    difficulty: question.difficulty,
    source_type: "myguru_original",
    source_label: "MyGuru 原创模拟练习题",
    source_key: question.sourceKey,
    status: "published",
    published_at: new Date().toISOString(),
  }));
if (rows.length) {
  const { error } = await client.from("questions").insert(rows);
  if (error) throw error;
}
console.log(JSON.stringify({ added: rows.length, total: starterQuestionBank.length }));
