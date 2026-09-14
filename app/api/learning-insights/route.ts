import { apiError, getAdminClient, requireStudentNickname } from "@/lib/supabase-server";

const first = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function GET(request: Request) {
  try {
    const user = await requireStudentNickname(request);
    const supabase = getAdminClient();
    const [dailyResult, practiceResult] = await Promise.all([
      supabase.from("daily_quizzes").select("quiz_items(selected_option,questions(topic,correct_option))").eq("user_id", user.id).eq("status", "submitted").limit(100),
      supabase.from("practice_quizzes").select("practice_items(selected_option,questions(topic,correct_option))").eq("user_id", user.id).eq("status", "submitted").limit(100),
    ]);
    if (dailyResult.error) throw dailyResult.error;
    if (practiceResult.error) throw practiceResult.error;
    const topics = new Map<string, { topic: string; attempts: number; correct: number }>();
    const add = (items: any[]) => {
      for (const item of items ?? []) {
        const question = first<any>(item.questions);
        if (!question || !item.selected_option) continue;
        const topic = question.topic?.trim() || "未标记章节";
        const entry = topics.get(topic) ?? { topic, attempts: 0, correct: 0 };
        entry.attempts += 1;
        if (item.selected_option === question.correct_option) entry.correct += 1;
        topics.set(topic, entry);
      }
    };
    for (const quiz of dailyResult.data ?? []) add((quiz as any).quiz_items);
    for (const quiz of practiceResult.data ?? []) add((quiz as any).practice_items);
    const entries = [...topics.values()]
      .map((entry) => ({ ...entry, accuracy: Math.round((entry.correct / entry.attempts) * 100) }))
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
    return Response.json({ topics: entries });
  } catch (error) {
    return apiError(error);
  }
}
