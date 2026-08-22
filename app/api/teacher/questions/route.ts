import { apiError, getAdminClient, requireTeacher } from "@/lib/supabase-server";

const validOption = (value: unknown): value is "A" | "B" | "C" | "D" => typeof value === "string" && /^[ABCD]$/.test(value);

export async function GET(request: Request) {
  try {
    const user = await requireTeacher(request);
    const { data, error } = await getAdminClient().from("questions").select("id,subject,prompt,status,answer_confirmed,created_at,uploads(filename)").eq("author_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return Response.json({ questions: data });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireTeacher(request);
    const body = await request.json();
    const values = [body.prompt, body.optionA, body.optionB, body.optionC, body.optionD, body.subject].map((value) => typeof value === "string" ? value.trim() : "");
    if (values.some((value) => !value) || !validOption(body.correctOption)) return Response.json({ error: "题干、四个选项、科目和唯一正确答案都必须填写。" }, { status: 400 });
    const { data, error } = await getAdminClient().from("questions").insert({ upload_id: body.uploadId || null, author_id: user.id, subject: values[5], prompt: values[0], option_a: values[1], option_b: values[2], option_c: values[3], option_d: values[4], correct_option: body.correctOption, answer_confirmed: true, explanation: typeof body.explanation === "string" ? body.explanation.trim() || null : null, status: "draft" }).select().single();
    if (error) throw error;
    return Response.json({ question: data }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireTeacher(request);
    const { id, publish } = await request.json();
    if (typeof id !== "string" || publish !== true) return Response.json({ error: "无效发布请求。" }, { status: 400 });
    const { data, error } = await getAdminClient().from("questions").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id).eq("author_id", user.id).eq("answer_confirmed", true).select("id,status").single();
    if (error) throw error;
    return Response.json({ question: data });
  } catch (error) { return apiError(error); }
}
