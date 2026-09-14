import { starterQuestionBank } from "@/lib/question-bank";
import { apiError, getAdminClient, requireBankManager } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const user = await requireBankManager(request);
    const supabase = getAdminClient();
    const keys = starterQuestionBank.map((item) => item.sourceKey);
    const { data: existing, error: existingError } = await supabase.from("questions").select("source_key").in("source_key", keys);
    if (existingError) throw existingError;
    const existingKeys = new Set((existing ?? []).map((item) => item.source_key));
    const rows = starterQuestionBank.filter((item) => !existingKeys.has(item.sourceKey));
    if (rows.length) {
      const { error } = await supabase.from("questions").insert(rows.map((item) => ({ author_id: user.id, subject: item.subject, prompt: item.prompt, option_a: item.optionA, option_b: item.optionB, option_c: item.optionC, option_d: item.optionD, correct_option: item.correctOption, answer_confirmed: true, explanation: item.explanation, difficulty: item.difficulty, source_type: "myguru_original", source_label: "MyGuru 原创模拟练习题", source_key: item.sourceKey, status: "published", published_at: new Date().toISOString() })));
      if (error) throw error;
    }
    return Response.json({ added: rows.length, total: starterQuestionBank.length, message: rows.length ? `已发布 ${rows.length} 道 MyGuru 原创模拟题。` : "首批题库已经发布，无需重复导入。" });
  } catch (error) { return apiError(error); }
}
