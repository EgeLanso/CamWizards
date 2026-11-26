import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data.user) {
      const username = data.user.user_metadata?.username || data.user.user_metadata?.preferred_username || `wizard_${data.user.id.slice(0,8)}`;
      await supabase.from("profiles").upsert({
        id: data.user.id,
        username,
        display_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
        avatar_url: data.user.user_metadata?.avatar_url || null
      });
    }
  }
  return NextResponse.redirect(new URL("/profile", request.url));
}