import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

interface UploadFile {
  arrayBuffer(): Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload avatar." }, { status: 401 });

  const admin = createAdminClient();
  const formData = await request.formData();
  const file = formData.get("avatar") as unknown as UploadFile | null;
  if (!file) return NextResponse.json({ error: "No avatar file provided." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Invalid file type: ${file.type}. Use JPG, PNG, WebP or AVIF.` }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Avatar is too large (max 5MB)." }, { status: 400 });
  }

  // Remove old avatar file if exists
  const { data: profile } = await admin.from("profiles").select("avatar_file_path").eq("id", user.id).maybeSingle();
  if (profile?.avatar_file_path) {
    await admin.storage.from("avatars").remove([profile.avatar_file_path]);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `avatars/${user.id}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage.from("avatars").upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrl } = await admin.storage.from("avatars").getPublicUrl(path);
  const { error: updateError } = await admin.from("profiles").update({
    avatar_url: publicUrl.publicUrl,
    avatar_file_path: path
  }).eq("id", user.id);
  if (updateError) {
    await admin.storage.from("avatars").remove([path]);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, avatar_url: publicUrl.publicUrl });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("avatar_file_path").eq("id", user.id).maybeSingle();
  if (profile?.avatar_file_path) {
    await admin.storage.from("avatars").remove([profile.avatar_file_path]);
  }
  await admin.from("profiles").update({ avatar_url: null, avatar_file_path: null }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
