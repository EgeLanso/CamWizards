import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const OWNER_EMAIL = process.env.OWNER_EMAIL?.toLowerCase();

export async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("avatar_url,display_name").eq("id", user.id).maybeSingle()
    : { data: null };
  const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const isOwner = Boolean(OWNER_EMAIL && user?.email?.toLowerCase() === OWNER_EMAIL);

  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="container nav-inner">
        <Link href="/" className="logo"><span className="logo-mark" aria-hidden="true" />CamWizards</Link>
        <div className="nav-links">
          <Link href="/explore">Explore</Link>
          <Link href="/cameras">Cameras</Link>
          <Link href="/lenses">Lenses</Link>
          <Link href="/recommend">Camera finder</Link>
        </div>
        <div className="nav-actions">
          {user ? <>
            <Link href="/profile" className="nav-profile" aria-label="Your profile">
              {avatar ? <img className="nav-avatar" src={avatar} alt="" /> : <span className="nav-avatar" />}
              <span style={{fontSize:12,fontWeight:800}}>{isOwner ? "OWNER" : profile?.display_name || "Profile"}</span>
            </Link>
            <Link className="btn primary" href="/upload">＋ Upload</Link>
          </> : <>
            <Link className="btn ghost hide-mobile" href="/login">Log in</Link>
            <Link className="btn primary" href="/signup">Join free</Link>
          </>}
        </div>
      </div>
    </nav>
  );
}