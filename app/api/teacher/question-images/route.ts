import { apiError, getAdminClient, requireBankManager } from "@/lib/supabase-server";
import {
  QUESTION_IMAGE_BUCKET,
  QUESTION_IMAGE_MAX_BYTES,
  QUESTION_IMAGE_TYPES,
  safeQuestionImageName,
} from "@/lib/question-images";

const MAX_IMAGES_PER_BATCH = 100;

export async function POST(request: Request) {
  try {
    const user = await requireBankManager(request);
    const body = await request.json();
    const files = Array.isArray(body?.files) ? body.files : [];
    if (!files.length || files.length > MAX_IMAGES_PER_BATCH)
      return Response.json({ error: "每次请选择 1 至 100 张题目图片。" }, { status: 400 });

    const seenNames = new Set<string>();
    const normalized = files.map((item: unknown) => {
      const file = item as Record<string, unknown>;
      const name = typeof file.name === "string" ? file.name.trim() : "";
      const type = typeof file.type === "string" ? file.type : "";
      const size = typeof file.size === "number" ? file.size : 0;
      const key = name.toLocaleLowerCase();
      if (!name || !QUESTION_IMAGE_TYPES.has(type) || size <= 0 || size > QUESTION_IMAGE_MAX_BYTES)
        throw new Response("图片只支持 JPG、PNG、WebP，且每张不能超过 5MB。", { status: 400 });
      if (seenNames.has(key))
        throw new Response(`图片文件名重复：${name}`, { status: 400 });
      seenNames.add(key);
      return { name, type, size };
    });

    const storage = getAdminClient().storage.from(QUESTION_IMAGE_BUCKET);
    const uploads = [];
    for (const file of normalized) {
      const storagePath = `${user.id}/${crypto.randomUUID()}-${safeQuestionImageName(file.name)}`;
      const { data, error } = await storage.createSignedUploadUrl(storagePath);
      if (error || !data) throw error || new Error("无法建立图片上传通道。");
      uploads.push({ ...file, storagePath, token: data.token });
    }
    return Response.json({ uploads });
  } catch (error) {
    return apiError(error);
  }
}
