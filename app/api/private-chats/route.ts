import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
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

  const result = (rooms || []).map(room => {
    const locked = Boolean(room.password_hash);
    const unlocked = !locked || verifyPrivateChatTicket(
      (request as Request & { cookies?: { get(name: string): { value: string } | undefined } })
        .cookies?.get(privateChatCookieName(room.id))?.value,
      room.id,
      user.id
    );
    return {
      id: room.id,
      name: room.name,
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

  let input: { name?: unknown; usernames?: unknown; password?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const name = String(input.name || "").trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Room name must be 1–60 characters." }, { status: 400 });
  }

  const usernames = Array.isArray(input.usernames)
    ? Array.from(new Set(input.usernames.map(value => String(value).trim().replace(/^@/, "")).filter(Boolean)))
    : [];
  if (!usernames.length || usernames.length > 20) {
    return NextResponse.json({ error: "Add 1–20 friends by their exact usernames." }, { status: 400 });
  }

  const password = String(input.password || "");
  if (password && (password.length < 6 || password.length > 64)) {
    return NextResponse.json({ error: "Room password must be 6–64 characters." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profiles, error: profilesError } = await admin
    .from("profiles").select("id,username").in("username", usernames);
  if (profilesError) return NextResponse.json({ error: "Could not look up usernames." }, { status: 500 });

  const found = profiles || [];
  const foundNames = new Set(found.map(profile => profile.username));
  const missing = usernames.filter(username => !foundNames.has(username));
  if (missing.length) {
    return NextResponse.json({ error: "Username not found: " + missing.join(", ") }, { status: 404 });
  }

  const passwordHash = password ? await hashPrivateChatPassword(password) : null;
  const { data: room, error: roomError } = await admin.from("private_chats")
    .insert({ name, owner_id: user.id, password_hash: passwordHash })
    .select("id,name,owner_id,created_at")
    .single();
  if (roomError || !room) return NextResponse.json({ error: "Could not create the room." }, { status: 500 });

  const participantIds = Array.from(new Set([user.id, ...found.map(profile => profile.id)]));
  const { error: membersError } = await admin.from("private_chat_members").insert(
    participantIds.map(userId => ({ chat_id: room.id, user_id: userId, added_by: user.id }))
  );
  if (membersError) {
    await admin.from("private_chats").delete().eq("id", room.id);
    return NextResponse.json({ error: "Could not add the selected members." }, { status: 500 });
  }

  const response = NextResponse.json({
    room: {
      ...room,
      locked: Boolean(passwordHash),
      unlocked: true,
      participants: [user.username || "You", ...found.filter(profile => profile.id !== user.id).map(profile => profile.username)]
    }
  }, { status: 201 });

  if (passwordHash) {
    response.cookies.set(
      privateChatCookieName(room.id),
      createPrivateChatTicket(room.id, user.id),
      privateChatCookieOptions(room.id)
    );
  }
  return response;
}
