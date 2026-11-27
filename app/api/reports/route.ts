import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBan } from "@/lib/community/access";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to report content." }, { status: 401 });
  if (await getActiveBan(user.id)) return NextResponse.json({ error: "Your account is suspended." }, { status: 403 });

  let body: { uploadId?: string; targetUserId?: string; reason?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const uploadId = String(body.uploadId || "").trim();
  const targetUserId = String(body.targetUserId || "").trim();
  const reason = String(body.reason || "").trim().slice(0, 300);
  if (!reason) return NextResponse.json({ error: "Choose a reason." }, { status: 400 });
  if (Boolean(uploadId) === Boolean(targetUserId)) {
    return NextResponse.json({ error: "Choose exactly one profile or post to report." }, { status: 400 });
  }

  const reportData: {
    reporter_id: string;
    upload_id?: string;
    target_user_id?: string;
    reason: string;
  } = { reporter_id: user.id, reason };

  if (uploadId) {
    const { data: upload } = await supabase.from("uploads")
      .select("id,user_id").eq("id", uploadId).maybeSingle();
    if (!upload) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    if (upload.user_id === user.id) return NextResponse.json({ error: "You cannot report your own post." }, { status: 400 });
    reportData.upload_id = uploadId;
  } else {
    const { data: profile } = await supabase.from("profiles")
      .select("id").eq("id", targetUserId).maybeSingle();
    if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (targetUserId === user.id) return NextResponse.json({ error: "You cannot report your own profile." }, { status: 400 });
    reportData.target_user_id = targetUserId;
  }

  const { error } = await supabase.from("user_reports").insert(reportData);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
