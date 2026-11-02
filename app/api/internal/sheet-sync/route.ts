import { timingSafeEqual } from "node:crypto";
import { drainGoogleSheetQueue } from "@/lib/google-sheets-queue";

export const maxDuration = 120;

export async function POST(request: Request) {
  const expected = process.env.MYGURU_SHEET_SYNC_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided || Buffer.byteLength(expected) !== Buffer.byteLength(provided) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(provided)))
    return Response.json({error: "Unauthorized"}, {status: 401});
  try {
    const result = await drainGoogleSheetQueue();
    if (!result.configured) return Response.json({error: "Sync is not configured"}, {status: 503});
    return Response.json({ok: true, queued: result.queued});
  } catch {
    return Response.json({error: "Sync failed; retry remains pending"}, {status: 503});
  }
}
