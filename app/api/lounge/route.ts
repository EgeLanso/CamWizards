import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBan, canModerate, getStaffContext } from "@/lib/community/access";
import { moderateChat, GROQ_MODEL } from "@/lib/moderation/groq";
import { containsProfanity, findProfanityWords } from "@/lib/moderation/profanity";

export const runtime = "nodejs";

async function detectLanguage(text: string): Promise<string> {
  const trChars = /[çğıöşüÇĞİÖŞÜ]/.test(text) ? 1 : 0;
  const ruChars = /[А-Яа-яЁё]/.test(text) ? 1 : 0;
  const deChars = /[äöüßÄÖÜ]/.test(text) ? 1 : 0;
  const esChars = /[ñáéíóúü¿¡ÑÁÉÍÓÚÜ]/.test(text) ? 1 : 0;
  const frChars = /[àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛŸ]/.test(text) ? 1 : 0;
  const scores = { tr: trChars, ru: ruChars, de: deChars, es: esChars, fr: frChars };
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : "en";
}

export async function GET(request: Request) {
  const staff = await getStaffContext();
  if (!staff.user || !canModerate(staff.role) || !staff.admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const limit = Number(searchParams.get("limit")) || 50;
  const admin = staff.admin;
  const { data: rows, error } = await admin.from("chat_messages").select("id,user_id,body,status,created_at").eq("status", status).order("created_at", { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const profileIds = [...new Set((rows || []).map(r => r.user_id))];
  const { data: profiles } = await admin.from("profiles").select("id,username,display_name").in("id", profileIds);
  const names = new Map((profiles || []).map(p => [p.id, p.username || p.display_name || "Member"]));
  return NextResponse.json({ messages: (rows || []).map(r => ({ ...r, username: names.get(r.user_id) || "Member" })) });
}

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to chat." }, { status: 401 });
  const ban = await getActiveBan(user.id);
  if (ban) return NextResponse.json({ error: "Your account is suspended.", expiresAt: ban.expires_at }, { status: 403 });

  let body: { message?: string; language?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const message = String(body.message || "").trim();
  const language = String(body.language || "tr");
  if (!message || message.length > 1000) return NextResponse.json({ error: "Messages must be 1–1000 characters." }, { status: 400 });

  // 1. Sunucu tarafı hızlı küfür filtresi (Groq'tan önce)
  const supabase = await createClient();
  const profanityFound = await containsProfanity(message, supabase, language);
  if (profanityFound) {
    const words = await findProfanityWords(message, supabase, language);
    await supabase.from("moderation_logs").insert({
      user_id: user.id, content_type: "chat", content_id: crypto.randomUUID(),
      decision: "rejected", categories: ["profanity"], reason: `Profanity detected: ${words.join(", ")}`, model: "server-filter"
    });
    return NextResponse.json({ error: "Mesajınızda Yasak Kelime Kullanımı Tespit Edildi. Lütfen dilinizi temiz tutun." }, { status: 400 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count || 0) >= 5) return NextResponse.json({ error: "Slow down a little — maximum 5 messages per minute." }, { status: 429 });

  const { data: row, error } = await admin.from("chat_messages").insert({ user_id: user.id, body: message, status: "pending" }).select("id").single();
  if (error || !row) return NextResponse.json({ error: "Could not send message." }, { status: 500 });

  let result;
  try { result = await moderateChat(message, language); }
  catch (error) {
    const reason = error instanceof Error ? error.message : "AI moderation unavailable.";
    await admin.from("moderation_logs").insert({ user_id: user.id, content_type: "chat", content_id: row.id, decision: "needs_review", reason, model: GROQ_MODEL });
    return NextResponse.json({ status: "pending", message: "Sent to the moderation queue. It will appear after review." });
  }

  if (result.decision === "approve" && result.confidence >= 0.55) {
    await admin.from("chat_messages").update({ status: "visible" }).eq("id", row.id);
    const today = new Date(); today.setHours(0,0,0,0);
    const { count: dailyXp } = await admin.from("xp_events").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("source_type", "chat").gte("created_at", today.toISOString());
    if ((dailyXp || 0) < 10) await admin.rpc("award_xp", {
      p_user_id: user.id, p_amount: 1, p_reason: "Helpful lounge participation",
      p_source_type: "chat", p_source_id: row.id
    });
    await admin.from("moderation_logs").insert({ user_id: user.id, content_type: "chat", content_id: row.id, decision: "approved", categories: result.categories, reason: result.reason, model: GROQ_MODEL });
    return NextResponse.json({ status: "visible", id: row.id });
  }

  if (result.decision === "hold" || result.confidence < 0.65 || (result.decision === "ban" && result.confidence < 0.9)) {
    await admin.from("chat_messages").update({ status: "pending" }).eq("id", row.id);
    await admin.from("moderation_logs").insert({ user_id: user.id, content_type: "chat", content_id: row.id, decision: "needs_review", categories: result.categories, reason: result.reason, model: GROQ_MODEL });
    return NextResponse.json({ status: "pending", message: "Message held for moderator review." });
  }

  await admin.from("chat_messages").update({ status: "removed" }).eq("id", row.id);
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const isOwner = Boolean(ownerEmail && user.email?.trim().toLowerCase() === ownerEmail);
  const autoSuspended = result.decision === "ban" && result.confidence >= 0.9 && !isOwner;
  if (autoSuspended) {
    await admin.from("user_bans").insert({
      user_id: user.id, reason: `Automatic 24-hour suspension: ${result.reason}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  }
  await admin.from("moderation_logs").insert({
    user_id: user.id, content_type: "chat", content_id: row.id,
    decision: result.decision, categories: result.categories, reason: result.reason, model: GROQ_MODEL
  });
  return NextResponse.json({
    status: "removed",
    message: autoSuspended
      ? "A serious community-rule violation was detected. Your account is temporarily suspended for 24 hours."
      : isOwner && result.decision === "ban" && result.confidence >= 0.9
        ? "Message removed and logged. The owner account is not automatically suspended."
        : "Message was not published because it violated the community rules."
  });
}

export async function PATCH(request: Request) {
  const staff = await getStaffContext();
  if (!staff.user || !canModerate(staff.role) || !staff.admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  let body: { messageId: string; action: "approve" | "remove"; reason?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { messageId, action, reason } = body;
  if (!messageId || !action) return NextResponse.json({ error: "Missing messageId or action." }, { status: 400 });
  const admin = staff.admin;
  if (action === "approve") {
    const { error } = await admin.from("chat_messages").update({ status: "visible" }).eq("id", messageId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({
      user_id: staff.user.id, content_type: "chat", content_id: messageId,
      decision: "approved_by_staff", reason: reason || "Approved by moderator."
    });
    return NextResponse.json({ ok: true });
  }
  if (action === "remove") {
    const { error } = await admin.from("chat_messages").update({ status: "removed" }).eq("id", messageId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("moderation_logs").insert({
      user_id: staff.user.id, content_type: "chat", content_id: messageId,
      decision: "removed_by_staff", reason: reason || "Removed by moderator."
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
