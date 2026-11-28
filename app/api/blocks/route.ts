import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const admin = createAdminClient();
  let body: { targetId?: string; action?: "block" | "unblock" };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { targetId, action } = body;
  if (!targetId || targetId === user.id) return NextResponse.json({ error: "Invalid target." }, { status: 400 });
  if (action === "block") {
    const { error } = await admin.from("user_blocks").insert({ blocker_id: user.id, blocked_id: targetId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === "unblock") {
    const { error } = await admin.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", targetId);
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
  const { data } = await admin.from("user_blocks").select("blocked_id").eq("blocker_id", user.id);
  return NextResponse.json({ blockedIds: (data || []).map(r => r.blocked_id) });
}
