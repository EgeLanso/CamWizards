import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBan } from "@/lib/community/access";
import {
  createPrivateChatTicket,
  hashPrivateChatPassword,
  privateChatCookieName,
  privateChatCookieOptions,
  verifyPrivateChatTicket
} from "@/lib/community/private-chat";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = createAdminClient();
  const { data: memberships, error: membershipError } = await admin
    .from("private_chat_members").select("chat_id").eq("user_id", user.id);
  if (membershipError) return NextResponse.json({ error: "Could not load private rooms." }, { status: 500 });

  const roomIds = Array.from(new Set((memberships || []).map(row => row.chat_id)));
  if (!roomIds.length) return NextResponse.json({ rooms: [] });

  const [{ data: rooms, error: roomsError }, { data: memberRows, error: membersError }] = await Promise.all([
    admin.from("private_chats").select("id,name,owner_id,password_hash,created_at")
      .in("id", roomIds).order("created_at", { ascending: false }),
    admin.from("private_chat_members").select("chat_id,user_id").in("chat_id", roomIds)
  ]);
  if (roomsError || membersError) return NextResponse.json({ error: "Could not load private rooms." }, { status: 500 });

  const userIds = Array.from(new Set((memberRows || []).map(row => row.user_id)));
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id,username,display_name").in("id", userIds)
    : { data: [] };
  const names = new Map((profiles || []).map(profile => [
    profile.id,
    profile.username || profile.display_name || "Member"
  ]));

  return NextResponse.json({
    rooms: (rooms || []).map(room => ({
      id: room.id,
      name: room.name,
      owner_id: room.owner_id,
      created_at: room.created_at,
      locked: Boolean(room.password_hash),
      unlocked: !room.password_hash || verifyPrivateChatTicket(
        request.cookies.get(privateChatCookieName(room.id))?.value,
        room.id,
        user.id
      ),
      participants: (memberRows || [])
        .filter(member => member.chat_id === room.id)
        .map(member => names.get(member.user_id) || "Member")
    }))
  });
}

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const ban = await getActiveBan(user.id);
  if (ban) return NextResponse.json({ error: "Your account is suspended." }, { status: 403 });

  let input: { name?: unknown; password?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const name = String(input.name || "").trim();
  const password = String(input.password || "");
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Room name must be 1–60 characters." }, { status: 400 });
  }
  if (password.length < 6 || password.length > 64) {
    return NextResponse.json({ error: "Room password is required and must be 6–64 characters." }, { status: 400 });
  }

  const admin = createAdminClient();
  const passwordHash = await hashPrivateChatPassword(password);
  const { data: room, error: roomError } = await admin.from("private_chats")
    .insert({ name, owner_id: user.id, password_hash: passwordHash })
    .select("id,name,owner_id,created_at")
    .single();
  if (roomError || !room) return NextResponse.json({ error: "Could not create the room." }, { status: 500 });

  const { error: memberError } = await admin.from("private_chat_members")
    .insert({ chat_id: room.id, user_id: user.id, added_by: user.id });
  if (memberError) {
    await admin.from("private_chats").delete().eq("id", room.id);
    return NextResponse.json({ error: "Could not create room membership." }, { status: 500 });
  }

  const response = NextResponse.json({
    room: { ...room, locked: true, unlocked: true, participants: ["You"] }
  }, { status: 201 });
  response.cookies.set(
    privateChatCookieName(room.id),
    createPrivateChatTicket(room.id, user.id),
    privateChatCookieOptions(room.id)
  );
  return response;
}
