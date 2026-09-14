import { apiError, getAdminClient, requireBankManager } from "@/lib/supabase-server";

const first = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function GET(request: Request) {
  try {
    await requireBankManager(request);
    const supabase = getAdminClient();
    const [dailyResult, practiceResult] = await Promise.all([
      supabase.from("quiz_items").select("selected_option,questions(id,subject,topic,prompt,correct_option)").not("selected_option", "is", null).limit(5000),
      supabase.from("practice_items").select("selected_option,questions(id,subject,topic,prompt,correct_option)").not("selected_option", "is", null).limit(5000),
    ]);
    if (dailyResult.error) throw dailyResult.error;
    if (practiceResult.error) throw practiceResult.error;
    const questions = new Map<string, { id: string; subject: string; topic: string; prompt: string; attempts: number; correct: number }>();
    const add = (items: any[]) => {
      for (const item of items ?? []) {
        const question = first<any>(item.questions);
        if (!question || !item.selected_option) continue;
        const entry = questions.get(question.id) ?? { id: question.id, subject: question.subject, topic: question.topic?.trim() || "未标记章节", prompt: question.prompt, attempts: 0, correct: 0 };
        entry.attempts += 1;
        if (item.selected_option === question.correct_option) entry.correct += 1;
        questions.set(question.id, entry);
      }
    };
    add(dailyResult.data as any[]);
    add(practiceResult.data as any[]);
    const quality = [...questions.values()].map((entry) => ({ ...entry, accuracy: Math.round((entry.correct / entry.attempts) * 100) }));
    const topicMap = new Map<string, { topic: string; attempts: number; correct: number }>();
    for (const item of quality) {
      const entry = topicMap.get(item.topic) ?? { topic: item.topic, attempts: 0, correct: 0 };
      entry.attempts += item.attempts;
      entry.correct += item.correct;
      topicMap.set(item.topic, entry);
    }
    return Response.json({
      topics: [...topicMap.values()].map((entry) => ({ ...entry, accuracy: Math.round((entry.correct / entry.attempts) * 100) })).sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts).slice(0, 12),
      questions: quality.sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts).slice(0, 12),
    });
  } catch (error) {
    return apiError(error);
  }
}
