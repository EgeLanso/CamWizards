import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileEditor from "@/components/ProfileEditor";
import { cookies } from "next/headers";
import { getRank, normalizeLocale } from "@/lib/ranks";
import { uiText } from "@/lib/i18n";

const OWNER_EMAIL = process.env.OWNER_EMAIL?.toLowerCase();
export const dynamic = "force-dynamic";

export default async function Profile() {
  const locale = normalizeLocale((await cookies()).get("cw_locale")?.value);
  const t = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: items }] = await Promise.all([
    s.from("profiles").select("username,display_name,avatar_url,xp").eq("id", user.id).maybeSingle(),
    s.from("uploads").select("id,media_type,storage_path,title,expires_at,moderation_status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(60)
  ]);
  const count = items?.length || 0;
  const isOwner = Boolean(OWNER_EMAIL && user.email?.toLowerCase() === OWNER_EMAIL);
  const avatar = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
  const displayName = profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || "";

  const uploadCards = (items || []).map(item => {
    const bucket = item.media_type === "video" ? "videos" : "photos";
    const { data } = s.storage.from(bucket).getPublicUrl(item.storage_path);
    return <div className="card" key={item.id}>
      <Link href={"/media/" + item.id}>
        {item.media_type === "video"
          ? <video className="media" src={data.publicUrl} muted playsInline preload="none" />
          : <img className="media" src={data.publicUrl} alt={item.title} loading="lazy" decoding="async" />}
      </Link>
      <div className="card-body">
        <h3>{item.title}</h3>
        {item.moderation_status !== "approved" && <span className="pill" style={{ display:"inline-block",marginTop:7,color:"var(--accent)" }}>{item.moderation_status === "rejected" ? t("reject") : t("reviewing")}</span>}
        {item.expires_at && <div className="meta" style={{ marginTop:7 }}>Expires {new Date(item.expires_at).toLocaleDateString()}</div>}
        <div style={{ display:"flex",gap:7,marginTop:12 }}><Link className="btn" href={"/media/" + item.id}>Manage</Link></div>
      </div>
    </div>;
  });

  return <section className="section"><div className="container">
    <div className="profile-head">
      <img className="avatar" src={avatar || "/avatar-placeholder.svg"} alt="" decoding="async" />
      <div>
        <div className="eyebrow">{t("account")}</div>
        <h2>{displayName || profile?.username || "Wizard"} {isOwner && <span style={{ display:"inline-block",verticalAlign:"middle",fontSize:10,letterSpacing:1,background:"linear-gradient(135deg,#ffe08a,#d99b20)",color:"#241600",padding:"6px 10px",borderRadius:999,fontWeight:900 }}>★ OWNER</span>}</h2>
        <div className="stats">
          <span className="stat"><strong>{profile?.xp || 0}</strong> XP</span>
          <span className="pill">{getRank(profile?.xp || 0, locale).label}</span>
          <span className="stat"><strong>{count === 60 ? "60+" : count}</strong> {t("recentUploads")}</span>
          <span>{user.email}</span>
        </div>
      </div>
      <div style={{ marginLeft:"auto" }}><form action="/api/auth/signout" method="post"><button className="btn">{t("signOut")}</button></form></div>
    </div>
    <ProfileEditor userId={user.id} initialName={displayName} initialUsername={profile?.username || ""} initialAvatar={avatar} locale={locale}/>
    <div className="section-head" style={{ marginTop:35 }}>
      <div><h2>{t("upload")}</h2><p className="muted">Your latest 60 posts.</p></div>
      <Link className="btn primary" href="/upload">＋ {t("upload")}</Link>
    </div>
    {count ? <div className="grid grid-4">{uploadCards}</div> : <div className="empty">You haven't uploaded anything yet. Share your first photo with the community.</div>}
  </div></section>;
}
