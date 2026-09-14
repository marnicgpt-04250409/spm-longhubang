import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { starterQuestionBank } from "../lib/question-bank.ts";

function loadLocalEnv() {
  const text = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadLocalEnv();
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase production credentials are unavailable.");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const desired = starterQuestionBank.filter((question) => question.subject === "Matematik");
if (desired.length !== 40 || desired.some((question) => !question.prompt.includes(" / "))) {
  throw new Error("The local Mathematics starter bank must contain exactly 40 bilingual prompts.");
}

const fields = "id,source_key,prompt,option_a,option_b,option_c,option_d,correct_option,status,answer_confirmed";
const { data: before, error: readError } = await supabase
  .from("questions")
  .select(fields)
  .in("source_key", desired.map((question) => question.sourceKey));
if (readError) throw readError;
if (before.length !== desired.length) {
  throw new Error(`Expected ${desired.length} starter Mathematics rows, found ${before.length}.`);
}

const desiredByKey = new Map(desired.map((question) => [question.sourceKey, question.prompt]));
const protectedSnapshot = new Map(before.map((row) => [
  row.source_key,
  JSON.stringify({
    option_a: row.option_a,
    option_b: row.option_b,
    option_c: row.option_c,
    option_d: row.option_d,
    correct_option: row.correct_option,
    status: row.status,
    answer_confirmed: row.answer_confirmed,
  }),
]));
const pending = before.filter((row) => row.prompt !== desiredByKey.get(row.source_key));

if (process.argv.includes("--apply")) {
  for (const row of pending) {
    const { error } = await supabase
      .from("questions")
      .update({ prompt: desiredByKey.get(row.source_key) })
      .eq("id", row.id);
    if (error) throw error;
  }
}

const { data: verified, error: verifyError } = await supabase
  .from("questions")
  .select(fields)
  .in("source_key", desired.map((question) => question.sourceKey));
if (verifyError) throw verifyError;

if (process.argv.includes("--apply")) {
  const invalid = verified.filter((row) => row.prompt !== desiredByKey.get(row.source_key));
  const protectedChanges = verified.filter((row) => protectedSnapshot.get(row.source_key) !== JSON.stringify({
    option_a: row.option_a,
    option_b: row.option_b,
    option_c: row.option_c,
    option_d: row.option_d,
    correct_option: row.correct_option,
    status: row.status,
    answer_confirmed: row.answer_confirmed,
  }));
  if (invalid.length || protectedChanges.length) {
    throw new Error(`Verification failed: ${invalid.length} prompt errors, ${protectedChanges.length} protected-field changes.`);
  }
}

const { data: allMathematics, error: auditError } = await supabase
  .from("questions")
  .select("prompt,status")
  .eq("subject", "Matematik")
  .range(0, 999);
if (auditError) throw auditError;

console.log(JSON.stringify({
  mode: process.argv.includes("--apply") ? "apply" : "dry-run",
  changed: process.argv.includes("--apply") ? pending.length : 0,
  pending: process.argv.includes("--apply") ? 0 : pending.length,
  starterBilingual: verified.filter((row) => row.prompt.includes(" / ")).length,
  totalMathematics: allMathematics.length,
  allPromptsBilingual: allMathematics.every((row) => row.prompt.includes(" / ")),
  published: allMathematics.filter((row) => row.status === "published").length,
}));
