import {
  apiError,
  getAdminClient,
  requireBankManager,
} from "@/lib/supabase-server";
import { signedQuestionImageUrls } from "@/lib/question-images";

const validOption = (value: unknown): value is "A" | "B" | "C" | "D" =>
  typeof value === "string" && /^[ABCD]$/.test(value);

export async function GET(request: Request) {
  try {
    const user = await requireBankManager(request);
    const searchParams = new URL(request.url).searchParams;
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(20, Number.parseInt(searchParams.get("pageSize") || "50", 10) || 50));
    const status = searchParams.get("status") || "all";
    const subject = searchParams.get("subject")?.trim() || "all";
    const supabase = getAdminClient();
    let query = supabase
      .from("questions")
      .select(
        "id,subject,topic,prompt,option_a,option_b,option_c,option_d,explanation,status,answer_confirmed,source_type,source_label,difficulty,image_path,image_alt,created_at,uploads(filename)",
        { count: "exact" },
      )
      .eq("author_id", user.id)
      .order("created_at", { ascending: false });
    if (subject !== "all") query = query.eq("subject", subject);
    if (status === "published") query = query.eq("status", "published");
    if (status === "draft") query = query.neq("status", "published");
    if (status === "unconfirmed")
      query = query.neq("status", "published").eq("answer_confirmed", false);
    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    const subjects = new Set<string>();
    const subjectPageSize = 1000;
    for (let subjectFrom = 0; ; subjectFrom += subjectPageSize) {
      const { data: subjectRows, error: subjectError } = await supabase
        .from("questions")
        .select("subject")
        .eq("author_id", user.id)
        .range(subjectFrom, subjectFrom + subjectPageSize - 1);
      if (subjectError) throw subjectError;
      for (const row of subjectRows ?? []) if (row.subject) subjects.add(row.subject);
      if ((subjectRows?.length ?? 0) < subjectPageSize) break;
    }
    const imageUrls = await signedQuestionImageUrls((data ?? []).map((item) => item.image_path));
    return Response.json({
      questions: (data ?? []).map((item) => ({
        ...item,
        image_url: item.image_path ? imageUrls.get(item.image_path) : undefined,
      })),
      total: count ?? 0,
      page,
      pageSize,
      subjects: [...subjects].sort((a, b) => a.localeCompare(b)),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireBankManager(request);
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
    if (typeof body.topic === "string" && body.topic.trim().length > 120)
      return Response.json({ error: "章节／主题不能超过 120 个字符。" }, { status: 400 });
    const { data, error } = await getAdminClient()
      .from("questions")
      .insert({
        upload_id: body.uploadId || null,
        author_id: user.id,
        subject: values[5],
        topic: typeof body.topic === "string" ? body.topic.trim() || null : null,
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
        source_type: "manual",
        source_label: "手动建立",
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
    const user = await requireBankManager(request);
    const body = await request.json();
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
      topic,
      action,
      ids,
    } = body;
    const supabase = getAdminClient();
    if (action === "batch-publish" || action === "batch-delete") {
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > 100 ||
        ids.some((value) => typeof value !== "string")
      )
        return Response.json({ error: "请选择 1 至 100 道题目。" }, { status: 400 });
      const uniqueIds = [...new Set(ids)];
      if (action === "batch-delete") {
        const { data, error } = await supabase
          .from("questions")
          .delete()
          .eq("author_id", user.id)
          .eq("status", "draft")
          .in("id", uniqueIds)
          .select("id");
        if (error) throw error;
        return Response.json({ deleted: data?.length || 0 });
      }
      const { data: selected, error: selectedError } = await supabase
        .from("questions")
        .select("id,upload_id,answer_confirmed,status")
        .eq("author_id", user.id)
        .eq("status", "draft")
        .in("id", uniqueIds);
      if (selectedError) throw selectedError;
      if (selected?.length !== uniqueIds.length)
        return Response.json({ error: "部分题目已变更，请刷新后重试。" }, { status: 409 });
      const unconfirmed = selected.filter((item) => !item.answer_confirmed);
      if (unconfirmed.length)
        return Response.json(
          { error: `有 ${unconfirmed.length} 道题目尚未确认正确答案，不能批量发布。` },
          { status: 400 },
        );
      const { data, error } = await supabase
        .from("questions")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("author_id", user.id)
        .in("id", uniqueIds)
        .select("id,upload_id");
      if (error) throw error;
      const uploadIds = [...new Set(data.map((item) => item.upload_id).filter(Boolean))];
      for (const uploadId of uploadIds) {
        const { data: remaining, error: remainingError } = await supabase
          .from("questions")
          .select("id")
          .eq("upload_id", uploadId)
          .neq("status", "published")
          .limit(1);
        if (remainingError) throw remainingError;
        if (!remaining?.length)
          await supabase
            .from("uploads")
            .update({ status: "published" })
            .eq("id", uploadId)
            .eq("user_id", user.id);
      }
      return Response.json({ published: data.length });
    }
    if (typeof id !== "string")
      return Response.json({ error: "无效题目请求。" }, { status: 400 });
    const editable = {
      subject,
      prompt,
      optionA,
      optionB,
      optionC,
      optionD,
      explanation,
      topic,
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
      if (topic !== undefined) {
        if (typeof topic !== "string" || topic.trim().length > 120)
          return Response.json({ error: "章节／主题不能超过 120 个字符。" }, { status: 400 });
        update.topic = topic.trim() || null;
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
