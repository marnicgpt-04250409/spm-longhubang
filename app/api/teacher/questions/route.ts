import {
  apiError,
  getAdminClient,
  requireTeacher,
} from "@/lib/supabase-server";

const validOption = (value: unknown): value is "A" | "B" | "C" | "D" =>
  typeof value === "string" && /^[ABCD]$/.test(value);

export async function GET(request: Request) {
  try {
    const user = await requireTeacher(request);
    const { data, error } = await getAdminClient()
      .from("questions")
      .select(
        "id,subject,prompt,option_a,option_b,option_c,option_d,explanation,status,answer_confirmed,created_at,uploads(filename)",
      )
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return Response.json({ questions: data });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireTeacher(request);
    const body = await request.json();
    const values = [
      body.prompt,
      body.optionA,
      body.optionB,
      body.optionC,
      body.optionD,
      body.subject,
    ].map((value) => (typeof value === "string" ? value.trim() : ""));
    if (values.some((value) => !value) || !validOption(body.correctOption))
      return Response.json(
        { error: "题干、四个选项、科目和唯一正确答案都必须填写。" },
        { status: 400 },
      );
    const { data, error } = await getAdminClient()
      .from("questions")
      .insert({
        upload_id: body.uploadId || null,
        author_id: user.id,
        subject: values[5],
        prompt: values[0],
        option_a: values[1],
        option_b: values[2],
        option_c: values[3],
        option_d: values[4],
        correct_option: body.correctOption,
        answer_confirmed: true,
        explanation:
          typeof body.explanation === "string"
            ? body.explanation.trim() || null
            : null,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw error;
    return Response.json({ question: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireTeacher(request);
    const {
      id,
      publish,
      correctOption,
      subject,
      prompt,
      optionA,
      optionB,
      optionC,
      optionD,
      explanation,
    } = await request.json();
    if (typeof id !== "string")
      return Response.json({ error: "无效题目请求。" }, { status: 400 });
    const supabase = getAdminClient();
    const editable = {
      subject,
      prompt,
      optionA,
      optionB,
      optionC,
      optionD,
      explanation,
    };
    if (Object.values(editable).some((value) => value !== undefined)) {
      const update: Record<string, string | null> = {};
      const pairs = [
        ["subject", subject],
        ["prompt", prompt],
        ["option_a", optionA],
        ["option_b", optionB],
        ["option_c", optionC],
        ["option_d", optionD],
      ] as const;
      for (const [column, value] of pairs) {
        if (value === undefined) continue;
        if (typeof value !== "string" || !value.trim())
          return Response.json(
            { error: "题干、科目和四个选项不能留空。" },
            { status: 400 },
          );
        update[column] = value.trim();
      }
      if (explanation !== undefined) {
        if (typeof explanation !== "string")
          return Response.json({ error: "解析格式不正确。" }, { status: 400 });
        update.explanation = explanation.trim() || null;
      }
      const { data, error } = await supabase
        .from("questions")
        .update(update)
        .eq("id", id)
        .eq("author_id", user.id)
        .select("id,status,answer_confirmed")
        .single();
      if (error) throw error;
      return Response.json({ question: data });
    }
    if (correctOption !== undefined) {
      if (!validOption(correctOption))
        return Response.json(
          { error: "正确答案必须是 A、B、C 或 D。" },
          { status: 400 },
        );
      const { data, error } = await supabase
        .from("questions")
        .update({ correct_option: correctOption, answer_confirmed: true })
        .eq("id", id)
        .eq("author_id", user.id)
        .select("id,status,answer_confirmed")
        .single();
      if (error) throw error;
      return Response.json({ question: data });
    }
    if (publish !== true)
      return Response.json({ error: "无效发布请求。" }, { status: 400 });
    const { data, error } = await supabase
      .from("questions")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("author_id", user.id)
      .eq("answer_confirmed", true)
      .select("id,status,upload_id")
      .single();
    if (error) throw error;
    if (data.upload_id) {
      const { data: remaining, error: remainingError } = await supabase
        .from("questions")
        .select("id")
        .eq("upload_id", data.upload_id)
        .neq("status", "published")
        .limit(1);
      if (remainingError) throw remainingError;
      if (!remaining?.length)
        await supabase
          .from("uploads")
          .update({ status: "published" })
          .eq("id", data.upload_id)
          .eq("user_id", user.id);
    }
    return Response.json({ question: data });
  } catch (error) {
    return apiError(error);
  }
}
