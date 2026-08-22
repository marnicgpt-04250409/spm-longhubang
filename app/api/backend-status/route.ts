import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  // Keep this app isolated from the legacy marketplace integration variables.
  // These values are server-only Vercel environment variables.
  const url = process.env.SPM_SUPABASE_URL;
  const key = process.env.SPM_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return Response.json({ connected: false }, { status: 503 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("profiles").select("id").limit(1);
  if (error) return Response.json({ connected: false }, { status: 503 });
  return Response.json({ connected: true });
}
