import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PublicProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const s = await createClient();
  const { data: p } = await s.from("profiles").select("username,display_name,avatar_url").eq("id", id).maybeSingle();
  if (!p) notFound();

  const { data: items } = await s.from("uploads").select("id,media_type,storage_path,title,camera_name,lens_name")
    .eq("user_id", id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false }).limit(48);

  const cards = (items || []).map(item => {
    const bucket = item.media_type === "video" ? "videos" : "photos";
    const { data } = s.storage.from(bucket).getPublicUrl(item.storage_path);
    return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} />;
  });

  return <section className="section"><div className="container">
    <div className="profile-head">
      <img className="avatar" src={p.avatar_url || "/avatar-placeholder.svg"} alt="" decoding="async" />
      <div><div className="eyebrow">Community member</div><h2>{p.display_name || p.username}</h2><div className="stats"><span>@{p.username}</span><span className="stat"><strong>{cards.length === 48 ? "48+" : cards.length}</strong> recent uploads</span></div></div>
    </div>
    <div className="section-head"><div><h2>Photos and videos</h2><p className="muted">Latest public posts from this photographer.</p></div></div>
    {cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">No public uploads yet.</div>}
  </div></section>;
}