import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPrivateChatTicket,
  privateChatCookieName,
  privateChatCookieOptions,
  verifyPrivateChatPassword
} from "@/lib/community/private-chat";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let input: { password?: unknown; invite_code?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const admin = createAdminClient();
  const [{ data: room }, { data: membership }] = await Promise.all([
    admin.from("private_chats").select("id,password_hash,invite_code").eq("id", id).maybeSingle(),
    admin.from("private_chat_members").select("chat_id").eq("chat_id", id).eq("user_id", user.id).maybeSingle()
  ]);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  // If not a member, require invite_code + password to join
  if (!membership) {
    const inviteCode = String(input.invite_code || "");
    if (!inviteCode || inviteCode !== room.invite_code) {
      return NextResponse.json({ error: "Invalid or missing room invite code." }, { status: 403 });
    }
    const password = String(input.password || "");
    if (!room.password_hash || !(await verifyPrivateChatPassword(password, room.password_hash))) {
      return NextResponse.json({ error: "Incorrect room password." }, { status: 401 });
    }
    const { error: insertError } = await admin.from("private_chat_members").insert(
      { chat_id: id, user_id: user.id, added_by: user.id }
    );
    if (insertError) return NextResponse.json({ error: "Could not join the room." }, { status: 500 });
  }

  // If member but room is locked, verify password for ticket
  if (room.password_hash && !membership) {
    const password = String(input.password || "");
    const valid = await verifyPrivateChatPassword(password, room.password_hash);
    if (!valid) return NextResponse.json({ error: "Incorrect room password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, room: { id: room.id, invite_code: room.invite_code } });
  if (room.password_hash) {
    response.cookies.set(
      privateChatCookieName(id),
      createPrivateChatTicket(id, user.id),
      privateChatCookieOptions(id)
    );
  }
  return response;
}


export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: room }, { data: membership }] = await Promise.all([
    admin.from("private_chats").select("id,name,invite_code,owner_id,password_hash,created_at").eq("id", id).maybeSingle(),
    admin.from("private_chat_members").select("user_id").eq("chat_id", id).eq("user_id", user.id).maybeSingle()
  ]);
  if (!room || !membership) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const { data: memberRows } = await admin.from("private_chat_members").select("user_id").eq("chat_id", id);
  const userIds = (memberRows || []).map(m => m.user_id);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id,username,display_name").in("id", userIds)
    : { data: [] };
  const names = new Map((profiles || []).map(p => [p.id, p.username || p.display_name || "Member"]));

  return NextResponse.json({
    room: {
      id: room.id,
      name: room.name,
      invite_code: room.invite_code,
      owner_id: room.owner_id,
      created_at: room.created_at,
      locked: Boolean(room.password_hash),
      participants: (memberRows || []).map(m => names.get(m.user_id) || "Member")
    }
  });
}
