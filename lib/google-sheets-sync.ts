import { google } from "googleapis";
import { getAdminClient, malaysiaDate } from "@/lib/supabase-server";

const spreadsheetId = process.env.MYGURU_GOOGLE_SHEET_ID;
const serviceAccountJson = process.env.MYGURU_GOOGLE_SERVICE_ACCOUNT_JSON;

type QuizItem = {
  ordinal: number;
  selected_option: string | null;
  questions: { prompt: string; correct_option: string } | { prompt: string; correct_option: string }[] | null;
};
type Quiz = {
  id: string;
  user_id: string;
  subject: string;
  correct_count: number | null;
  completed_at: string | null;
  quiz_items?: QuizItem[];
  practice_items?: QuizItem[];
};

const first = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

function malaysiaDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function configuredCredentials() {
  if (!spreadsheetId || !serviceAccountJson) return null;
  try {
    const credentials = JSON.parse(serviceAccountJson);
    if (!credentials.client_email || !credentials.private_key)
      throw new Error("service account fields missing");
    return credentials;
  } catch {
    throw new Error("MYGURU_GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
}

export function isGoogleSheetSyncConfigured() {
  return Boolean(spreadsheetId && serviceAccountJson);
}

/**
 * Rebuilds today's private administrator workbook from the authoritative
 * Supabase records.  This makes retries safe and avoids duplicate rows.
 */
export async function syncGoogleSheetSnapshot() {
  const credentials = configuredCredentials();
  if (!credentials || !spreadsheetId) return { configured: false as const };
  const supabase = getAdminClient();
  const today = malaysiaDate();
  const syncedAt = `${malaysiaDateTime(new Date().toISOString())}（马来西亚时间）`;
  const [profilesResult, usersResult, dailyResult, practiceResult] = await Promise.all([
    supabase.from("profiles").select("id,nickname,school_name,role,streak_days"),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase
      .from("daily_quizzes")
      .select("id,user_id,subject,correct_count,completed_at,quiz_items(ordinal,selected_option,questions(prompt,correct_option))")
      .eq("local_date", today)
      .eq("status", "submitted"),
    supabase
      .from("practice_quizzes")
      .select("id,user_id,subject,correct_count,completed_at,practice_items(ordinal,selected_option,questions(prompt,correct_option))")
      .eq("local_date", today)
      .eq("status", "submitted"),
  ]);
  for (const result of [profilesResult, dailyResult, practiceResult]) {
    if (result.error) throw result.error;
  }
  if (usersResult.error) throw usersResult.error;
  const profiles = (profilesResult.data ?? []).filter((profile) => profile.role === "student");
  const emailById = new Map(
    (usersResult.data.users ?? []).map((user) => [user.id, user.email || ""]),
  );
  const daily = (dailyResult.data ?? []) as Quiz[];
  const practice = (practiceResult.data ?? []) as Quiz[];
  const studentRows = profiles.map((profile) => {
    const ownDaily = daily.filter((quiz) => quiz.user_id === profile.id);
    const ownPractice = practice.filter((quiz) => quiz.user_id === profile.id);
    const latestDaily = [...ownDaily].sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))[0];
    const latestPractice = [...ownPractice].sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))[0];
    return [
      syncedAt,
      profile.nickname || "未填姓名",
      profile.school_name || "未填写学校",
      emailById.get(profile.id) || "",
      profile.streak_days,
      ownDaily.length ? "已完成" : "未开始",
      ownDaily.reduce((total, quiz) => total + (quiz.correct_count ?? 0), 0) || "—",
      malaysiaDateTime(latestDaily?.completed_at ?? null),
      ownPractice.length,
      ownPractice.reduce((total, quiz) => total + (quiz.correct_count ?? 0), 0),
      malaysiaDateTime(latestPractice?.completed_at ?? null),
    ];
  });
  const detailRows = [...daily.map((quiz) => ({ quiz, kind: "每日打卡", items: quiz.quiz_items ?? [] })), ...practice.map((quiz) => ({ quiz, kind: "自由练习", items: quiz.practice_items ?? [] }))]
    .flatMap(({ quiz, kind, items }) => items.map((item) => {
      const question = first(item.questions);
      const profile = profiles.find((entry) => entry.id === quiz.user_id);
      const correct = item.selected_option === question?.correct_option;
      return [
        profile?.nickname || "未填姓名",
        kind,
        quiz.subject,
        item.ordinal,
        question?.prompt || "",
        item.selected_option || "",
        question?.correct_option || "",
        correct ? "正确" : "错误",
        quiz.correct_count ?? "",
        malaysiaDateTime(quiz.completed_at),
      ];
    }));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const workbook = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  if (!(workbook.data.sheets ?? []).some((sheet) => sheet.properties?.title === "每日历史")) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: "每日历史" } } }] },
    });
  }
  const historyDates = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "每日历史!A2:A1000",
  });
  const existingHistoryRow = (historyDates.data.values ?? []).findIndex((row) => row[0] === today);
  const historyRow = existingHistoryRow >= 0 ? existingHistoryRow + 2 : (historyDates.data.values?.length ?? 0) + 2;
  const dailyCorrect = daily.reduce((total, quiz) => total + (quiz.correct_count ?? 0), 0);
  const practiceCorrect = practice.reduce((total, quiz) => total + (quiz.correct_count ?? 0), 0);
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges: ["学生记录!A2:K1000", "作答明细!A2:J10000"] },
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: "今日总览!B2", values: [[`${today}（马来西亚时间）`]] },
        {
          range: "今日总览!A3:B9",
          values: [
            ["统计日期", `${today}（马来西亚时间）`],
            ["", ""],
            ["今日每日题正确总数", dailyCorrect],
            ["今日完成每日打卡", daily.length],
            ["今日自由练习完成", practice.length],
            ["今日自由练习正确总数", practiceCorrect],
            ["最后同步时间", `${malaysiaDateTime(new Date().toISOString())}（自动同步）`],
          ],
        },
        {
          range: "学生记录!A1:K1",
          values: [["同步时间（马来西亚时间）", "学生真实姓名", "学校", "登录 Gmail", "连续打卡天数", "今日每日题", "每日题正确总数", "每日题完成时间", "今日自由练习次数", "自由练习正确总数", "最后练习时间"]],
        },
        {
          range: "每日历史!A1:H1",
          values: [["统计日期", "同步时间（马来西亚时间）", "已登录学生", "今日有答题学生", "每日任务完成", "自由练习完成", "每日题正确总数", "自由练习正确总数"]],
        },
        {
          range: `每日历史!A${historyRow}:H${historyRow}`,
          values: [[
            today,
            syncedAt,
            profiles.length,
            new Set([...daily, ...practice].map((quiz) => quiz.user_id)).size,
            daily.length,
            practice.length,
            dailyCorrect,
            practiceCorrect,
          ]],
        },
        { range: "学生记录!A2", values: studentRows },
        { range: "作答明细!A2", values: detailRows },
      ],
    },
  });
  return { configured: true as const, students: studentRows.length, attempts: detailRows.length };
}
