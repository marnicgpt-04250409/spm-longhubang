import { apiError, getAdminClient, requireBankManager } from "@/lib/supabase-server";
import { extractAbcdQuestions, type ExtractedQuestion } from "@/lib/pdf-question-parser";

const MAX_PDF_BYTES = 15 * 1024 * 1024;

function safeStorageName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "question-paper.pdf";
}

function validStoragePath(path: unknown, userId: string): path is string {
  if (typeof path !== "string") return false;
  const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapedUserId}/[0-9a-f-]{36}-[A-Za-z0-9._-]+$`, "i").test(path);
}

async function finishImport({
  userId,
  filename,
  subject,
  storagePath,
}: {
  userId: string;
  filename: string;
  subject: string;
  storagePath: string;
}) {
  const supabase = getAdminClient();
  const { data: file, error: downloadError } = await supabase.storage
    .from("question-papers")
    .download(storagePath);
  if (downloadError || !file) throw downloadError || new Error("无法读取已上传的 PDF。");

  const fileBytes = await file.arrayBuffer();
  const { data, error } = await supabase
    .from("uploads")
    .insert({ user_id: userId, filename, storage_path: storagePath, subject: subject || null, status: "processing" })
    .select("id,filename,subject,status,created_at")
    .single();
  if (error) throw error;

  let extracted: ExtractedQuestion[] = [];
  try {
    extracted = await extractAbcdQuestions(fileBytes);
  } catch {
    /* Text extraction failures remain an empty review import. */
  }
  if (extracted.length && subject) {
    const { error: draftError } = await supabase.from("questions").insert(
      extracted.map((question) => ({
        upload_id: data.id,
        author_id: userId,
        subject,
        prompt: question.prompt,
        option_a: question.optionA,
        option_b: question.optionB,
        option_c: question.optionC,
        option_d: question.optionD,
        correct_option: "A",
        answer_confirmed: false,
        source_type: "pdf",
        source_label: `PDF：${filename}`,
        status: "draft",
      })),
    );
    if (draftError) throw draftError;
  }
  const { data: finished, error: statusError } = await supabase
    .from("uploads")
    .update({ status: "review" })
    .eq("id", data.id)
    .select("id,filename,subject,status,created_at")
    .single();
  if (statusError) throw statusError;
  return { upload: finished, extracted: extracted.length };
}

export async function GET(request: Request) {
  try {
    const user = await requireBankManager(request);
    const { data, error } = await getAdminClient().from("uploads").select("id,filename,subject,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ uploads: data });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireBankManager(request);
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json();
      const action = body?.action;
      const subject = typeof body?.subject === "string" ? body.subject.trim() : "";

      if (action === "initiate") {
        const filename = typeof body?.filename === "string" ? body.filename : "";
        const type = typeof body?.type === "string" ? body.type : "";
        const size = typeof body?.size === "number" ? body.size : 0;
        if (!filename || type !== "application/pdf" || size <= 0)
          return Response.json({ error: "请选择文字型 PDF 文件。" }, { status: 400 });
        if (size > MAX_PDF_BYTES)
          return Response.json({ error: "PDF 不能超过 15MB。" }, { status: 413 });
        const storagePath = `${user.id}/${crypto.randomUUID()}-${safeStorageName(filename)}`;
        const { data, error } = await getAdminClient()
          .storage.from("question-papers")
          .createSignedUploadUrl(storagePath);
        if (error || !data) throw error || new Error("无法建立安全上传通道。");
        return Response.json({ storagePath, token: data.token });
      }

      if (action === "finalize") {
        const filename = typeof body?.filename === "string" ? body.filename : "";
        const storagePath = body?.storagePath;
        if (!filename || !validStoragePath(storagePath, user.id))
          return Response.json({ error: "上传资料无效，请重新选择 PDF。" }, { status: 400 });
        const result = await finishImport({ userId: user.id, filename, subject, storagePath });
        return Response.json({
          ...result,
          message: result.extracted
            ? `已提取 ${result.extracted} 道待审核草稿；请逐题确认正确答案后发布。`
            : "PDF 已保存，但未识别到完整 ABCD 结构；请手动建立题目。",
        }, { status: 201 });
      }
      return Response.json({ error: "无效上传请求。" }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const subject = String(form.get("subject") || "").trim();
    if (!(file instanceof File) || file.type !== "application/pdf" || file.size === 0) return Response.json({ error: "请选择文字型 PDF 文件。" }, { status: 400 });
    if (file.size > MAX_PDF_BYTES) return Response.json({ error: "PDF 不能超过 15MB。" }, { status: 413 });
    const safeName = safeStorageName(file.name);
    const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const supabase = getAdminClient();
    const fileBytes = await file.arrayBuffer();
    const { error: storageError } = await supabase.storage.from("question-papers").upload(storagePath, fileBytes, { contentType: "application/pdf", upsert: false });
    if (storageError) throw storageError;
    const result = await finishImport({ userId: user.id, filename: file.name, subject, storagePath });
    return Response.json({ ...result, message: result.extracted ? `已提取 ${result.extracted} 道待审核草稿；请逐题确认正确答案后发布。` : "PDF 已保存，但未识别到完整 ABCD 结构；请手动建立题目。" }, { status: 201 });
  } catch (error) { return apiError(error); }
}
