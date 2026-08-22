import { apiError, getAdminClient, requireUser } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { inviteCode } = await request.json();
    const expected = process.env.TEACHER_INVITE_CODE;
    if (!expected || typeof inviteCode !== "string" || inviteCode !== expected) return Response.json({ error: "邀请码不正确。" }, { status: 403 });
    const { error } = await getAdminClient().from("profiles").update({ role: "teacher" }).eq("id", user.id);
    if (error) throw error;
    return Response.json({ role: "teacher" });
  } catch (error) { return apiError(error); }
}
