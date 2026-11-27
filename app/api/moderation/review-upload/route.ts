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
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.uploadId) return NextResponse.json({ error: "Missing upload ID." }, { status: 400 });

  const admin = createAdminClient();
  const { data: upload } = await admin.from("uploads").select("*").eq("id", body.uploadId).maybeSingle();
  if (!upload || upload.user_id !== user.id) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  if (upload.moderation_status !== "pending") {
    return NextResponse.json({
      status: upload.moderation_status,
      message: "This post has already been reviewed or is waiting for a moderator."
    });
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentReviews } = await admin.from("moderation_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("content_type", "upload")
    .gte("created_at", since);
  if ((recentReviews || 0) >= 5) {
    return NextResponse.json({ error: "You have reached the automatic name-review limit. Your next post will wait for a moderator." }, { status: 429 });
  }

  // Claim the row before calling Groq. Only textual names are sent; media files are never inspected.
  const { data: claimed } = await admin.from("uploads").update({
    moderation_status: "needs_review",
    moderation_note: "Checking the title and camera/lens names."
  }).eq("id", upload.id).eq("moderation_status", "pending").select("id").maybeSingle();
  if (!claimed) return NextResponse.json({ status: "needs_review", message: "This post is already being reviewed." });

  let result;
  try {
    result = await moderateUpload({
      title: String(upload.title || ""),
      camera: String(upload.camera_name || ""),
      lens: upload.lens_name ? String(upload.lens_name) : null
    });
  } catch (error) {
    const note = error instanceof Error ? error.message : "Name review is temporarily unavailable.";
    await admin.from("uploads").update({
      moderation_status: "needs_review",
      moderation_note: note
    }).eq("id", upload.id);
    await admin.from("moderation_logs").insert({
      user_id: user.id, content_type: "upload", content_id: upload.id,
      decision: "needs_review", reason: note, model: GROQ_MODEL
    });
    return NextResponse.json({
      status: "needs_review",
      message: "Name review is unavailable; your post is waiting for moderator review."
    });
  }

  const approved = result.decision === "approve" && result.confidence >= 0.55;
  const rejected = result.decision === "reject" || result.decision === "ban";
  const status = approved ? "approved" : rejected ? "rejected" : "needs_review";
  const note = result.reason || "Text metadata reviewed.";

  const { error } = await admin.from("uploads").update({
    moderation_status: status,
    originality_status: "unverified",
    moderation_note: note,
    gear_check_note: null
  }).eq("id", upload.id);
  if (error) return NextResponse.json({ error: "Could not save name-review result." }, { status: 500 });

  await admin.from("moderation_logs").insert({
    user_id: user.id,
    content_type: "upload",
    content_id: upload.id,
    decision: status,
    categories: result.categories,
    reason: note,
    model: GROQ_MODEL
  });

  if (approved) {
    await admin.rpc("award_xp", {
      p_user_id: user.id,
      p_amount: 10,
      p_reason: "Approved post metadata",
      p_source_type: "upload",
      p_source_id: upload.id
    });
  }

  return NextResponse.json({
    status,
    message: status === "approved"
      ? "Title and camera/lens names approved. Your post is published. +10 XP!"
      : status === "rejected"
        ? "The post title or camera/lens names did not pass the community rules review."
        : "The post is waiting for a moderator to review its text metadata."
  });
}
