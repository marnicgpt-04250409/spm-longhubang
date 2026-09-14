import { apiError, getAdminClient, requireStudentNickname } from "@/lib/supabase-server";

const relation = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function GET(request: Request) {
  try {
    const user = await requireStudentNickname(request);
    const supabase = getAdminClient();
    const [dailyResult, practiceResult] = await Promise.all([
      supabase
        .from("daily_quizzes")
        .select("subject,completed_at,quiz_items(selected_option,questions(id,prompt,option_a,option_b,option_c,option_d,correct_option,explanation))")
        .eq("user_id", user.id)
        .eq("status", "submitted")
        .order("completed_at", { ascending: false })
        .limit(50),
      supabase
        .from("practice_quizzes")
        .select("subject,completed_at,practice_items(selected_option,questions(id,prompt,option_a,option_b,option_c,option_d,correct_option,explanation))")
        .eq("user_id", user.id)
        .eq("status", "submitted")
        .order("completed_at", { ascending: false })
        .limit(50),
    ]);
    if (dailyResult.error) throw dailyResult.error;
    if (practiceResult.error) throw practiceResult.error;
    const seen = new Set<string>();
    const mistakes: any[] = [];
    const add = (quiz: any, items: any[]) => {
      for (const item of items ?? []) {
        const question = relation<any>(item.questions);
        if (!question || item.selected_option === question.correct_option || seen.has(question.id)) continue;
        seen.add(question.id);
        mistakes.push({
          id: question.id,
          subject: quiz.subject,
          prompt: question.prompt,
          selectedOption: item.selected_option,
          correctOption: question.correct_option,
          explanation: question.explanation,
          completedAt: quiz.completed_at,
        });
      }
    };
    for (const quiz of dailyResult.data ?? []) add(quiz, quiz.quiz_items);
    for (const quiz of practiceResult.data ?? []) add(quiz, quiz.practice_items);
    return Response.json({ mistakes: mistakes.slice(0, 50) });
  } catch (error) {
    return apiError(error);
  }
}
