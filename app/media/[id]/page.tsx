import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PhotoGallery from "@/components/PhotoGallery";
import ReportButton from "@/components/ReportButton";
import LikeButton from "@/components/LikeButton";
import { getRank, normalizeLocale } from "@/lib/ranks";
import { getCreatorRanks } from "@/lib/ranking";
import { cookies } from "next/headers";
import { uiText } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function MediaPage({params}:{params:Promise<{id:string}>}) {
  const { id } = await params;
  const s = await createClient();
  const locale = normalizeLocale((await cookies()).get("cw_locale")?.value);
  const t = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);
  const { data: item } = await s.from("uploads").select("*").eq("id", id).maybeSingle();
  if (!item) notFound();

  const { data: { user } } = await s.auth.getUser();
  const owner = user?.id === item.user_id;
  const expired = Boolean(item.expires_at && new Date(item.expires_at) <= new Date());
  if (expired && !owner) notFound();

  const [{ data: cats }, { data: p }, { count: likeCount }, { data: likedRow }, { data: mediaRows }] = await Promise.all([
    s.from("upload_categories").select("category").eq("upload_id", id),
    s.from("profiles").select("username,avatar_url,xp").eq("id", item.user_id).maybeSingle(),
    s.from("likes").select("*", { count: "exact", head: true }).eq("upload_id", id),
    user ? s.from("likes").select("upload_id").eq("upload_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    s.from("upload_media").select("storage_path,media_type,expires_at").eq("upload_id", id).order("sort_order", { ascending: true })
  ]);

  const candidates = [
    { path: item.storage_path, media_type: item.media_type, expires_at: item.expires_at },
    ...(mediaRows || [])
  ];
  const seen = new Set<string>();
  const now = Date.now();
  const gallery = candidates.filter(row => {
    if (!row.storage_path || seen.has(row.storage_path)) return false;
    seen.add(row.storage_path);
    if (!owner && row.media_type === "video" && row.expires_at && new Date(row.expires_at).getTime() <= now) return false;
    return true;
  }).map(row => ({
    path: row.storage_path,
    mediaType: row.media_type === "video" ? "video" as const : "photo" as const,
    expiresAt: row.expires_at,
    url: s.storage.from(row.media_type === "video" ? "videos" : "photos").getPublicUrl(row.storage_path).data.publicUrl
  }));

  if (!gallery.length) notFound();
  const rankMap = await getCreatorRanks(s, [item.user_id]);
  const creatorRank = rankMap.get(item.user_id) || 1001;

  return <section className="detail"><div className="container"><div className="detail-grid">
    <div><PhotoGallery uploadId={item.id} images={gallery} initialThumbnail={item.storage_path} canEdit={owner}/></div>
    <div className="panel">
      <div className="eyebrow">{gallery.length > 1 ? "Mixed gallery" : item.media_type}</div>
      <h2>{item.title}</h2>
      <p className="muted">{item.description}</p>
      <p>by <Link href={"/profile/" + item.user_id} style={{color:"var(--accent)"}}>{p?.username || "Unknown wizard"}</Link></p>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"14px 0"}}>
        <LikeButton uploadId={item.id} initialCount={likeCount || 0} initialLiked={Boolean(likedRow)} locale={locale}/>
        {creatorRank <= 25 && <span className="pill">#{creatorRank} · {getRank(p?.xp || 0, locale).label}</span>}
      </div>
      <div className="meta">{cats?.map(category => <span className="pill" key={category.category}>{category.category}</span>)}</div>
      <div className="kv">
        <div><small className="muted">{t("camera")}</small><br/>{item.camera_name}</div>
        <div><small className="muted">{t("lens")}</small><br/>{item.lens_name || "Built-in / N/A"}</div>
        <div><small className="muted">{t("price")}</small><br/>{item.camera_price ? item.camera_price + " " + (item.currency || "") : "Not listed"}</div>
        <div><small className="muted">{t("condition")}</small><br/>{item.condition || "Not listed"}</div>
      </div>
      {item.purchased_from && <p className="muted">Bought from: {item.purchased_from}</p>}
      {item.expires_at && <p className="notice">{expired ? "This video has expired and is only visible to you." : "Video expires " + new Date(item.expires_at).toLocaleString()}</p>}
      {owner && item.media_type === "video" && <form action={"/api/uploads/" + item.id + "/renew"} method="post"><button className="btn primary">Renew for 10 days</button></form>}
      {owner && <form action={"/api/uploads/" + item.id + "/delete"} method="post" style={{marginTop:10}}><button className="btn danger">Delete upload</button></form>}
      {!owner && user && <ReportButton uploadId={item.id} locale={locale}/>}
    </div>
  </div></div></section>;
}
