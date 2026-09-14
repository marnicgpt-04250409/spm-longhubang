import {
  apiError,
  getAdminClient,
  malaysiaDate,
  requireBankManager,
} from "@/lib/supabase-server";

type Profile = { id: string; nickname: string | null; school_name: string | null; role: string };
type Quiz = {
  user_id: string;
  subject: string;
  status: string;
  correct_count: number | null;
  completed_at: string | null;
  created_at: string;
};

const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export async function GET(request: Request) {
  try {
    await requireBankManager(request);
    const supabase = getAdminClient();
    const date = malaysiaDate();
    const [profilesResult, dailyResult, practiceResult, usersResult] =
      await Promise.all([
        supabase.from("profiles").select("id,nickname,school_name,role"),
        supabase
          .from("daily_quizzes")
          .select("user_id,subject,status,correct_count,completed_at,created_at")
          .eq("local_date", date),
        supabase
          .from("practice_quizzes")
          .select("user_id,subject,status,correct_count,completed_at,created_at")
          .eq("local_date", date),
        supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
    for (const result of [profilesResult, dailyResult, practiceResult]) {
      if (result.error) throw result.error;
    }
    if (usersResult.error) throw usersResult.error;

    const questions: { subject: string; status: string }[] = [];
    const questionPageSize = 1000;
    for (let from = 0; ; from += questionPageSize) {
      const { data, error } = await supabase
        .from("questions")
        .select("subject,status")
        .range(from, from + questionPageSize - 1);
      if (error) throw error;
      questions.push(...(data ?? []));
      if ((data?.length ?? 0) < questionPageSize) break;
    }

    const profiles = (profilesResult.data ?? []) as Profile[];
    const students = profiles.filter((profile) => profile.role === "student");
    const emailById = new Map(
      (usersResult.data.users ?? []).map((user) => [user.id, user.email ?? ""]),
    );
    const daily = (dailyResult.data ?? []) as Quiz[];
    const practice = (practiceResult.data ?? []) as Quiz[];
    const submittedDaily = daily.filter((quiz) => quiz.status === "submitted");
    const submittedPractice = practice.filter((quiz) => quiz.status === "submitted");
    const activeIds = new Set([...daily, ...practice].map((quiz) => quiz.user_id));

    const subjects = new Map<string, { subject: string; published: number; daily: number; practice: number; total: number; scoreSum: number }>();
    for (const question of questions) {
      const entry = subjects.get(question.subject) ?? { subject: question.subject, published: 0, daily: 0, practice: 0, total: 0, scoreSum: 0 };
      if (question.status === "published") entry.published += 1;
      subjects.set(question.subject, entry);
    }
    for (const quiz of submittedDaily) {
      const entry = subjects.get(quiz.subject) ?? { subject: quiz.subject, published: 0, daily: 0, practice: 0, total: 0, scoreSum: 0 };
      entry.daily += 1;
      entry.total += 1;
      entry.scoreSum += quiz.correct_count ?? 0;
      subjects.set(quiz.subject, entry);
    }
    for (const quiz of submittedPractice) {
      const entry = subjects.get(quiz.subject) ?? { subject: quiz.subject, published: 0, daily: 0, practice: 0, total: 0, scoreSum: 0 };
      entry.practice += 1;
      entry.total += 1;
      entry.scoreSum += quiz.correct_count ?? 0;
      subjects.set(quiz.subject, entry);
    }

    const studentsToday = students.map((profile) => {
      const ownDaily = submittedDaily.filter((quiz) => quiz.user_id === profile.id);
      const ownPractice = submittedPractice.filter((quiz) => quiz.user_id === profile.id);
      const scores = [...ownDaily, ...ownPractice]
        .map((quiz) => quiz.correct_count)
        .filter((score): score is number => typeof score === "number");
      return {
        name: profile.nickname || "未填姓名",
        school: profile.school_name || "未填写学校",
        email: emailById.get(profile.id) || "",
        active: activeIds.has(profile.id),
        dailyCompleted: ownDaily.length,
        practiceCompleted: ownPractice.length,
        attempts: ownDaily.length + ownPractice.length,
        bestScore: scores.length ? Math.max(...scores) : null,
        subjects: [...new Set([...ownDaily, ...ownPractice].map((quiz) => quiz.subject))].join("、") || "—",
      };
    }).sort((a, b) => Number(b.active) - Number(a.active) || b.attempts - a.attempts || a.name.localeCompare(b.name, "zh-Hans"));

    if (new URL(request.url).searchParams.get("format") === "csv") {
      const rows = [
        ["学生姓名", "学校", "登录 Gmail", "今日状态", "每日任务完成", "自由练习完成", "今日答题次数", "最高分", "科目"],
        ...studentsToday.map((student) => [
          student.name,
          student.school,
          student.email,
          student.active ? "已答题" : "尚未答题",
          student.dailyCompleted,
          student.practiceCompleted,
          student.attempts,
          student.bestScore ?? "—",
          student.subjects,
        ]),
      ];
      return new Response(`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="myguru-${date}-students.csv"`,
        },
      });
    }

    return Response.json({
      date,
      summary: {
        students: students.length,
        activeStudents: activeIds.size,
        dailyCompleted: submittedDaily.length,
        practiceCompleted: submittedPractice.length,
      },
      subjects: [...subjects.values()]
        .map((subject) => ({ ...subject, averageScore: subject.total ? Number((subject.scoreSum / subject.total).toFixed(1)) : null }))
        .sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject)),
      students: studentsToday,
    });
  } catch (error) {
    return apiError(error);
  }
}
