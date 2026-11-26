import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const meta = data.user.user_metadata || {};
      const username = meta.username || meta.preferred_username || `wizard_${data.user.id.slice(0,8)}`;
      const displayName = meta.full_name || meta.name || null;
      const avatarUrl = meta.avatar_url || meta.picture || null;
      await supabase.from("profiles").upsert({
        id: data.user.id,
        username,
        display_name: displayName,
        avatar_url: avatarUrl
      }, { onConflict: "id" });
    }
  }
  return NextResponse.redirect(new URL("/profile", request.url));
}
