import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";
import { CATEGORIES } from "@/types/database";

export default async function Explore({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const category = (CATEGORIES as readonly string[]).includes(params.category || "") ? params.category! : "";
  const type = params.type || "";
  const condition = params.condition || "";
  const supabase = await createClient();

  let items: any[] = [];
  let noMatch = false;

  let query = supabase.from("uploads").select("*")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at",{ascending:false}).limit(60);
  if (type === "photo" || type === "video") query = query.eq("media_type", type);
  if (condition === "new" || condition === "used") query = query.eq("condition", condition);

  // Characters that have a meaning inside a PostgREST filter string are removed from the search text,
  // otherwise a comma or parenthesis in the search box breaks the query.
  const safeQ = q.replace(/[,()%*\\_:"']/g, " ").replace(/\s+/g, " ").trim();
  if (safeQ) query = query.or(`camera_name.ilike.%${safeQ}%,lens_name.ilike.%${safeQ}%,title.ilike.%${safeQ}%,description.ilike.%${safeQ}%`);

  // Category is applied in the database query, so the 60-item limit counts only matching uploads.
  if (category) {
    const { data: links } = await supabase.from("upload_categories").select("upload_id").eq("category", category);
    const ids = (links || []).map(x => x.upload_id);
    if (ids.length) query = query.in("id", ids); else noMatch = true;
  }

  if (!noMatch) {
    const { data: raw } = await query;
    items = raw || [];
  }

  const cards = items.map(item => {
    const bucket = item.media_type === "video" ? "videos" : "photos";
    const { data } = supabase.storage.from(bucket).getPublicUrl(item.storage_path);
    return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} />;
  });

  return <section className="section"><div className="container">
    <div className="eyebrow">Discovery</div><h1 style={{fontSize:"clamp(42px,6vw,70px)"}}>Explore the real-world archive.</h1>
    <form className="filters">
      <input className="input" name="q" defaultValue={q} placeholder="Camera, lens, title..." />
      <select name="category" defaultValue={category}><option value="">All categories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
      <select name="type" defaultValue={type}><option value="">Photo + video</option><option value="photo">Photo</option><option value="video">Video</option></select>
      <select name="condition" defaultValue={condition}><option value="">Any condition</option><option value="new">New</option><option value="used">Second-hand</option></select>
      <button className="btn primary">Filter</button>
    </form>
    {cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">No matching uploads yet.</div>}
  </div></section>;
}
