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
    const { error } = await admin.from("user_bans").update({ revoked_at: new Date().toISOString() }).eq("user_id", targetId).is("revoked_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({ user_id: staff.user.id, content_type: "account", content_id: targetId, decision: "unbanned", reason: "Account suspension lifted by staff." });
    return NextResponse.json({ ok: true });
  }

  if (action === "user-search") {
    const query = String(input.query || "").trim();
    if (!query) return NextResponse.json({ error: "Search query required." }, { status: 400 });
    const { data: profiles, error } = await admin.from("profiles").select("id,username,display_name,avatar_url,xp,created_at").ilike("username", `%${query}%`).or(`display_name.ilike.%${query}%`).order("created_at", { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: roles } = await admin.from("user_roles").select("user_id,role").in("user_id", (profiles || []).map(p => p.id));
    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
    const { data: bans } = await admin.from("user_bans").select("user_id,expires_at,revoked_at").in("user_id", (profiles || []).map(p => p.id)).is("revoked_at", null);
    const bannedIds = new Set((bans || []).filter(b => !b.expires_at || new Date(b.expires_at) > new Date()).map(b => b.user_id));
    return NextResponse.json({ users: (profiles || []).map(p => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      xp: p.xp,
      role: roleMap.get(p.id) || "member",
      banned: bannedIds.has(p.id)
    })) });
  }

  if (action === "badge-create") {
    if (!staff.isOwner && staff.role !== "admin") return NextResponse.json({ error: "Only owner and admins can create badges." }, { status: 403 });
    const badgeText = String(input.badge_text || "").trim();
    const badgeColor = String(input.badge_color || "#3B82F6");
    const badgeEmoji = String(input.badge_emoji || "★");
    if (!badgeText || badgeText.length > 50) return NextResponse.json({ error: "Badge text required (max 50 chars)." }, { status: 400 });
    const { data: badge, error } = await admin.from("user_badges").insert({
      badge_text: badgeText,
      badge_color: badgeColor,
      badge_emoji: badgeEmoji,
      created_by_admin_id: staff.user.id
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, badge });
  }

  if (action === "badge-assign") {
    if (!staff.isOwner && staff.role !== "admin") return NextResponse.json({ error: "Only owner and admins can assign badges." }, { status: 403 });
    if (!targetId) return NextResponse.json({ error: "Target user required." }, { status: 400 });
    const badgeId = String(input.badge_id || "");
    if (!badgeId) return NextResponse.json({ error: "Badge ID required." }, { status: 400 });
    // Remove existing badge for this user
    await admin.from("user_badges").delete().eq("user_id", targetId);
    const { error } = await admin.from("user_badges").update({ user_id: targetId }).eq("id", badgeId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({ user_id: staff.user.id, content_type: "badge", content_id: targetId, decision: "badge_assigned", reason: badgeId });
    return NextResponse.json({ ok: true });
  }

  if (action === "badge-remove") {
    if (!staff.isOwner && staff.role !== "admin") return NextResponse.json({ error: "Only owner and admins can remove badges." }, { status: 403 });
    if (!targetId) return NextResponse.json({ error: "Target user required." }, { status: 400 });
    const { error } = await admin.from("user_badges").delete().eq("user_id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "profile-report-review") {
    if (!staff.isOwner && staff.role !== "admin" && staff.role !== "moderator") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const reportId = String(input.reportId || "");
    const status = String(input.status || "");
    if (!reportId || !["reviewing", "resolved", "dismissed"].includes(status)) return NextResponse.json({ error: "Invalid report update." }, { status: 400 });
    const { error } = await admin.from("profile_reports").update({ status, reviewed_by: staff.user.id, reviewed_at: new Date().toISOString() }).eq("id", reportId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({ user_id: staff.user.id, content_type: "profile_report", content_id: reportId, decision: status, reason: "Profile report reviewed by staff." });
    return NextResponse.json({ ok: true });
  }

  if (action === "message-report-review") {
    if (!staff.isOwner && staff.role !== "admin" && staff.role !== "moderator") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const reportId = String(input.reportId || "");
    const status = String(input.status || "");
    if (!reportId || !["reviewing", "resolved", "dismissed"].includes(status)) return NextResponse.json({ error: "Invalid report update." }, { status: 400 });
    const { error } = await admin.from("message_reports").update({ status, reviewed_by: staff.user.id, reviewed_at: new Date().toISOString() }).eq("id", reportId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({ user_id: staff.user.id, content_type: "message_report", content_id: reportId, decision: status, reason: "Message report reviewed by staff." });
    return NextResponse.json({ ok: true });
  }

  if (action === "upload-status") {
    if (!input.uploadId || !["approved", "removed", "pending"].includes(String(input.status))) {
      return NextResponse.json({ error: "Invalid upload moderation." }, { status: 400 });
    }
    const { error } = await admin.from("uploads").update({
      moderation_status: String(input.status),
      moderation_note: String(input.reason || "Reviewed by a CamWizards moderator").slice(0, 400)
    }).eq("id", String(input.uploadId));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (String(input.status) === "approved") {
      const { data: post } = await admin.from("uploads").select("user_id").eq("id", String(input.uploadId)).maybeSingle();
      if (post) await admin.rpc("award_xp", { p_user_id: post.user_id, p_amount: 10, p_reason: "Moderator-approved photo", p_source_type: "upload", p_source_id: String(input.uploadId) });
    }
    await admin.from("moderation_logs").insert({
      user_id: staff.user.id, content_type: "upload", content_id: String(input.uploadId),
      decision: String(input.status), reason: String(input.reason || "Manual moderator review")
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "clear-chat") {
    if (staff.role === "moderator") {
      return NextResponse.json({ error: "Only admins and the owner can clear the public lounge." }, { status: 403 });
    }
    const { count, error } = await admin.from("chat_messages")
      .update({ status: "removed" }, { count: "exact" })
      .neq("status", "removed");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const cleared = count || 0;
    await admin.from("moderation_logs").insert({
      user_id: staff.user.id,
      content_type: "chat",
      decision: "cleared_by_staff",
      reason: "Public lounge cleared. " + cleared + " messages hidden."
    });
    return NextResponse.json({ ok: true, cleared });
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
