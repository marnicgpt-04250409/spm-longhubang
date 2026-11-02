import { randomUUID } from "node:crypto";
import { getAdminClient } from "@/lib/supabase-server";
import { isGoogleSheetSyncConfigured, writeGoogleSheetSnapshot } from "@/lib/google-sheets-sync";

/** A durable version remains pending until the provider write succeeds. */
export async function drainGoogleSheetQueue() {
  if (!isGoogleSheetSyncConfigured()) return {configured: false as const};
  const supabase = getAdminClient();
  const token = randomUUID();
  const claim = await supabase.rpc("claim_sheet_sync", {p_token: token});
  if (claim.error) throw claim.error;
  if (!claim.data.claimed) return {configured: true as const, queued: true as const};
  try {
    const result = await writeGoogleSheetSnapshot();
    const complete = await supabase.rpc("finish_sheet_sync", {p_token: token, p_success: true, p_error: null});
    if (complete.error) throw complete.error;
    if (!complete.data) throw new Error("Sheet synchronization lease expired.");
    return {...result, queued: false as const};
  } catch (error) {
    // Never put a provider request, OAuth credentials or spreadsheet contents in logs.
    const status = (error as {response?: {status?: number}})?.response?.status;
    const category = status ? `Provider HTTP ${status}` : "Synchronization failed";
    const release = await supabase.rpc("finish_sheet_sync", {p_token: token, p_success: false, p_error: category});
    if (release.error) console.error("Sheet retry state could not be saved");
    throw new Error("Google Sheet 同步暂时失败，任务已保留并会自动重试。");
  }
}

export async function syncGoogleSheetSnapshot() {
  if (!isGoogleSheetSyncConfigured()) return {configured: false as const};
  const requested = await getAdminClient().rpc("request_sheet_sync");
  if (requested.error) throw requested.error;
  return drainGoogleSheetQueue();
}
