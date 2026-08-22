import { apiError, getAdminClient, requireUser } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const supabase = getAdminClient();
    const [daily, practice] = await Promise.all([
      supabase
        .from("daily_quizzes")
        .select("id,subject,correct_count,completed_at,local_date,status")
        .eq("user_id", user.id)
        .eq("status", "submitted")
        .order("completed_at", { ascending: false })
        .limit(50),
      supabase
        .from("practice_quizzes")
        .select("id,subject,correct_count,completed_at,local_date,status")
        .eq("user_id", user.id)
        .eq("status", "submitted")
        .order("completed_at", { ascending: false })
        .limit(50),
    ]);
    if (daily.error) throw daily.error;
    if (practice.error) throw practice.error;
    const entries = [
      ...(daily.data ?? []).map((item) => ({ ...item, kind: "daily" })),
      ...(practice.data ?? []).map((item) => ({ ...item, kind: "practice" })),
    ].sort((a, b) =>
      String(b.completed_at).localeCompare(String(a.completed_at)),
    );
    return Response.json({ entries });
  } catch (error) {
    return apiError(error);
  }
}
