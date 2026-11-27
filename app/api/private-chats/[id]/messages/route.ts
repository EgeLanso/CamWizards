import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBan } from "@/lib/community/access";
import {
  privateChatCookieName,
  verifyPrivateChatTicket
} from "@/lib/community/private-chat";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function getRoomAccess(request: NextRequest, id: string) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  if (await getActiveBan(user.id)) {
    return { error: NextResponse.json({ error: "Your account is suspended." }, { status: 403 }) };
  }

  const admin = createAdminClient();
  const [{ data: room }, { data: membership }] = await Promise.all([
    admin.from("private_chats").select("id,password_hash").eq("id", id).maybeSingle(),
    admin.from("private_chat_members").select("chat_id").eq("chat_id", id).eq("user_id", user.id).maybeSingle()
  ]);
  if (!room || !membership) return { error: NextResponse.json({ error: "Room not found." }, { status: 404 }) };

  if (room.password_hash) {
    const ticket = request.cookies.get(privateChatCookieName(id))?.value;
    if (!verifyPrivateChatTicket(ticket, id, user.id)) {
      return { error: NextResponse.json({ error: "Enter this room's password first." }, { status: 403 }) };
    }
  }
  return { user, admin };
}

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const access = await getRoomAccess(request, id);
  if ("error" in access) return access.error;

  const { data: rows, error } = await access.admin
    .from("private_chat_messages")
    .select("id,user_id,body,created_at")
    .eq("chat_id", id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: "Could not load messages." }, { status: 500 });

  const userIds = Array.from(new Set((rows || []).map(row => row.user_id)));
  const { data: profiles } = userIds.length
    ? await access.admin.from("profiles").select("id,username,display_name").in("id", userIds)
    : { data: [] };
  const names = new Map((profiles || []).map(profile => [
    profile.id,
    profile.username || profile.display_name || "Member"
  ]));

  return NextResponse.json({
    messages: (rows || []).map(row => ({
      ...row,
      username: names.get(row.user_id) || "Member"
    }))
  });
}

export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const access = await getRoomAccess(request, id);
  if ("error" in access) return access.error;

  let input: { message?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const message = String(input.message || "").trim();
  if (!message || message.length > 1000) {
    return NextResponse.json({ error: "Messages must be 1–1000 characters." }, { status: 400 });
  }

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await access.admin.from("private_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", id).eq("user_id", access.user.id).gte("created_at", since);
  if ((count || 0) >= 10) {
    return NextResponse.json({ error: "Maximum 10 messages per minute in each room." }, { status: 429 });
  }

  const { data: row, error } = await access.admin.from("private_chat_messages")
    .insert({ chat_id: id, user_id: access.user.id, body: message })
    .select("id,user_id,body,created_at")
    .single();
  if (error || !row) return NextResponse.json({ error: "Could not send message." }, { status: 500 });

  const { data: profile } = await access.admin.from("profiles")
    .select("username,display_name").eq("id", access.user.id).maybeSingle();
  return NextResponse.json({
    message: { ...row, username: profile?.username || profile?.display_name || "Member" }
  }, { status: 201 });
}
