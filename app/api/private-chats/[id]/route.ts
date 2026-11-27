import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBan } from "@/lib/community/access";
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
  if (await getActiveBan(user.id)) return NextResponse.json({ error: "Your account is suspended." }, { status: 403 });

  let input: { password?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const admin = createAdminClient();
  const { data: room } = await admin.from("private_chats")
    .select("id,password_hash").eq("id", id).maybeSingle();
  if (!room || !room.password_hash) {
    return NextResponse.json({ error: "Room not found or not password-protected." }, { status: 404 });
  }

  const password = String(input.password || "");
  if (!await verifyPrivateChatPassword(password, room.password_hash)) {
    return NextResponse.json({ error: "Incorrect room password." }, { status: 401 });
  }

  const { error: memberError } = await admin.from("private_chat_members").upsert(
    { chat_id: id, user_id: user.id, added_by: user.id },
    { onConflict: "chat_id,user_id", ignoreDuplicates: true }
  );
  if (memberError) return NextResponse.json({ error: "Could not join the room." }, { status: 500 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    privateChatCookieName(id),
    createPrivateChatTicket(id, user.id),
    privateChatCookieOptions(id)
  );
  return response;
}
