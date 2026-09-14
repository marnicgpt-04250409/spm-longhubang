import { getAdminClient } from "@/lib/supabase-server";

const PAGE_SIZE = 1000;

export async function listPublishedQuestionIds(subject: string) {
  const supabase = getAdminClient();
  const ids: string[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("questions")
      .select("id")
      .eq("subject", subject)
      .eq("status", "published")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    ids.push(...(data ?? []).map((question) => question.id));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  return ids;
}

export function sampleQuestionIds(ids: string[], count: number) {
  const shuffled = [...ids];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapWith]] = [shuffled[swapWith], shuffled[index]];
  }
  return shuffled.slice(0, count);
}
