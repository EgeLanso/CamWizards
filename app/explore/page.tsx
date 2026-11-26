import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";
import { CATEGORIES } from "@/types/database";

export default async function Explore({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const category = (CATEGORIES as readonly string[]).includes(params.category || "") ? params.category! : "";
  const type = params.type === "photo" || params.type === "video" ? params.type : "";
  const condition = params.condition === "new" || params.condition === "used" ? params.condition : "";
  const supabase = await createClient();

  let query = supabase.from("uploads")
    .select("id,user_id,media_type,storage_path,title,description,camera_name,lens_name,expires_at,created_at,camera_id,lens_id,camera_price,currency,purchased_from,condition")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false }).limit(48);
  if (type) query = query.eq("media_type", type);
  if (condition) query = query.eq("condition", condition);

  const safeQ = q.replace(/[,()%*\\_:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (safeQ) query = query.or(`camera_name.ilike.%${safeQ}%,lens_name.ilike.%${safeQ}%,title.ilike.%${safeQ}%,description.ilike.%${safeQ}%`);

  let categoryIds: string[] | null = null;
  if (category) {
    const { data: links } = await supabase.from("upload_categories").select("upload_id").eq("category", category).limit(500);
    categoryIds = (links || []).map(row => row.upload_id);
  }

  const { data: raw } = categoryIds && categoryIds.length === 0
    ? { data: [] }
    : await (categoryIds ? query.in("id", categoryIds) : query);
  const items = raw || [];
  const cards = items.map(item => {
    const bucket = item.media_type === "video" ? "videos" : "photos";
    const { data } = supabase.storage.from(bucket).getPublicUrl(item.storage_path);
    return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} />;
  });

  return <section className="section"><div className="container">
    <div className="eyebrow">Community archive</div>
    <h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>Explore photography.</h1>
    <p className="lead">Find real-world examples by camera, lens, category and shooting style.</p>
    <form className="filters">
      <input className="input" name="q" defaultValue={q} placeholder="Search camera, lens or title..." aria-label="Search uploads" />
      <select name="category" defaultValue={category}><option value="">All categories</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <select name="type" defaultValue={type}><option value="">Photo + video</option><option value="photo">Photos</option><option value="video">Videos</option></select>
      <select name="condition" defaultValue={condition}><option value="">Any condition</option><option value="new">New</option><option value="used">Second-hand</option></select>
      <button className="btn primary">Apply filters</button>
    </form>
    <div className="section-head"><p className="muted">{cards.length} recent results (up to 48)</p></div>
    {cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">No matching uploads yet. Try another search or category.</div>}
  </div></section>;
}