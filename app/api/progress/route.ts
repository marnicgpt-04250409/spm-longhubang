import { apiError, getAdminClient, malaysiaDate, requireStudentNickname } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const user = await requireStudentNickname(request);
    const supabase = getAdminClient();
    const date = malaysiaDate();
    const [dailyResult, practiceResult] = await Promise.all([
      supabase
        .from("daily_quizzes")
        .select("subject,status,correct_count,completed_at,quiz_items(selected_option)")
        .eq("user_id", user.id)
        .eq("local_date", date),
      supabase
        .from("practice_quizzes")
        .select("subject,status,correct_count,completed_at")
        .eq("user_id", user.id)
        .eq("local_date", date)
        .eq("status", "submitted"),
    ]);
    if (dailyResult.error) throw dailyResult.error;
    if (practiceResult.error) throw practiceResult.error;
    const daily = (dailyResult.data ?? []).map((quiz: any) => ({
      subject: quiz.subject,
      status: quiz.status,
      correctCount: quiz.correct_count,
      completedAt: quiz.completed_at,
      selectedCount: (quiz.quiz_items ?? []).filter((item: any) => item.selected_option).length,
    }));
    const practice = practiceResult.data ?? [];
    return Response.json({
      date,
      daily,
      summary: {
        dailyCompleted: daily.filter((quiz) => quiz.status === "submitted").length,
        practiceCompleted: practice.length,
        practiceCorrect: practice.reduce((total, quiz) => total + (quiz.correct_count ?? 0), 0),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
