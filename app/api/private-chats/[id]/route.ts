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

  let input: { password?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const admin = createAdminClient();
  const [{ data: room }, { data: membership }] = await Promise.all([
    admin.from("private_chats").select("id,password_hash").eq("id", id).maybeSingle(),
    admin.from("private_chat_members").select("chat_id").eq("chat_id", id).eq("user_id", user.id).maybeSingle()
  ]);
  if (!room || !membership) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  if (room.password_hash) {
    const password = String(input.password || "");
    const valid = await verifyPrivateChatPassword(password, room.password_hash);
    if (!valid) return NextResponse.json({ error: "Incorrect room password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  if (room.password_hash) {
    response.cookies.set(
      privateChatCookieName(id),
      createPrivateChatTicket(id, user.id),
      privateChatCookieOptions(id)
    );
  }
  return response;
}
