import { apiError, getAdminClient, requireTeacher } from "@/lib/supabase-server";

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
    const { error: storageError } = await supabase.storage.from("question-papers").upload(storagePath, await file.arrayBuffer(), { contentType: "application/pdf", upsert: false });
    if (storageError) throw storageError;
    const { data, error } = await supabase.from("uploads").insert({ user_id: user.id, filename: file.name, storage_path: storagePath, subject: subject || null, status: "review" }).select("id,filename,subject,status,created_at").single();
    if (error) throw error;
    return Response.json({ upload: data, message: "PDF 已安全保存。请在审核页面逐题建立、检查并发布题目。" }, { status: 201 });
  } catch (error) { return apiError(error); }
}
