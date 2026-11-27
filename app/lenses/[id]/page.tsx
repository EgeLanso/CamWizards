import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";

export default async function Lens({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await createClient();
  const { data: lens } = await s.from("lenses").select("id,name,brand").eq("id", id).maybeSingle();
  if (!lens) notFound();
  const { data: items } = await s.from("uploads").select("id,media_type,storage_path,title,camera_name,lens_name").eq("lens_id", id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false }).limit(48);
  const cards = (items || []).map(item => {
    const bucket = item.media_type === "video" ? "videos" : "photos";
    const { data } = s.storage.from(bucket).getPublicUrl(item.storage_path);
    return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} />;
  });
  return <section className="section"><div className="container"><div className="eyebrow">{lens.brand || "Lens"}</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>{lens.name}</h1><p className="lead">Real examples made with this lens.</p><div className="section-head"><p className="muted">Latest 48 examples</p></div>{cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">No examples yet. Upload a photo made with this lens.</div>}</div></section>;
}