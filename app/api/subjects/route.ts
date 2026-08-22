import { apiError, getAdminClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const { data, error } = await getAdminClient()
      .from("questions")
      .select("subject")
      .eq("status", "published")
      .limit(1000);
    if (error) throw error;
    return Response.json({
      subjects: [
        ...new Set((data ?? []).map((item) => item.subject).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b)),
    });
  } catch (error) {
    return apiError(error);
  }
}
