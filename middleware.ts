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

  // Use the Auth server's verified user record. Treat transient auth failures as
  // unauthenticated for middleware purposes; protected pages and API routes enforce access too.
  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    userEmail = user?.email ?? null;
  } catch {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  if (!userId) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const protectedPath = ["/upload", "/lounge", "/admin", "/profile"].some(path =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/")
  );
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const isOwner = Boolean(ownerEmail && userEmail?.trim().toLowerCase() === ownerEmail);
  // The owner must be able to reach the control room to review and lift an erroneous ban.
  if (protectedPath && !isOwner) {
    const { data: ban } = await supabase.from("user_bans").select("id")
      .eq("user_id", userId).is("revoked_at", null)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .limit(1).maybeSingle();
    if (ban) return NextResponse.redirect(new URL("/suspended", request.url));
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
