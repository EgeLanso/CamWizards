import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PublicProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const s = await createClient();
  const { data: p } = await s.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const { data: items } = await s.from("uploads").select("*")
    .eq("user_id", id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });

  const cards = (items || []).map(x => {
    const bucket = x.media_type === "video" ? "videos" : "photos";
    const { data } = s.storage.from(bucket).getPublicUrl(x.storage_path);
    return <MediaCard key={x.id} item={x} publicUrl={data.publicUrl} />;
  });

  return <section className="section"><div className="container">
    <div className="profile-head">
      <img className="avatar" src={p.avatar_url || "/avatar-placeholder.svg"} alt="" />
      <div>
        <div className="eyebrow">Wizard</div>
        <h2>{p.display_name || p.username}</h2>
        <div className="stats"><span>@{p.username}</span><span className="stat"><strong>{cards.length}</strong> uploads</span></div>
      </div>
    </div>
    <div className="section-head"><h2>Uploads</h2></div>
    {cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">No public uploads yet.</div>}
  </div></section>;
}
