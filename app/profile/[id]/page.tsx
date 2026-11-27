import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isOwnerAccount } from "@/lib/community/access";
import { MediaCard } from "@/components/MediaCard";
import ReportProfileButton from "@/components/ReportProfileButton";
import { normalizeLocale } from "@/lib/ranks";
import { uiText } from "@/lib/i18n";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PublicProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const s = await createClient();
  const locale = normalizeLocale((await cookies()).get("cw_locale")?.value);
  const t = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);
  const [{ data: profile }, { data: { user } }] = await Promise.all([
    s.from("profiles").select("username,display_name,avatar_url,xp").eq("id", id).maybeSingle(),
    s.auth.getUser()
  ]);
  if (!profile) notFound();
  const isOwner = await isOwnerAccount(id);

  const { data: items } = await s.from("uploads")
    .select("id,media_type,storage_path,title,camera_name,lens_name")
    .eq("user_id", id)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false }).limit(48);

  const cards = (items || []).map(item => {
    const bucket = item.media_type === "video" ? "videos" : "photos";
    const { data } = s.storage.from(bucket).getPublicUrl(item.storage_path);
    return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} locale={locale}/>;
  });

  return <section className="section"><div className="container">
    <div className="profile-head">
      <img className="avatar" src={profile.avatar_url || "/avatar-placeholder.svg"} alt="" decoding="async" />
      <div>
        <div className="eyebrow">{isOwner ? "CamWizards owner" : t("communityMember")}</div>
        <h2>{profile.display_name || profile.username} {isOwner && <span style={{ display:"inline-block",verticalAlign:"middle",fontSize:10,letterSpacing:1,background:"linear-gradient(135deg,#ffe08a,#d99b20)",color:"#241600",padding:"6px 10px",borderRadius:999,fontWeight:900 }}>★ OWNER</span>}</h2>
        <div className="stats">
          <span>@{profile.username}</span>
          <span className="stat"><strong>{items?.length === 48 ? "48+" : items?.length || 0}</strong> {t("recentUploads")}</span>
          <span className="stat"><strong>{profile.xp || 0}</strong> XP</span>
        </div>
        {user && user.id !== id && <ReportProfileButton userId={id} locale={locale}/>}
      </div>
    </div>
    <div className="section-head"><div><h2>{t("photosVideos")}</h2><p className="muted">Latest public posts from this photographer.</p></div></div>
    {cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">{t("noUploads")}</div>}
  </div></section>;
}
