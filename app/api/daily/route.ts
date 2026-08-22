import { apiError, getAdminClient, malaysiaDate, requireUser } from "@/lib/supabase-server";

const allowed = new Set(["Bahasa Melayu", "Matematik", "Sejarah", "Biologi", "English"]);
const options = (q: Record<string, string>) => [q.option_a, q.option_b, q.option_c, q.option_d];

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const supabase = getAdminClient();
    const { data: quiz } = await supabase.from("daily_quizzes").select("id, subject, status, correct_count, completed_at, quiz_items(id, ordinal, selected_option, questions(id, subject, prompt, option_a, option_b, option_c, option_d, correct_option, explanation))").eq("user_id", user.id).eq("local_date", malaysiaDate()).maybeSingle();
    if (!quiz) return Response.json({ quiz: null });
    return Response.json({ quiz: { ...quiz, items: quiz.quiz_items.sort((a, b) => a.ordinal - b.ordinal).map((item) => ({ id: item.id, ordinal: item.ordinal, selectedOption: item.selected_option, question: item.questions && { id: item.questions.id, subject: item.questions.subject, prompt: item.questions.prompt, options: options(item.questions), correctOption: quiz.status === "submitted" ? item.questions.correct_option : undefined, explanation: quiz.status === "submitted" ? item.questions.explanation : undefined } })) } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { subject } = await request.json();
    if (!allowed.has(subject)) return Response.json({ error: "请选择有效科目。" }, { status: 400 });
    const supabase = getAdminClient();
    const date = malaysiaDate();
    const { data: existing } = await supabase.from("daily_quizzes").select("id").eq("user_id", user.id).eq("local_date", date).maybeSingle();
    if (existing) return Response.json({ id: existing.id, existing: true });
    const { data: bank, error } = await supabase.from("questions").select("id").eq("subject", subject).eq("status", "published").limit(200);
    if (error) throw error;
    if (!bank || bank.length < 20) return Response.json({ error: `「${subject}」目前只有 ${bank?.length ?? 0} 道已发布题目，至少需要 20 道。` }, { status: 422 });
    const questionIds = [...bank].sort(() => Math.random() - .5).slice(0, 20).map((q) => q.id);
    const { data: quiz, error: createError } = await supabase.from("daily_quizzes").insert({ user_id: user.id, local_date: date, subject }).select("id").single();
    if (createError) throw createError;
    const { error: itemError } = await supabase.from("quiz_items").insert(questionIds.map((question_id, index) => ({ quiz_id: quiz.id, question_id, ordinal: index + 1 })));
    if (itemError) throw itemError;
    return Response.json({ id: quiz.id, existing: false }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const { quizId, answers } = await request.json() as { quizId: string; answers: { itemId: string; option: "A" | "B" | "C" | "D" }[] };
    if (!quizId || !Array.isArray(answers) || answers.length !== 20 || answers.some((a) => !/^[ABCD]$/.test(a.option))) return Response.json({ error: "提交资料不完整。" }, { status: 400 });
    const supabase = getAdminClient();
    const { data: quiz } = await supabase.from("daily_quizzes").select("id, status").eq("id", quizId).eq("user_id", user.id).eq("local_date", malaysiaDate()).maybeSingle();
    if (!quiz) return Response.json({ error: "找不到今天的任务。" }, { status: 404 });
    if (quiz.status === "submitted") return Response.json({ error: "今天的正式任务已经提交。" }, { status: 409 });
    const { data: items, error } = await supabase.from("quiz_items").select("id, questions(correct_option)").eq("quiz_id", quizId);
    if (error || !items || items.length !== 20) throw error || new Error("Quiz items missing");
    const choice = new Map(answers.map((a) => [a.itemId, a.option]));
    if (choice.size !== 20 || items.some((item) => !choice.has(item.id))) return Response.json({ error: "答案与题目不一致。" }, { status: 400 });
    const correct = items.reduce((score, item) => score + (choice.get(item.id) === item.questions.correct_option ? 1 : 0), 0);
    await Promise.all(items.map((item) => supabase.from("quiz_items").update({ selected_option: choice.get(item.id) }).eq("id", item.id)));
    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from("daily_quizzes").update({ status: "submitted", correct_count: correct, completed_at: now }).eq("id", quizId).eq("status", "active");
    if (updateError) throw updateError;
    const today = malaysiaDate();
    const { data: profile } = await supabase.from("profiles").select("streak_days,last_checkin_date").eq("id", user.id).single();
    const yesterdayDate = malaysiaDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const streak = profile?.last_checkin_date === today ? profile.streak_days : profile?.last_checkin_date === yesterdayDate ? profile.streak_days + 1 : 1;
    await supabase.from("profiles").update({ streak_days: streak, last_checkin_date: today }).eq("id", user.id);
    return Response.json({ correct, streak });
  } catch (error) { return apiError(error); }
}
