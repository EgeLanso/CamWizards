import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBan } from "@/lib/community/access";
import { moderateChat, GROQ_MODEL } from "@/lib/moderation/groq";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to chat." }, { status: 401 });
  const ban = await getActiveBan(user.id);
  if (ban) return NextResponse.json({ error: "Your account is suspended.", expiresAt: ban.expires_at }, { status: 403 });

  let body: { message?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const message = String(body.message || "").trim();
  if (!message || message.length > 1000) return NextResponse.json({ error: "Messages must be 1–1000 characters." }, { status: 400 });

  const admin = createAdminClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count || 0) >= 5) return NextResponse.json({ error: "Slow down a little — maximum 5 messages per minute." }, { status: 429 });

  const { data: row, error } = await admin.from("chat_messages").insert({ user_id: user.id, body: message, status: "pending" }).select("id").single();
  if (error || !row) return NextResponse.json({ error: "Could not send message." }, { status: 500 });

  let result;
  try { result = await moderateChat(message); }
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
  if (result.decision === "ban" && result.confidence >= 0.9) {
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
    message: result.decision === "ban" && result.confidence >= 0.9
      ? "A serious community-rule violation was detected. Your account is temporarily suspended for 24 hours."
      : "Message was not published because it violated the community rules."
  });
}
