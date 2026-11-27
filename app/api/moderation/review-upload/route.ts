import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateUpload, searchGearPrice, GROQ_MODEL } from "@/lib/moderation/groq";
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
  if (upload.moderation_status !== "pending") {
    return NextResponse.json({ status: upload.moderation_status, message: "This post has already been reviewed or is waiting for a moderator." });
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentReviews } = await admin.from("moderation_logs").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("content_type", "upload").gte("created_at", since);
  if ((recentReviews || 0) >= 5) return NextResponse.json({ error: "You have reached the automatic review limit. Your next post will wait for a moderator." }, { status: 429 });

  // Claim the pending row before calling Groq, preventing repeat requests from burning the API quota.
  const { data: claimed } = await admin.from("uploads").update({
    moderation_status: "needs_review", moderation_note: "Automatic review in progress."
  }).eq("id", upload.id).eq("moderation_status", "pending").select("id").maybeSingle();
  if (!claimed) return NextResponse.json({ status: "needs_review", message: "This post is already being reviewed." });

  if (upload.media_type !== "photo") {
    await admin.from("uploads").update({ moderation_status: "needs_review", moderation_note: "Video posts require a moderator to review the video itself." }).eq("id", upload.id);
    return NextResponse.json({ status: "needs_review", message: "Video sent to the moderation queue." });
  }

  const { data: media } = await admin.from("upload_media").select("id,storage_path,content_hash").eq("upload_id", upload.id).order("sort_order", { ascending: true });
  const paths = Array.from(new Set([upload.storage_path, ...(media || []).map(row => row.storage_path)]));
  const urls = paths.map(path => admin.storage.from("photos").getPublicUrl(path).data.publicUrl);

  // Exact SHA-256 matching catches byte-identical re-uploads. It cannot detect edited copies.
  const fingerprintRows = (media || []).slice(0, 3);
  const hashes: string[] = [];
  try {
    for (const row of fingerprintRows) {
      const url = admin.storage.from("photos").getPublicUrl(row.storage_path).data.publicUrl;
      const fileResponse = await fetch(url, { cache: "no-store" });
      if (!fileResponse.ok) throw new Error("Could not inspect uploaded image bytes.");
      const bytes = await fileResponse.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
      hashes.push(hash);
      await admin.from("upload_media").update({ content_hash: hash }).eq("id", row.id);
    }
    if (hashes.length) {
      const { data: matches } = await admin.from("upload_media").select("upload_id").in("content_hash", hashes).neq("upload_id", upload.id).limit(1);
      if (matches?.length) {
        const note = "An identical image file already exists in another post. Moderator review is required; this is not proof of copyright infringement.";
        await admin.from("uploads").update({ moderation_status: "needs_review", originality_status: "possible_edit", moderation_note: note }).eq("id", upload.id);
        await admin.from("moderation_logs").insert({ user_id: user.id, content_type: "upload", content_id: upload.id, decision: "needs_review", categories: ["exact_duplicate_file"], reason: note, model: "SHA-256" });
        return NextResponse.json({ status: "needs_review", message: "An identical file was found in the community. Your post is waiting for a moderator." });
      }
    }
  } catch {
    await admin.from("uploads").update({ moderation_status: "needs_review", moderation_note: "Could not complete the file-integrity check; manual review required." }).eq("id", upload.id);
    return NextResponse.json({ status: "needs_review", message: "The file check could not finish. Your post is waiting for a moderator." });
  }
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
  let gearCheckNote: string | null = null;
  if (approved && upload.camera_price !== null && Number(upload.camera_price) > 0) {
    try {
      gearCheckNote = await searchGearPrice({
        camera: upload.camera_name,
        lens: upload.lens_name,
        price: Number(upload.camera_price),
        currency: upload.currency,
        condition: upload.condition
      });
    } catch (error) {
      gearCheckNote = error instanceof Error ? error.message : "Gear price search unavailable.";
    }
  }
  const { error } = await admin.from("uploads").update({
    moderation_status: status,
    originality_status: result.originality,
    moderation_note: result.reason,
    gear_check_note: gearCheckNote
  }).eq("id", upload.id);
  if (error) return NextResponse.json({ error: "Could not save moderation result." }, { status: 500 });

  await admin.from("moderation_logs").insert({
    user_id: user.id, content_type: "upload", content_id: upload.id,
    decision: status, categories: result.categories, reason: result.reason, model: GROQ_MODEL
  });
  if (gearCheckNote) await admin.from("moderation_logs").insert({
    user_id: user.id, content_type: "gear_price_check", content_id: upload.id,
    decision: "checked", reason: gearCheckNote, model: "openai/gpt-oss-20b + browser_search"
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