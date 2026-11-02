import { apiError, effectiveStreakDays, getAdminClient, malaysiaDate, requireUser } from "@/lib/supabase-server";
import { readAllPages } from "@/lib/pagination";

type Profile = { nickname: string | null; school_name: string | null };
type Score = { user_id: string; correct_count: number | null; completed_at: string | null; subject: string; profiles: Profile | Profile[] };
type Streak = { id: string; nickname: string | null; streak_days: number; last_checkin_date: string | null };
const firstProfile = (value: Score["profiles"]) => Array.isArray(value) ? value[0] : value;

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
      const yesterday = malaysiaDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const data = await readAllPages<Streak>((page, size) => supabase
        .from("profiles")
        .select("id,nickname,streak_days,last_checkin_date")
        .eq("role", "student")
        .gte("last_checkin_date", yesterday)
        .lte("last_checkin_date", malaysiaDate())
        .gt("streak_days", 0)
        .order("streak_days", { ascending: false })
        .order("last_checkin_date", { ascending: false })
        .order("id")
        .range(page * size, (page + 1) * size - 1));
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
      return Response.json({ date: malaysiaDate(), entries: entries.slice(0, 100), mine }, { headers });
    }
    const subject = searchParams.get("subject");
    const scores = await readAllPages<Score>((page, size) => {
      let query = supabase
      .from("daily_quizzes")
      .select("user_id,correct_count,completed_at,subject,profiles!inner(nickname,school_name,role)")
      .eq("local_date", malaysiaDate())
      .eq("status", "submitted")
      .eq("profiles.role", "student")
      .order("correct_count", { ascending: false })
      .order("completed_at", { ascending: true })
      .order("id");
      if (subject) query = query.eq("subject", subject);
      return query.range(page * size, (page + 1) * size - 1);
    });
    if (kind === "school") {
      const schoolScores = new Map<string, { school: string; total: number; participants: number }>();
      for (const score of scores ?? []) {
        const school = firstProfile(score.profiles)?.school_name?.trim();
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
    let previousScore: number | null = null;
    let rank = 0;
    const entries = (scores ?? []).map((score, index) => {
      if (score.correct_count !== previousScore) rank = index + 1;
      previousScore = score.correct_count;
      return {
        rank,
        name: firstProfile(score.profiles)?.nickname || "未填姓名",
        score: score.correct_count,
        completedAt: score.completed_at,
        subject: score.subject,
      };
    });
    const mineIndex = viewer
      ? (scores ?? []).findIndex((score) => score.user_id === viewer.id)
      : -1;
    const mine = mineIndex >= 0 ? entries[mineIndex] : null;
    return Response.json({ date: malaysiaDate(), entries: entries.slice(0, 100), mine }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
