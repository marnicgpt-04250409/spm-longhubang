import { apiError, getAdminClient, malaysiaDate } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind") === "streak" ? "streak" : "daily";
    const supabase = getAdminClient();
    if (kind === "streak") {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name,streak_days,last_checkin_date")
        .order("streak_days", { ascending: false })
        .order("last_checkin_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      let previousScore: number | null = null;
      let rank = 0;
      const entries = (data ?? []).map((entry, index) => {
        if (entry.streak_days !== previousScore) rank = index + 1;
        previousScore = entry.streak_days;
        return { ...entry, rank };
      });
      return Response.json({ date: malaysiaDate(), entries });
    }
    const subject = searchParams.get("subject");
    let query = supabase
      .from("daily_quizzes")
      .select("user_id,correct_count,completed_at,subject")
      .eq("local_date", malaysiaDate())
      .eq("status", "submitted")
      .order("correct_count", { ascending: false })
      .order("completed_at", { ascending: true })
      .limit(100);
    if (subject) query = query.eq("subject", subject);
    const { data: scores, error } = await query;
    if (error) throw error;
    const ids = [...new Set((scores ?? []).map((s) => s.user_id))];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id,display_name").in("id", ids)
      : { data: [] };
    const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    let previousScore: number | null = null;
    let rank = 0;
    const entries = (scores ?? []).map((score, index) => {
      if (score.correct_count !== previousScore) rank = index + 1;
      previousScore = score.correct_count;
      return {
        rank,
        name: names.get(score.user_id) ?? "SPM 学生",
        score: score.correct_count,
        completedAt: score.completed_at,
        subject: score.subject,
      };
    });
    return Response.json({ date: malaysiaDate(), entries });
  } catch (error) {
    return apiError(error);
  }
}
