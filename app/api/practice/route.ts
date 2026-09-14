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
    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get("quizId");
    if (!quizId) return Response.json({ quiz: null });
    const supabase = getAdminClient();
    const { data: rawQuiz, error } = await supabase
      .from("practice_quizzes")
      .select(
        "id, subject, status, correct_count, completed_at, practice_items(id, ordinal, selected_option, questions(id, subject, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, image_path, image_alt))",
      )
      .eq("id", quizId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    const quiz = rawQuiz as any;
    if (!quiz) return Response.json({ quiz: null });
    const questionImageUrls = await signedQuestionImageUrls(
      quiz.practice_items.map((item: any) => firstRelation<any>(item.questions)?.image_path),
    );
    return Response.json({
      quiz: {
        ...quiz,
        items: quiz.practice_items
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
    const { subject } = await request.json();
    if (typeof subject !== "string" || !subject.trim())
      return Response.json({ error: "请选择科目。" }, { status: 400 });
    const supabase = getAdminClient();
    const bank = await listPublishedQuestionIds(subject.trim());
    if (bank.length < 20)
      return Response.json(
        {
          error: `「${subject.trim()}」目前只有 ${bank.length} 道已发布题目，至少需要 20 道。`,
        },
        { status: 422 },
      );
    const questionIds = sampleQuestionIds(bank, 20);
    const { data: quiz, error: createError } = await supabase
      .from("practice_quizzes")
      .insert({
        user_id: user.id,
        local_date: malaysiaDate(),
        subject: subject.trim(),
      })
      .select("id")
      .single();
    if (createError) throw createError;
    const { error: itemError } = await supabase
      .from("practice_items")
      .insert(
        questionIds.map((question_id, index) => ({
          quiz_id: quiz.id,
          question_id,
          ordinal: index + 1,
        })),
      );
    if (itemError) throw itemError;
    return Response.json({ id: quiz.id }, { status: 201 });
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
      answers.some((answer) => !/^[ABCD]$/.test(answer.option))
    )
      return Response.json({ error: "提交资料不完整。" }, { status: 400 });
    const supabase = getAdminClient();
    const { data: quiz } = await supabase
      .from("practice_quizzes")
      .select("id,status")
      .eq("id", quizId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!quiz)
      return Response.json({ error: "找不到这次练习。" }, { status: 404 });
    if (quiz.status === "submitted")
      return Response.json({ error: "这次练习已经提交。" }, { status: 409 });
    const { data: rawItems, error } = await supabase
      .from("practice_items")
      .select("id, questions(correct_option)")
      .eq("quiz_id", quizId);
    const items = rawItems as any[] | null;
    if (error || !items || items.length !== 20)
      throw error || new Error("Practice items missing");
    const choice = new Map(
      answers.map((answer) => [answer.itemId, answer.option]),
    );
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
      "set_practice_quiz_item_answers",
      {
        p_quiz_id: quizId,
        p_answers: answers.map(({ itemId, option }) => ({
          id: itemId,
          selected_option: option,
        })),
      },
    );
    if (answerUpdateError || updatedItems !== 20)
      throw answerUpdateError || new Error("Practice answer update was incomplete");
    const { error: updateError } = await supabase
      .from("practice_quizzes")
      .update({
        status: "submitted",
        correct_count: correct,
        completed_at: new Date().toISOString(),
      })
      .eq("id", quizId)
      .eq("status", "active");
    if (updateError) throw updateError;
    after(() =>
      syncGoogleSheetSnapshot().catch((syncError) =>
        console.error("Google Sheet practice sync failed", syncError),
      ),
    );
    return Response.json({ correct });
  } catch (error) {
    return apiError(error);
  }
}
