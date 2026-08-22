import { apiError, getAdminClient, requireTeacher } from "@/lib/supabase-server";
import { extractAbcdQuestions, type ExtractedQuestion } from "@/lib/pdf-question-parser";

export async function GET(request: Request) {
  try {
    const user = await requireTeacher(request);
    const { data, error } = await getAdminClient().from("uploads").select("id,filename,subject,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ uploads: data });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireTeacher(request);
    const form = await request.formData();
    const file = form.get("file");
    const subject = String(form.get("subject") || "").trim();
    if (!(file instanceof File) || file.type !== "application/pdf" || file.size === 0) return Response.json({ error: "请选择文字型 PDF 文件。" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return Response.json({ error: "PDF 不能超过 15MB。" }, { status: 413 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const supabase = getAdminClient();
    const fileBytes = await file.arrayBuffer();
    const { error: storageError } = await supabase.storage.from("question-papers").upload(storagePath, fileBytes, { contentType: "application/pdf", upsert: false });
    if (storageError) throw storageError;
    const { data, error } = await supabase.from("uploads").insert({ user_id: user.id, filename: file.name, storage_path: storagePath, subject: subject || null, status: "processing" }).select("id,filename,subject,status,created_at").single();
    if (error) throw error;
    let extracted: ExtractedQuestion[] = [];
    try { extracted = await extractAbcdQuestions(fileBytes); } catch { /* Text extraction failures remain an empty review import. */ }
    if (extracted.length && subject) {
      const { error: draftError } = await supabase.from("questions").insert(extracted.map((question) => ({ upload_id: data.id, author_id: user.id, subject, prompt: question.prompt, option_a: question.optionA, option_b: question.optionB, option_c: question.optionC, option_d: question.optionD, correct_option: "A", answer_confirmed: false, status: "draft" })));
      if (draftError) throw draftError;
    }
    const { data: finished, error: statusError } = await supabase.from("uploads").update({ status: "review" }).eq("id", data.id).select("id,filename,subject,status,created_at").single();
    if (statusError) throw statusError;
    return Response.json({ upload: finished, extracted: extracted.length, message: extracted.length ? `已提取 ${extracted.length} 道待审核草稿；请逐题确认正确答案后发布。` : "PDF 已保存，但未识别到完整 ABCD 结构；请手动建立题目。" }, { status: 201 });
  } catch (error) { return apiError(error); }
}
