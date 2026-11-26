import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";

export default async function Camera({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await createClient();
  const { data: camera } = await s.from("cameras").select("id,name,brand,is_camcorder").eq("id", id).maybeSingle();
  if (!camera) notFound();
  const { data: items } = await s.from("uploads").select("*").eq("camera_id", id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false }).limit(48);
  const cards = (items || []).map(item => {
    const bucket = item.media_type === "video" ? "videos" : "photos";
    const { data } = s.storage.from(bucket).getPublicUrl(item.storage_path);
    return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} />;
  });
  return <section className="section"><div className="container"><div className="eyebrow">{camera.brand || "Camera"}</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>{camera.name}</h1><p className="lead">Real community examples made with this camera.</p><div className="section-head"><p className="muted">Latest 48 examples</p></div>{cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">No examples yet. Upload a photo made with this camera.</div>}</div></section>;
}