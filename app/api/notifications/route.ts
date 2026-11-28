import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";
  let query = admin.from("notifications").select("id,type,actor_id,target_type,target_id,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (unreadOnly) query = query.is("read_at", null);
  const { data } = await query;
  const actorIds = [...new Set((data || []).map(n => n.actor_id).filter(Boolean))];
  const { data: profiles } = actorIds.length ? await admin.from("profiles").select("id,username,avatar_url").in("id", actorIds) : { data: [] };
  const actorMap = new Map((profiles || []).map(p => [p.id, p]));
  return NextResponse.json({ notifications: (data || []).map(n => ({
    ...n,
    actor: actorMap.get(n.actor_id) || null,
    isUnread: !n.read_at
  })) });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const admin = createAdminClient();
  let body: { notificationId?: string; action?: "read" | "read-all" };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (body.action === "read-all") {
    const { error } = await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (body.notificationId) {
    const { error } = await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", body.notificationId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid request." }, { status: 400 });
}
