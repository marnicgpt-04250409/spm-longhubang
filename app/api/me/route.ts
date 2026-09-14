import { apiError, effectiveStreakDays, getAdminClient, requireUser } from "@/lib/supabase-server";
import { isSchoolOption } from "@/lib/schools";

const normalizedProfile = <T extends { streak_days?: number | null; last_checkin_date?: string | null }>(profile: T) => ({
  ...profile,
  streak_days: effectiveStreakDays(profile.streak_days, profile.last_checkin_date),
});

const hasControlCharacter = (value: string) =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { data, error } = await getAdminClient().from("profiles").select("display_name,nickname,school_name,role,streak_days,last_checkin_date").eq("id", user.id).single();
    if (error) throw error;
    return Response.json({ profile: normalizedProfile(data) });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const { nickname: rawNickname, schoolName: rawSchoolName } = await request.json();
    const nickname = typeof rawNickname === "string" ? rawNickname.trim().replace(/\s+/g, " ") : "";
    if (nickname.length < 2 || nickname.length > 20)
      return Response.json({ error: "真实姓名需要 2 至 20 个字符。" }, { status: 400 });
    if (hasControlCharacter(nickname))
      return Response.json({ error: "姓名不能包含控制字符。" }, { status: 400 });
    const schoolName = typeof rawSchoolName === "string" ? rawSchoolName.trim().replace(/\s+/g, " ") : "";
    const admin = getAdminClient();
    const { data: currentProfile, error: profileError } = await admin
      .from("profiles")
      .select("role,school_name")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (currentProfile.role === "student" && !isSchoolOption(schoolName))
      return Response.json({ error: "请从学校名单中选择一项。" }, { status: 400 });
    const savedSchoolName = currentProfile.role === "student" ? schoolName : currentProfile.school_name;
    const { data, error } = await admin
      .from("profiles")
      .update({ nickname, display_name: nickname, school_name: savedSchoolName || null, nickname_set_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("display_name,nickname,school_name,role,streak_days,last_checkin_date")
      .single();
    if (error?.code === "23505")
      return Response.json({ error: "这个姓名已经有人使用，请确认后再填写。" }, { status: 409 });
    if (error) throw error;
    return Response.json({ profile: normalizedProfile(data) });
  } catch (error) { return apiError(error); }
}
