import { getAdminClient } from "@/lib/supabase-server";

export const QUESTION_IMAGE_BUCKET = "question-images";
export const QUESTION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const QUESTION_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function safeQuestionImageName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "question-image";
}

export function validQuestionImagePath(path: unknown, userId: string): path is string {
  if (typeof path !== "string") return false;
  const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapedUserId}/[0-9a-f-]{36}-[A-Za-z0-9._-]+$`, "i").test(path);
}

export async function signedQuestionImageUrls(paths: Array<string | null | undefined>) {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  if (!uniquePaths.length) return urls;

  const { data, error } = await getAdminClient()
    .storage.from(QUESTION_IMAGE_BUCKET)
    .createSignedUrls(uniquePaths, 60 * 60);
  if (error) throw error;
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
