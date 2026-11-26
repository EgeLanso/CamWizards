import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateUpload, GROQ_MODEL } from "@/lib/moderation/groq";
import { getActiveBan } from "@/lib/community/access";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (await getActiveBan(user.id)) return NextResponse.json({ error: "Suspended accounts cannot publish." }, { status: 403 });

  let body: { uploadId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.uploadId) return NextResponse.json({ error: "Missing upload ID." }, { status: 400 });

  const admin = createAdminClient();
  const { data: upload } = await admin.from("uploads").select("*").eq("id", body.uploadId).maybeSingle();
  if (!upload || upload.user_id !== user.id) return NextResponse.json({ error: "Upload not found." }, { status: 404 });

  if (upload.media_type !== "photo") {
    await admin.from("uploads").update({ moderation_status: "needs_review", moderation_note: "Video posts require a moderator to review the video itself." }).eq("id", upload.id);
    return NextResponse.json({ status: "needs_review", message: "Video sent to the moderation queue." });
  }

  const { data: media } = await admin.from("upload_media").select("storage_path").eq("upload_id", upload.id).order("sort_order", { ascending: true });
  const paths = Array.from(new Set([upload.storage_path, ...(media || []).map(row => row.storage_path)]));
  const urls = paths.map(path => admin.storage.from("photos").getPublicUrl(path).data.publicUrl);
  let result;
  try {
    result = await moderateUpload({
      title: upload.title,
      description: upload.description || "",
      camera: upload.camera_name,
      lens: upload.lens_name,
      price: upload.camera_price === null ? null : Number(upload.camera_price),
      currency: upload.currency,
      imageUrls: urls
    });
  } catch (error) {
    const note = error instanceof Error ? error.message : "AI moderation is temporarily unavailable.";
    await admin.from("uploads").update({ moderation_status: "needs_review", moderation_note: note }).eq("id", upload.id);
    await admin.from("moderation_logs").insert({ user_id: user.id, content_type: "upload", content_id: upload.id, decision: "needs_review", reason: note, model: GROQ_MODEL });
    return NextResponse.json({ status: "needs_review", message: "Automatic review is unavailable; your post is waiting for a moderator." });
  }

  const approved = result.decision === "approve" && result.confidence >= 0.65;
  const status = approved ? "approved" : result.decision === "reject" || result.decision === "ban" ? "rejected" : "needs_review";
  const { error } = await admin.from("uploads").update({
    moderation_status: status,
    originality_status: result.originality,
    moderation_note: result.reason
  }).eq("id", upload.id);
  if (error) return NextResponse.json({ error: "Could not save moderation result." }, { status: 500 });

  await admin.from("moderation_logs").insert({
    user_id: user.id, content_type: "upload", content_id: upload.id,
    decision: status, categories: result.categories, reason: result.reason, model: GROQ_MODEL
  });
  if (approved) await admin.rpc("award_xp", {
    p_user_id: user.id, p_amount: 10, p_reason: "Approved photo post",
    p_source_type: "upload", p_source_id: upload.id
  });

  return NextResponse.json({
    status,
    message: status === "approved" ? "Photo approved and published. +10 XP!" :
      status === "rejected" ? "This post did not pass the community rules review." :
      "Your post is waiting for a moderator."
  });
}