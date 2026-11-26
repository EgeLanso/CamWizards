import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const OWNER_EMAIL = process.env.OWNER_EMAIL?.toLowerCase();

export async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("avatar_url,display_name").eq("id", user.id).single() : { data: null };
  const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const isOwner = Boolean(OWNER_EMAIL && user?.email?.toLowerCase() === OWNER_EMAIL);
  return (
    <nav className="site-nav">
      <div className="container nav-inner">
        <Link href="/" className="logo"><span className="logo-mark" />CamWizards</Link>
        <div className="nav-links">
          <Link href="/explore">Explore</Link>
          <Link href="/cameras">Cameras</Link>
          <Link href="/lenses">Lenses</Link>
          <Link href="/recommend">Find Your Camera</Link>
        </div>
        <div className="nav-actions">
          {user ? <>
            <Link href="/profile" style={{display:"flex",alignItems:"center",gap:8}}>
              {avatar ? <img src={avatar} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}} /> : <span className="avatar" style={{width:34,height:34}} />}
              <span style={{fontSize:13,fontWeight:750}}>{isOwner ? "OWNER" : profile?.display_name || "Profile"}</span>
            </Link>
            <Link className="btn primary" href="/upload">Upload</Link>
          </> : <Link className="btn primary" href="/login">Log in</Link>}
        </div>
      </div>
    </nav>
  );
}
