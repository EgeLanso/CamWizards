import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
          {user ? <Link className="btn primary" href="/upload">Upload</Link> : <Link className="btn primary" href="/login">Log in</Link>}
        </div>
      </div>
    </nav>
  );
}