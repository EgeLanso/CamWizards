import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const admin = createAdminClient();
  let body: { targetId?: string; action?: "follow" | "unfollow" };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { targetId, action } = body;
  if (!targetId || targetId === user.id) return NextResponse.json({ error: "Invalid target." }, { status: 400 });
  if (action === "follow") {
    const { error } = await admin.from("follows").insert({ follower_id: user.id, following_id: targetId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert({
      user_id: targetId, type: "follow", actor_id: user.id,
      target_type: "user", target_id: user.id
    });
    return NextResponse.json({ ok: true });
  }
  if (action === "unfollow") {
    const { error } = await admin.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
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
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "following";
  const targetId = searchParams.get("targetId") || user.id;
  if (type === "following") {
    const { data } = await admin.from("follows").select("following_id").eq("follower_id", targetId);
    return NextResponse.json({ ids: (data || []).map(r => r.following_id) });
  }
  if (type === "followers") {
    const { data } = await admin.from("follows").select("follower_id").eq("following_id", targetId);
    return NextResponse.json({ ids: (data || []).map(r => r.follower_id) });
  }
  return NextResponse.json({ error: "Invalid type." }, { status: 400 });
}
