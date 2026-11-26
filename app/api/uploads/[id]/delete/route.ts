import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);

  const { data: item } = await s.from("uploads").select("user_id,storage_path,media_type").eq("id", id).maybeSingle();
  if (!item || item.user_id !== user.id) return NextResponse.redirect(new URL(`/media/${id}`, req.url), 303);

  const bucket = item.media_type === "video" ? "videos" : "photos";
  const { error: storageError } = await s.storage.from(bucket).remove([item.storage_path]);
  // Keep the row if the file could not be removed, so the owner can retry instead of leaking the file.
  if (storageError) return NextResponse.redirect(new URL(`/media/${id}`, req.url), 303);

  await s.from("uploads").delete().eq("id", id);
  return NextResponse.redirect(new URL("/profile", req.url), 303);
}
