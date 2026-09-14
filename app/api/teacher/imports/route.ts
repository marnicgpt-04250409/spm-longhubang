import * as XLSX from "xlsx";
import { apiError, getAdminClient, requireBankManager } from "@/lib/supabase-server";
import { QUESTION_IMAGE_BUCKET, validQuestionImagePath } from "@/lib/question-images";

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const columnAliases: Record<string, string[]> = {
  subject: ["科目", "subject"],
  prompt: ["题干", "prompt", "question"],
  optionA: ["a", "option a", "选项a"],
  optionB: ["b", "option b", "选项b"],
  optionC: ["c", "option c", "选项c"],
  optionD: ["d", "option d", "选项d"],
  correctOption: ["正确答案", "answer", "correct answer"],
  explanation: ["解析（可选）", "解析", "explanation"],
  difficulty: ["难度（可选）", "难度", "difficulty"],
  topic: ["章节／主题（可选）", "章节/主题（可选）", "章节", "主题", "topic"],
  imageFilename: ["图片文件名（可选）", "图片文件名", "image filename", "image"],
  imageAlt: ["图片说明（可选）", "图片说明", "image alt", "alt text"],
};
type ImportedQuestion = {
  subject: string; prompt: string; optionA: string; optionB: string; optionC: string; optionD: string;
  correctOption: "A" | "B" | "C" | "D"; explanation: string | null; difficulty: "基础" | "中等" | "进阶" | null; topic: string | null; contentHash: string; imagePath: string | null; imageAlt: string | null;
};

type ImageManifestItem = { name: string; storagePath: string };

const IMPORT_BATCH_SIZE = 100;

function batches<T>(items: T[], size = IMPORT_BATCH_SIZE) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function clean(value: unknown) { return String(value ?? "").trim(); }
function norm(value: string) { return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " "); }
function getValue(row: Record<string, unknown>, field: string) {
  const key = Object.keys(row).find((candidate) => columnAliases[field].includes(norm(candidate)));
  return key ? clean(row[key]) : "";
}
async function contentHash(parts: string[]) {
  const bytes = new TextEncoder().encode(parts.map(norm).join("\u001f"));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (part) => part.toString(16).padStart(2, "0")).join("");
}
async function parseRows(file: File) {
  const workbook = /\.csv$/i.test(file.name)
    // File.text() preserves UTF-8 (including the BOM commonly exported by Excel).
    // Passing a codepage here causes SheetJS to corrupt Chinese header names, making
    // otherwise valid teacher CSV files appear to have missing required columns.
    ? XLSX.read(await file.text(), { type: "string", raw: false })
    : XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("表格没有可读取的工作表。");
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "", raw: false });
}

export async function POST(request: Request) {
  let uploadedImagePaths: string[] = [];
  try {
    const user = await requireBankManager(request);
    const form = await request.formData();
    const file = form.get("file");
    const manifestRaw = form.get("imageManifest");
    if (!(file instanceof File) || !file.size) return Response.json({ error: "请选择 Excel 或 CSV 表格。" }, { status: 400 });
    if (file.size > MAX_IMPORT_BYTES) return Response.json({ error: "表格不能超过 2MB。" }, { status: 413 });
    if (!/\.(xlsx|csv)$/i.test(file.name)) return Response.json({ error: "只支持 .xlsx 或 .csv 格式。" }, { status: 400 });
    const rows = await parseRows(file);
    if (!rows.length) return Response.json({ error: "表格没有题目资料。" }, { status: 400 });
    const rejected: { row: number; reason: string }[] = [];
    const accepted: ImportedQuestion[] = [];
    const seen = new Set<string>();
    const imageManifest: ImageManifestItem[] = [];
    if (typeof manifestRaw === "string" && manifestRaw) {
      const parsed = JSON.parse(manifestRaw);
      if (!Array.isArray(parsed) || parsed.length > 100)
        return Response.json({ error: "题目图片资料格式不正确。" }, { status: 400 });
      const manifestNames = new Set<string>();
      for (const item of parsed) {
        const name = typeof item?.name === "string" ? item.name.trim() : "";
        const storagePath = item?.storagePath;
        const key = name.toLocaleLowerCase();
        if (!name || manifestNames.has(key) || !validQuestionImagePath(storagePath, user.id))
          return Response.json({ error: "题目图片资料无效，请重新选择图片。" }, { status: 400 });
        manifestNames.add(key);
        imageManifest.push({ name, storagePath });
      }
      uploadedImagePaths = imageManifest.map((item) => item.storagePath);
    }
    const imageByName = new Map(imageManifest.map((item) => [item.name.toLocaleLowerCase(), item.storagePath]));
    for (const [index, row] of rows.entries()) {
      const subject = getValue(row, "subject"); const prompt = getValue(row, "prompt");
      const optionA = getValue(row, "optionA"); const optionB = getValue(row, "optionB"); const optionC = getValue(row, "optionC"); const optionD = getValue(row, "optionD");
      const answer = getValue(row, "correctOption").toUpperCase();
      const rowNumber = index + 2;
      if (![subject, prompt, optionA, optionB, optionC, optionD].every(Boolean)) { rejected.push({ row: rowNumber, reason: "科目、题干和 A-D 选项均不可留空。" }); continue; }
      if (!/^[ABCD]$/.test(answer)) { rejected.push({ row: rowNumber, reason: "正确答案必须是 A、B、C 或 D。" }); continue; }
      const difficultyRaw = getValue(row, "difficulty");
      const difficulty = difficultyRaw ? (({ "基础": "基础", "中等": "中等", "进阶": "进阶" } as const)[difficultyRaw] ?? null) : null;
      if (difficultyRaw && !difficulty) { rejected.push({ row: rowNumber, reason: "难度只能是 基础、中等 或 进阶。" }); continue; }
      const topic = getValue(row, "topic") || null;
      if (topic && topic.length > 120) { rejected.push({ row: rowNumber, reason: "章节／主题不能超过 120 个字符。" }); continue; }
      const hash = await contentHash([subject, prompt, optionA, optionB, optionC, optionD]);
      if (seen.has(hash)) { rejected.push({ row: rowNumber, reason: "与本表较早的题目重复。" }); continue; }
      seen.add(hash);
      const imageFilename = getValue(row, "imageFilename");
      const imagePath = imageFilename ? imageByName.get(imageFilename.toLocaleLowerCase()) || null : null;
      if (imageFilename && !imagePath) { rejected.push({ row: rowNumber, reason: `找不到图片文件：${imageFilename}` }); continue; }
      const imageAlt = getValue(row, "imageAlt") || null;
      if (imageAlt && imageAlt.length > 300) { rejected.push({ row: rowNumber, reason: "图片说明不能超过 300 个字符。" }); continue; }
      accepted.push({ subject, prompt, optionA, optionB, optionC, optionD, correctOption: answer as ImportedQuestion["correctOption"], explanation: getValue(row, "explanation") || null, difficulty, topic, contentHash: hash, imagePath, imageAlt });
    }
    const supabase = getAdminClient();
    const existingHashes = new Set<string>();
    // PostgREST receives `.in()` values in the URL. Querying hundreds of hashes at
    // once exceeds some gateways' request limits, so large teacher banks are safely
    // deduplicated in bounded batches.
    for (const hashBatch of batches(accepted.map((item) => item.contentHash))) {
      const { data: existing, error: existingError } = await supabase.from("questions").select("content_hash").in("content_hash", hashBatch);
      if (existingError) throw existingError;
      for (const item of existing ?? []) existingHashes.add(item.content_hash);
    }
    const newQuestions = accepted.filter((item) => !existingHashes.has(item.contentHash));
    for (const [index, item] of accepted.entries()) if (existingHashes.has(item.contentHash)) rejected.push({ row: index + 2, reason: "题库中已有相同题目。" });
    if (!newQuestions.length) {
      if (uploadedImagePaths.length) await supabase.storage.from(QUESTION_IMAGE_BUCKET).remove(uploadedImagePaths);
      uploadedImagePaths = [];
      return Response.json({ imported: 0, rejected, message: "没有新的有效题目可导入。" });
    }
    const storagePath = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: storageError } = await supabase.storage.from("question-papers").upload(storagePath, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream", upsert: false });
    if (storageError) throw storageError;
    const { data: upload, error: uploadError } = await supabase.from("uploads").insert({ user_id: user.id, filename: file.name, storage_path: storagePath, status: "review" }).select("id").single();
    if (uploadError) throw uploadError;
    for (const questionBatch of batches(newQuestions)) {
      const { error: insertError } = await supabase.from("questions").insert(questionBatch.map((item) => ({ upload_id: upload.id, author_id: user.id, subject: item.subject, prompt: item.prompt, option_a: item.optionA, option_b: item.optionB, option_c: item.optionC, option_d: item.optionD, correct_option: item.correctOption, answer_confirmed: true, explanation: item.explanation, difficulty: item.difficulty, topic: item.topic, image_path: item.imagePath, image_alt: item.imageAlt, source_type: "teacher_submission", source_label: `老师供题：${file.name}`, content_hash: item.contentHash, status: "draft" })));
      if (insertError) throw insertError;
    }
    const retainedPaths = new Set(newQuestions.map((item) => item.imagePath).filter((path): path is string => Boolean(path)));
    const unusedPaths = uploadedImagePaths.filter((path) => !retainedPaths.has(path));
    if (unusedPaths.length) await supabase.storage.from(QUESTION_IMAGE_BUCKET).remove(unusedPaths);
    uploadedImagePaths = [];
    return Response.json({ imported: newQuestions.length, rejected, images: retainedPaths.size, message: `已导入 ${newQuestions.length} 道待审核题目，其中 ${retainedPaths.size} 道含图片。` }, { status: 201 });
  } catch (error) {
    if (uploadedImagePaths.length) {
      try { await getAdminClient().storage.from(QUESTION_IMAGE_BUCKET).remove(uploadedImagePaths); } catch { /* best-effort cleanup */ }
    }
    return apiError(error);
  }
}
