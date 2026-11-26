import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileEditor from "@/components/ProfileEditor";

const OWNER_EMAIL = "tezcanaric14@gmail.com";

export default async function Profile() {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await s.from("profiles").select("*").eq("id", user.id).single();
  const { data: items } = await s.from("uploads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const count = items?.length || 0;
  const isOwner = user.email?.toLowerCase() === OWNER_EMAIL;
  const avatar = p?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
  const displayName = p?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || "";
  return <section className="section"><div className="container">
    <div className="profile-head">
      <img className="avatar" src={avatar || "/avatar-placeholder.svg"} alt="" />
      <div>
        <div className="eyebrow">Profile</div>
        <h2>{displayName || p?.username || "Wizard"} {isOwner && <span style={{display:"inline-block",verticalAlign:"middle",fontSize:12,letterSpacing:1,background:"linear-gradient(135deg,#ffe08a,#d99b20)",color:"#241600",padding:"6px 10px",borderRadius:999,fontWeight:900}}>★ OWNER</span>}</h2>
        <div className="stats"><span className="stat"><strong>{count}</strong> uploads</span><span>{user.email}</span></div>
      </div>
      <div style={{marginLeft:"auto"}}><form action="/api/auth/signout" method="post"><button className="btn">Log out</button></form></div>
    </div>
    <ProfileEditor userId={user.id} initialName={displayName} initialUsername={p?.username || ""} initialAvatar={avatar} />
    <div className="section-head"><h2>Your uploads</h2><Link className="btn primary" href="/upload">New upload</Link></div>
    {count ? <div className="grid grid-4">{items!.map(x=><div className="card" key={x.id}><Link href={`/media/${x.id}`}><div className="media" style={{display:"flex",alignItems:"center",justifyContent:"center"}}>{x.media_type === "video" ? "VIDEO" : "PHOTO"}</div></Link><div className="card-body"><h3>{x.title}</h3>{x.expires_at&&<div className="meta" style={{marginTop:7}}>Expires {new Date(x.expires_at).toLocaleDateString()}</div>}<div style={{display:"flex",gap:7,marginTop:12}}><Link className="btn" href={`/media/${x.id}`}>Manage</Link></div></div></div>)}</div> : <div className="empty">You haven't uploaded anything yet.</div>}
  </div></section>;
}
