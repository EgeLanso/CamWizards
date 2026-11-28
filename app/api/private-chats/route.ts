import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBan } from "@/lib/community/access";
import {
  createPrivateChatTicket,
  hashPrivateChatPassword,
  privateChatCookieName,
  privateChatCookieOptions,
  verifyPrivateChatTicket,
  verifyPrivateChatPassword
} from "@/lib/community/private-chat";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = createAdminClient();
  const { data: memberships, error: membershipError } = await admin
    .from("private_chat_members")
    .select("chat_id")
    .eq("user_id", user.id);
  if (membershipError) return NextResponse.json({ error: "Could not load private rooms." }, { status: 500 });

  const roomIds = Array.from(new Set((memberships || []).map(row => row.chat_id)));
  if (!roomIds.length) return NextResponse.json({ rooms: [] });

  const [{ data: rooms, error: roomsError }, { data: memberRows, error: membersError }] = await Promise.all([
    admin.from("private_chats").select("id,name,invite_code,owner_id,password_hash,created_at")
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

  const result = (rooms || []).map(room => {
    const locked = Boolean(room.password_hash);
    const unlocked = !locked || verifyPrivateChatTicket(
      request.cookies.get(privateChatCookieName(room.id))?.value,
      room.id,
      user.id
    );
    return {
      id: room.id,
      name: room.name,
      invite_code: room.invite_code,
      owner_id: room.owner_id,
      created_at: room.created_at,
      locked,
      unlocked,
      participants: (memberRows || [])
        .filter(member => member.chat_id === room.id)
        .map(member => names.get(member.user_id) || "Member")
    };
  });

  return NextResponse.json({ rooms: result });
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
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Room name must be 1–60 characters." }, { status: 400 });
  }

  const password = String(input.password || "");
  if (!password || password.length < 6 || password.length > 64) {
    return NextResponse.json({ error: "Room password is required and must be 6–64 characters." }, { status: 400 });
  }

  const admin = createAdminClient();
  let inviteCode = generateInviteCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await admin.from("private_chats").select("id").eq("invite_code", inviteCode).maybeSingle();
    if (!existing) break;
    inviteCode = generateInviteCode();
    attempts++;
  }
  if (attempts >= 5) {
    return NextResponse.json({ error: "Could not generate a unique room code. Try again." }, { status: 500 });
  }

  const passwordHash = await hashPrivateChatPassword(password);
  const { data: room, error: roomError } = await admin.from("private_chats")
    .insert({ name, owner_id: user.id, password_hash: passwordHash, invite_code: inviteCode })
    .select("id,name,invite_code,owner_id,created_at")
    .single();
  if (roomError || !room) return NextResponse.json({ error: "Could not create the room." }, { status: 500 });

  const { error: membersError } = await admin.from("private_chat_members").insert(
    { chat_id: room.id, user_id: user.id, added_by: user.id }
  );
  if (membersError) {
    await admin.from("private_chats").delete().eq("id", room.id);
    return NextResponse.json({ error: "Could not add you to the room." }, { status: 500 });
  }

  const response = NextResponse.json({
    room: {
      ...room,
      locked: true,
      unlocked: true,
      participants: ["You"]
    },
    invite_link: `${process.env.NEXT_PUBLIC_SITE_URL || "https://cam-wizards.vercel.app"}/private-chat/${room.id}?code=${inviteCode}`
  }, { status: 201 });

  response.cookies.set(
    privateChatCookieName(room.id),
    createPrivateChatTicket(room.id, user.id),
    privateChatCookieOptions(room.id)
  );
  return response;
}

export async function DELETE(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let input: { chat_id?: unknown };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const chatId = String(input.chat_id || "");
  if (!chatId) return NextResponse.json({ error: "Missing chat_id." }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from("private_chats").select("owner_id").eq("id", chatId).maybeSingle();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.owner_id !== user.id) return NextResponse.json({ error: "Only the owner can delete the room." }, { status: 403 });

  await admin.from("private_chat_members").delete().eq("chat_id", chatId);
  await admin.from("private_chats").delete().eq("id", chatId);
  return NextResponse.json({ ok: true });
}
