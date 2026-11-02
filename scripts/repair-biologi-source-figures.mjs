import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const figures = [
  [35, "q35-rajah27"], [37, "q37-jadual1"], [38, "q38-charts"], [40, "q40-rajah28"],
].map(([number, name]) => ({
  number, name,
  sourceKey: `trial-spmpaper:2025:mrsm:biologi:k1:q${number}`,
  storagePath: `verified-trial/2025-mrsm-biologi-k1/figures-v2/${name}.webp`,
}));
const fields = "id,source_key,image_path,status,correct_option,prompt,option_a,option_b,option_c,option_d";
const before = await supabase.from("questions").select(fields).in("source_key", figures.map((item) => item.sourceKey));
if (before.error) throw before.error;
assert.equal(before.data.length, 4);
const protectedFields = ({image_path, ...question}) => JSON.stringify(question);
const protectedBefore = new Map(before.data.map((row) => [row.source_key, protectedFields(row)]));
for (const figure of figures) {
  const original = before.data.find((row) => row.source_key === figure.sourceKey);
  assert.ok(original.image_path.startsWith("verified-trial/2025-mrsm-biologi-k1/"));
  const bytes = await fs.readFile(new URL(`../assets/question-images/biologi-mrsm-2025/${figure.name}.webp`, import.meta.url));
  assert.ok(bytes.length > 1000 && bytes.length < 5 * 1024 * 1024);
  const uploaded = await supabase.storage.from("question-images").upload(figure.storagePath, bytes, { contentType: "image/webp", cacheControl: "86400", upsert: false });
  if (uploaded.error && !/already exists/i.test(uploaded.error.message)) throw uploaded.error;
  const signed = await supabase.storage.from("question-images").createSignedUrl(figure.storagePath, 300);
  if (signed.error) throw signed.error;
  const response = await fetch(signed.data.signedUrl);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal((await response.arrayBuffer()).byteLength, bytes.length);
  const updated = await supabase.from("questions").update({ image_path: figure.storagePath }).eq("id", original.id).eq("image_path", original.image_path).select("id");
  if (updated.error) throw updated.error;
  assert.equal(updated.data.length, 1);
}
const after = await supabase.from("questions").select(fields).in("source_key", figures.map((item) => item.sourceKey));
if (after.error) throw after.error;
assert.equal(after.data.length, 4);
for (const row of after.data) {
  assert.equal(protectedFields(row), protectedBefore.get(row.source_key));
  assert.equal(row.image_path, figures.find((item) => item.sourceKey === row.source_key).storagePath);
}
console.log(JSON.stringify({ updatedFigures: 4, allReadable: true, answersAndOptionsUnchanged: true }));
