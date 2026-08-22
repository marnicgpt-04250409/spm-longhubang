import { apiError, getAdminClient, requireUser } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { data, error } = await getAdminClient().from("profiles").select("display_name,role,streak_days,last_checkin_date").eq("id", user.id).single();
    if (error) throw error;
    return Response.json({ profile: data });
  } catch (error) { return apiError(error); }
}
