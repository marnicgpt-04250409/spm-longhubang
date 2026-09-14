import { apiError, effectiveStreakDays, getAdminClient, malaysiaDate, requireUser } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedKind = searchParams.get("kind");
    const kind = requestedKind === "streak" || requestedKind === "school" ? requestedKind : "daily";
    const supabase = getAdminClient();
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const viewer = token ? await requireUser(request) : null;
    const headers = token
      ? { "Cache-Control": "private, no-store" }
      : { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" };
    if (kind === "streak") {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nickname,streak_days,last_checkin_date")
        .eq("role", "student")
        .order("streak_days", { ascending: false })
        .order("last_checkin_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      const activeEntries = (data ?? [])
        .map((entry) => ({
          ...entry,
          streak_days: effectiveStreakDays(entry.streak_days, entry.last_checkin_date),
        }))
        .filter((entry) => entry.streak_days > 0)
        .sort((a, b) => b.streak_days - a.streak_days || String(b.last_checkin_date).localeCompare(String(a.last_checkin_date)));
      let previousScore: number | null = null;
      let rank = 0;
      const entries = activeEntries.map((entry, index) => {
        if (entry.streak_days !== previousScore) rank = index + 1;
        previousScore = entry.streak_days;
        return { ...entry, display_name: entry.nickname || "未填姓名", rank };
      });
      const mine = viewer
        ? entries.find((entry) => entry.id === viewer.id) ?? null
        : null;
      return Response.json({ date: malaysiaDate(), entries, mine }, { headers });
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
      ? await supabase.from("profiles").select("id,nickname,school_name,role").in("id", ids).eq("role", "student")
      : { data: [] };
    if (kind === "school") {
      const schoolScores = new Map<string, { school: string; total: number; participants: number }>();
      const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      for (const score of scores ?? []) {
        const school = profileById.get(score.user_id)?.school_name?.trim();
        if (!school) continue;
        const entry = schoolScores.get(school) ?? { school, total: 0, participants: 0 };
        entry.total += score.correct_count ?? 0;
        entry.participants += 1;
        schoolScores.set(school, entry);
      }
      let previousAverage: number | null = null;
      let rank = 0;
      const entries = [...schoolScores.values()]
        .map((entry) => ({ ...entry, averageScore: Number((entry.total / entry.participants).toFixed(2)) }))
        .sort((a, b) => b.averageScore - a.averageScore || b.participants - a.participants || a.school.localeCompare(b.school))
        .map((entry, index) => {
          if (entry.averageScore !== previousAverage) rank = index + 1;
          previousAverage = entry.averageScore;
          return { rank, name: entry.school, score: entry.averageScore, participants: entry.participants, totalCorrect: entry.total };
        });
      return Response.json({ date: malaysiaDate(), entries, mine: null }, { headers });
    }
    const names = new Map((profiles ?? []).map((p) => [p.id, p.nickname || "未填姓名"]));
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
    const mineIndex = viewer
      ? (scores ?? []).findIndex((score) => score.user_id === viewer.id)
      : -1;
    const mine = mineIndex >= 0 ? entries[mineIndex] : null;
    return Response.json({ date: malaysiaDate(), entries, mine }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
