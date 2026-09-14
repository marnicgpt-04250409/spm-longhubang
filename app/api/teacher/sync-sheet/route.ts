import { apiError, requireBankManager } from "@/lib/supabase-server";
import { syncGoogleSheetSnapshot } from "@/lib/google-sheets-sync";

export async function POST(request: Request) {
  try {
    await requireBankManager(request);
    const result = await syncGoogleSheetSnapshot();
    if (!result.configured)
      return Response.json({ error: "Google Sheet 自动同步尚未完成安全配置。" }, { status: 409 });
    return Response.json({ message: `已同步 ${result.students} 位学生与 ${result.attempts} 条作答明细。` });
  } catch (error) {
    return apiError(error);
  }
}
