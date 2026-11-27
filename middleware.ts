import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response;
  const { data: ban } = await supabase.from("user_bans").select("id")
    .eq("user_id", user.id).is("revoked_at", null)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .limit(1).maybeSingle();
  if (ban) return NextResponse.redirect(new URL("/suspended", request.url));
  return response;
}

export const config = { matcher: ["/upload/:path*", "/lounge/:path*", "/admin/:path*", "/profile/:path*"] };