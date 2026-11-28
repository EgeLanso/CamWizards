import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const admin = createAdminClient();
  let body: { uploadId?: string; action?: "save" | "unsave" };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { uploadId, action } = body;
  if (!uploadId) return NextResponse.json({ error: "Missing uploadId." }, { status: 400 });
  if (action === "save") {
    const { error } = await admin.from("post_saves").insert({ user_id: user.id, upload_id: uploadId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === "unsave") {
    const { error } = await admin.from("post_saves").delete().eq("user_id", user.id).eq("upload_id", uploadId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const admin = createAdminClient();
  const { data } = await admin.from("post_saves").select("upload_id").eq("user_id", user.id);
  return NextResponse.json({ savedIds: (data || []).map(r => r.upload_id) });
}
