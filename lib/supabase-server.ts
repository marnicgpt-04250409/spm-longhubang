import { createClient, type User } from "@supabase/supabase-js";

const url = process.env.SPM_SUPABASE_URL;
const serviceRole = process.env.SPM_SUPABASE_SERVICE_ROLE_KEY;

export function getAdminClient() {
  if (!url || !serviceRole) throw new Error("Supabase server configuration is missing.");
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

export function malaysiaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function effectiveStreakDays(
  streakDays: number | null | undefined,
  lastCheckinDate: string | null | undefined,
  now = new Date(),
) {
  const today = malaysiaDate(now);
  const yesterday = malaysiaDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  return lastCheckinDate === today || lastCheckinDate === yesterday
    ? Math.max(0, streakDays ?? 0)
    : 0;
}

export async function requireUser(request: Request): Promise<User> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Response("请先登录。", { status: 401 });
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Response("登录已过期，请重新登录。", { status: 401 });
  const displayName = String(data.user.user_metadata.full_name || data.user.user_metadata.name || data.user.email || "SPM 学生").slice(0, 80);
  await supabase.from("profiles").upsert({ id: data.user.id, display_name: displayName }, { onConflict: "id", ignoreDuplicates: true });
  return data.user;
}

export async function requireTeacher(request: Request) {
  const user = await requireUser(request);
  const supabase = getAdminClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (data?.role !== "teacher") throw new Response("仅教师可以使用此功能。", { status: 403 });
  return user;
}

export async function requireStudentNickname(request: Request) {
  const user = await requireUser(request);
  const { data, error } = await getAdminClient()
    .from("profiles")
    .select("role,nickname,school_name")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  if (data?.role === "student" && (!data.nickname || !data.school_name))
    throw new Response("请先填写真实姓名和学校后再开始答题。", { status: 409 });
  return user;
}

export async function requireBankManager(request: Request) {
  const user = await requireTeacher(request);
  const managerId = process.env.MYGURU_ADMIN_USER_ID;
  if (!managerId || user.id !== managerId)
    throw new Response("只有题库管理员可以导入、审核或发布题目。", { status: 403 });
  return user;
}

export function apiError(error: unknown) {
  if (error instanceof Response) return error;
  console.error(error);
  return Response.json({ error: "服务器暂时无法处理请求，请稍后再试。" }, { status: 500 });
}
