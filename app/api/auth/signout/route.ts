import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const s = await createClient();
  await s.auth.signOut();
  // 303 turns the redirect into a GET; the default 307 would re-POST to the target page.
  return NextResponse.redirect(new URL("/", request.url), 303);
}
