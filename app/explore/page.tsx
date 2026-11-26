import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";

export default async function Explore({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const category = params.category || "";
  const type = params.type || "";
  const condition = params.condition || "";
  const supabase = await createClient();

  let query = supabase.from("uploads").select("*").order("created_at",{ascending:false}).limit(60);
  if (type === "photo" || type === "video") query = query.eq("media_type", type);
  if (condition === "new" || condition === "used") query = query.eq("condition", condition);
  if (q) query = query.or(`camera_name.ilike.%${q}%,lens_name.ilike.%${q}%,title.ilike.%${q}%,description.ilike.%${q}%`);

  const { data: raw } = await query;
  let items = raw || [];
  if (category) {
    const { data: links } = await supabase.from("upload_categories").select("upload_id").eq("category", category);
    const ids = new Set((links || []).map(x=>x.upload_id));
    items = items.filter(x=>ids.has(x.id));
  }
  items = items.filter(x => !x.expires_at || new Date(x.expires_at) > new Date());

  const cards = await Promise.all(items.map(async item => {
    const bucket = item.media_type === "video" ? "videos" : "photos";
    const { data } = supabase.storage.from(bucket).getPublicUrl(item.storage_path);
    return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} />;
  }));

  return <section className="section"><div className="container">
    <div className="eyebrow">Discovery</div><h1 style={{fontSize:"clamp(42px,6vw,70px)"}}>Explore the real-world archive.</h1>
    <form className="filters">
      <input className="input" name="q" defaultValue={q} placeholder="Camera, lens, creator..." />
      <select name="category" defaultValue={category}><option value="">All categories</option>{["Street","Wildlife","Animals","Architecture","Landscape","Astrophotography","Portrait","Cars","Night","Other"].map(c=><option key={c}>{c}</option>)}</select>
      <select name="type" defaultValue={type}><option value="">Photo + video</option><option value="photo">Photo</option><option value="video">Video</option></select>
      <select name="condition" defaultValue={condition}><option value="">Any condition</option><option value="new">New</option><option value="used">Second-hand</option></select>
      <button className="btn primary">Filter</button>
    </form>
    {cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">No matching uploads yet.</div>}
  </div></section>;
}