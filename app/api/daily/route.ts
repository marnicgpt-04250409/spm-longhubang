import {
  apiError,
  getAdminClient,
  malaysiaDate,
  requireStudentNickname,
} from "@/lib/supabase-server";
import { after } from "next/server";
import { syncGoogleSheetSnapshot } from "@/lib/google-sheets-sync";
import { signedQuestionImageUrls } from "@/lib/question-images";
import { listPublishedQuestionIds, sampleQuestionIds } from "@/lib/question-bank-query";
const options = (q: Record<string, string | null>) => [
  q.option_a,
  q.option_b,
  q.option_c,
  q.option_d,
];
const firstRelation = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export async function GET(request: Request) {
  try {
    const user = await requireStudentNickname(request);
    const subject = new URL(request.url).searchParams.get("subject")?.trim();
    if (!subject) return Response.json({ quiz: null });
    const supabase = getAdminClient();
    const { data: rawQuiz } = await supabase
      .from("daily_quizzes")
      .select(
        "id, subject, status, correct_count, completed_at, quiz_items(id, ordinal, selected_option, questions(id, subject, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, image_path, image_alt))",
      )
      .eq("user_id", user.id)
      .eq("local_date", malaysiaDate())
      .eq("subject", subject)
      .maybeSingle();
    const quiz = rawQuiz as any;
    if (!quiz) return Response.json({ quiz: null });
    const questionImageUrls = await signedQuestionImageUrls(
      quiz.quiz_items.map((item: any) => firstRelation<any>(item.questions)?.image_path),
    );
    return Response.json({
      quiz: {
        ...quiz,
        items: quiz.quiz_items
          .sort((a: any, b: any) => a.ordinal - b.ordinal)
          .map((item: any) => {
            const question = firstRelation<Record<string, string | null>>(
              item.questions,
            );
            return {
              id: item.id,
              ordinal: item.ordinal,
              selectedOption: item.selected_option,
              question: question && {
                id: question.id,
                subject: question.subject,
                prompt: question.prompt,
                options: options(question),
                imageUrl: question.image_path
                  ? questionImageUrls.get(question.image_path)
                  : undefined,
                imageAlt: question.image_alt || undefined,
                correctOption:
                  quiz.status === "submitted"
                    ? question.correct_option
                    : undefined,
                explanation:
                  quiz.status === "submitted"
                    ? question.explanation
                    : undefined,
              },
            };
          }),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireStudentNickname(request);
    const { subject: rawSubject } = await request.json();
    const subject = typeof rawSubject === "string" ? rawSubject.trim() : "";
    if (!subject)
      return Response.json({ error: "请选择有效科目。" }, { status: 400 });
    const supabase = getAdminClient();
    const date = malaysiaDate();
    const { data: existing } = await supabase
      .from("daily_quizzes")
      .select("id")
      .eq("user_id", user.id)
      .eq("local_date", date)
      .eq("subject", subject)
      .maybeSingle();
    if (existing) return Response.json({ id: existing.id, existing: true });
    const bank = await listPublishedQuestionIds(subject);
    if (bank.length < 20)
      return Response.json(
        {
          error: `「${subject}」目前只有 ${bank.length} 道已发布题目，至少需要 20 道。`,
        },
        { status: 422 },
      );
    const questionIds = sampleQuestionIds(bank, 20);
    const { data: quiz, error: createError } = await supabase
      .from("daily_quizzes")
      .insert({ user_id: user.id, local_date: date, subject })
      .select("id")
      .single();
    if (createError) throw createError;
    const { error: itemError } = await supabase
      .from("quiz_items")
      .insert(
        questionIds.map((question_id, index) => ({
          quiz_id: quiz.id,
          question_id,
          ordinal: index + 1,
        })),
      );
    if (itemError) throw itemError;
    return Response.json({ id: quiz.id, existing: false }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireStudentNickname(request);
    const { quizId, answers } = (await request.json()) as {
      quizId: string;
      answers: { itemId: string; option: "A" | "B" | "C" | "D" }[];
    };
    if (
      !quizId ||
      !Array.isArray(answers) ||
      answers.length !== 20 ||
      answers.some((a) => !/^[ABCD]$/.test(a.option))
    )
      return Response.json({ error: "提交资料不完整。" }, { status: 400 });
    const supabase = getAdminClient();
    const { data: quiz } = await supabase
      .from("daily_quizzes")
      .select("id, status")
      .eq("id", quizId)
      .eq("user_id", user.id)
      .eq("local_date", malaysiaDate())
      .maybeSingle();
    if (!quiz)
      return Response.json({ error: "找不到今天的任务。" }, { status: 404 });
    if (quiz.status === "submitted")
      return Response.json(
        { error: "今天的正式任务已经提交。" },
        { status: 409 },
      );
    const { data: rawItems, error } = await supabase
      .from("quiz_items")
      .select("id, questions(correct_option)")
      .eq("quiz_id", quizId);
    const items = rawItems as any[] | null;
    if (error || !items || items.length !== 20)
      throw error || new Error("Quiz items missing");
    const choice = new Map(answers.map((a) => [a.itemId, a.option]));
    if (choice.size !== 20 || items.some((item) => !choice.has(item.id)))
      return Response.json({ error: "答案与题目不一致。" }, { status: 400 });
    const correct = items.reduce(
      (score: number, item: any) =>
        score +
        (choice.get(item.id) ===
        firstRelation<any>(item.questions)?.correct_option
          ? 1
          : 0),
      0,
    );
    const { data: updatedItems, error: answerUpdateError } = await supabase.rpc(
      "set_daily_quiz_item_answers",
      {
        p_quiz_id: quizId,
        p_answers: answers.map(({ itemId, option }) => ({
          id: itemId,
          selected_option: option,
        })),
      },
    );
    if (answerUpdateError || updatedItems !== 20)
      throw answerUpdateError || new Error("Quiz answer update was incomplete");
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("daily_quizzes")
      .update({
        status: "submitted",
        correct_count: correct,
        completed_at: now,
      })
      .eq("id", quizId)
      .eq("status", "active");
    if (updateError) throw updateError;
    const today = malaysiaDate();
    const { data: profile } = await supabase
      .from("profiles")
      .select("streak_days,last_checkin_date")
      .eq("id", user.id)
      .single();
    const yesterdayDate = malaysiaDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );
    const streak =
      profile?.last_checkin_date === today
        ? profile.streak_days
        : profile?.last_checkin_date === yesterdayDate
          ? profile.streak_days + 1
          : 1;
    await supabase
      .from("profiles")
      .update({ streak_days: streak, last_checkin_date: today })
      .eq("id", user.id);
    after(() =>
      syncGoogleSheetSnapshot().catch((syncError) =>
        console.error("Google Sheet daily sync failed", syncError),
      ),
    );
    return Response.json({ correct, streak });
  } catch (error) {
    return apiError(error);
  }
}
