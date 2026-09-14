import { apiError, getAdminClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = getAdminClient();
    const subjects = new Set<string>();
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("questions")
        .select("subject")
        .eq("status", "published")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      for (const item of data ?? []) if (item.subject) subjects.add(item.subject);
      if ((data?.length ?? 0) < pageSize) break;
    }
    return Response.json(
      {
        subjects: [...subjects].sort((a, b) => a.localeCompare(b)),
      },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
