import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login", request.url));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login", request.url));

  // The database trigger normally creates the profile. This is only a safety net for accounts
  // without one, and it never overwrites a profile the user has already edited.
  const { data: existing } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
  if (!existing) {
    const meta = data.user.user_metadata || {};
    await supabase.from("profiles").insert({
      id: data.user.id,
      username: `wizard_${data.user.id.replace(/-/g, "").slice(0, 8)}`,
      display_name: meta.full_name || meta.name || null,
      avatar_url: meta.avatar_url || meta.picture || null
    });
  }
  return NextResponse.redirect(new URL("/profile", request.url));
}
