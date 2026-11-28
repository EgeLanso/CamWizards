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
  let body: { uploadId?: string; body?: string; parentId?: string; language?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { uploadId, body: commentBody, parentId, language = "tr" } = body;
  if (!uploadId || !commentBody || commentBody.length > 1000) return NextResponse.json({ error: "Invalid comment." }, { status: 400 });
  const profanity = await containsProfanity(commentBody, supabase, language);
  if (profanity) return NextResponse.json({ error: "Yorumunuzda yasak kelime tespit edildi." }, { status: 400 });
  const { data: row, error } = await admin.from("comments").insert({
    upload_id: uploadId, user_id: user.id, parent_id: parentId || null, body: commentBody
  }).select().single();
  if (error || !row) return NextResponse.json({ error: error?.message || "Could not create comment." }, { status: 500 });
  await admin.from("notifications").insert({
    user_id: (await admin.from("uploads").select("user_id").eq("id", uploadId).maybeSingle()).data?.user_id || "",
    type: "comment", actor_id: user.id, target_type: "comment", target_id: row.id
  });
  return NextResponse.json({ ok: true, comment: row });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get("uploadId");
  if (!uploadId) return NextResponse.json({ error: "uploadId required." }, { status: 400 });
  const admin = createAdminClient();
  const { data } = await admin.from("comments").select("id,user_id,body,parent_id,created_at").eq("upload_id", uploadId).order("created_at", { ascending: true });
  return NextResponse.json({ comments: data || [] });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  const admin = createAdminClient();
  let body: { commentId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { commentId } = body;
  if (!commentId) return NextResponse.json({ error: "Missing commentId." }, { status: 400 });
  const { data: comment } = await admin.from("comments").select("user_id").eq("id", commentId).maybeSingle();
  if (!comment) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  if (comment.user_id !== user.id) return NextResponse.json({ error: "Not your comment." }, { status: 403 });
  const { error } = await admin.from("comments").delete().eq("id", commentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
