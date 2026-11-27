import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBan } from "@/lib/community/access";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (await getActiveBan(user.id)) return NextResponse.redirect(new URL("/suspended", req.url), 303);

  const { data: item } = await s.from("uploads").select("user_id,media_type,expires_at").eq("id", id).maybeSingle();
  if (!item || item.user_id !== user.id || item.media_type !== "video") {
    return NextResponse.redirect(new URL(`/media/${id}`, req.url), 303);
  }

  const base = item.expires_at && new Date(item.expires_at) > new Date() ? new Date(item.expires_at) : new Date();
  base.setDate(base.getDate() + 10);
  await s.from("uploads").update({ expires_at: base.toISOString() }).eq("id", id);
  return NextResponse.redirect(new URL(`/media/${id}`, req.url), 303);
}
