import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { containsProfanity } from "@/lib/moderation/profanity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const admin = createAdminClient();
  let body: { reportedUserId?: string; reason?: string; language?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { reportedUserId, reason, language = "tr" } = body;
  if (!reportedUserId || reportedUserId === user.id) return NextResponse.json({ error: "Invalid target user." }, { status: 400 });
  if (!reason || reason.length > 1000) return NextResponse.json({ error: "Reason is required (max 1000 chars)." }, { status: 400 });
  const profanity = await containsProfanity(reason, supabase, language);
  if (profanity) return NextResponse.json({ error: "Şikayet metninde yasak kelime tespit edildi." }, { status: 400 });
  const { error } = await admin.from("profile_reports").insert({
    reporter_id: user.id,
    reported_user_id: reportedUserId,
    reason
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("notifications").insert({
    user_id: reportedUserId, type: "report", actor_id: user.id,
    target_type: "profile_report", target_id: crypto.randomUUID()
  });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const staff = await (await import("@/lib/community/access")).getStaffContext();
  if (!staff.user || !staff.admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const { data } = await staff.admin.from("profile_reports").select("id,reporter_id,reported_user_id,reason,status,created_at").eq("status", status).order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ reports: data || [] });
}
