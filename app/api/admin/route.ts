import { NextResponse } from "next/server";
import { getStaffContext, canModerate } from "@/lib/community/access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const staff = await getStaffContext();
  if (!staff.user || !canModerate(staff.role) || !staff.admin) {
    return NextResponse.json({ error: "You do not have permission to do this." }, { status: 403 });
  }
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const action = String(input.action || "");
  const targetId = String(input.targetId || "");
  const admin = staff.admin;

  if (action === "set-role") {
    if (!staff.isOwner) return NextResponse.json({ error: "Only the owner can assign staff roles." }, { status: 403 });
    if (!targetId || targetId === staff.user.id) return NextResponse.json({ error: "Invalid target account." }, { status: 400 });
    const role = input.role === "admin" || input.role === "moderator" ? input.role : null;
    if (!role) {
      const { error } = await admin.from("user_roles").delete().eq("user_id", targetId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await admin.from("user_roles").upsert({ user_id: targetId, role, granted_by: staff.user.id });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await admin.from("moderation_logs").insert({
      user_id: staff.user.id, content_type: "role", content_id: targetId,
      decision: role ? "role_assigned" : "role_removed", reason: role || "member"
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "ban") {
    if (staff.role === "moderator") return NextResponse.json({ error: "Moderators cannot suspend accounts." }, { status: 403 });
    if (!targetId || targetId === staff.user.id) return NextResponse.json({ error: "You cannot suspend this account." }, { status: 400 });
    const { data: target } = await admin.auth.admin.getUserById(targetId);
    if (!target?.user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (process.env.OWNER_EMAIL && target.user.email?.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: "The owner account cannot be suspended here." }, { status: 403 });
    }
    const { data: targetRole } = await admin.from("user_roles").select("role").eq("user_id", targetId).maybeSingle();
    if (!staff.isOwner && targetRole?.role) return NextResponse.json({ error: "Only the owner can suspend another staff member." }, { status: 403 });
    const rawHours = Number(input.hours);
    const hours = Number.isFinite(rawHours) ? Math.max(0, Math.min(8760, rawHours)) : 24;
    const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3600000).toISOString() : null;
    const { error } = await admin.from("user_bans").insert({
      user_id: targetId,
      reason: String(input.reason || "Community rules violation").slice(0, 500),
      expires_at: expiresAt,
      created_by: staff.user.id
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({ user_id: staff.user.id, content_type: "account", content_id: targetId, decision: "banned", reason: String(input.reason || "Community rules violation").slice(0, 500) });
    return NextResponse.json({ ok: true });
  }

  if (action === "unban") {
    if (staff.role === "moderator") return NextResponse.json({ error: "Moderators cannot lift account suspensions." }, { status: 403 });
    if (!targetId) return NextResponse.json({ error: "Missing target account." }, { status: 400 });
    const { data: target } = await admin.auth.admin.getUserById(targetId);
    if (!target?.user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const targetIsOwner = Boolean(ownerEmail && target.user.email?.trim().toLowerCase() === ownerEmail);
    if (targetIsOwner && !staff.isOwner) {
      return NextResponse.json({ error: "Only the owner can lift the owner account's suspension." }, { status: 403 });
    }
    const { error } = await admin.from("user_bans").update({ revoked_at: new Date().toISOString() })
      .eq("user_id", targetId).is("revoked_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({ user_id: staff.user.id, content_type: "account", content_id: targetId, decision: "unbanned", reason: "Suspension lifted by staff." });
    return NextResponse.json({ ok: true });
  }

  if (action === "upload-review") {
    if (!input.uploadId || !["approved", "rejected", "needs_review"].includes(String(input.status))) {
      return NextResponse.json({ error: "Invalid moderation action." }, { status: 400 });
    }
    const status = String(input.status);
    const { error } = await admin.from("uploads").update({
      moderation_status: status,
      moderation_note: String(input.reason || "Reviewed by a CamWizards moderator").slice(0, 400)
    }).eq("id", String(input.uploadId));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (status === "approved") {
      const { data: post } = await admin.from("uploads").select("user_id").eq("id", String(input.uploadId)).maybeSingle();
      if (post) await admin.rpc("award_xp", { p_user_id: post.user_id, p_amount: 10, p_reason: "Moderator-approved photo", p_source_type: "upload", p_source_id: String(input.uploadId) });
    }
    await admin.from("moderation_logs").insert({
      user_id: staff.user.id, content_type: "upload", content_id: String(input.uploadId),
      decision: status, reason: String(input.reason || "Manual moderator review")
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "remove-chat") {
    if (!input.messageId) return NextResponse.json({ error: "Missing message ID." }, { status: 400 });
    const { error } = await admin.from("chat_messages").update({ status: "removed" }).eq("id", String(input.messageId));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({ user_id: staff.user.id, content_type: "chat", content_id: String(input.messageId), decision: "removed_by_staff", reason: "Manual chat moderation." });
    return NextResponse.json({ ok: true });
  }

  if (action === "report-status") {
    if (!input.reportId || !["reviewing", "resolved", "dismissed"].includes(String(input.status))) {
      return NextResponse.json({ error: "Invalid report update." }, { status: 400 });
    }
    const { error } = await admin.from("user_reports").update({ status: String(input.status) }).eq("id", String(input.reportId));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({ user_id: staff.user.id, content_type: "report", content_id: String(input.reportId), decision: String(input.status), reason: "Report status updated by staff." });
    return NextResponse.json({ ok: true });
  }

  if (action === "grant-xp") {
    if (staff.role === "moderator" || !targetId) return NextResponse.json({ error: "Only admins can grant XP." }, { status: 403 });
    const amount = Math.max(1, Math.min(100, Math.floor(Number(input.amount) || 0)));
    const { error } = await admin.rpc("award_xp", {
      p_user_id: targetId, p_amount: amount,
      p_reason: String(input.reason || "Admin XP adjustment").slice(0, 200),
      p_source_type: "admin", p_source_id: crypto.randomUUID()
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({ user_id: staff.user.id, content_type: "xp", content_id: targetId, decision: "xp_granted", reason: `+${amount} XP: ${String(input.reason || "Admin XP adjustment").slice(0, 160)}` });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}