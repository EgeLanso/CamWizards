import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";

export default async function Home() {
  const supabase = await createClient();
  const { data: items } = await supabase.from("uploads").select("*").eq("media_type","photo").order("created_at",{ascending:false}).limit(8);
  const cards = await Promise.all((items || []).map(async item => {
    const { data } = supabase.storage.from("photos").getPublicUrl(item.storage_path);
    return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} />;
  }));

  return <>
    <section className="hero"><div className="container hero-grid">
      <div>
        <div className="eyebrow">Community camera intelligence</div>
        <h1>See what your camera can really do.</h1>
        <p className="lead">CamWizards turns real-world photography into a searchable gear reference. Find cameras, lenses and setups through the photos and videos people actually made with them.</p>
        <div className="hero-actions"><Link className="btn primary" href="/explore">Explore examples</Link><Link className="btn" href="/upload">Upload your work</Link><Link className="btn ghost" href="/recommend">Find your camera</Link></div>
        <form className="search-box" action="/explore"><input className="input" name="q" placeholder="Search Sony A7 III, 50mm f/1.8, Street..." /><button className="btn primary">Search</button></form>
      </div>
      <div className="hero-art"><div className="camera-shape" /></div>
    </div></section>

    <section className="section"><div className="container">
      <div className="section-head"><div><div className="eyebrow">Community</div><h2>Real photos. Real setups.</h2><p className="muted">No stock-photo filler. The database grows from photographer uploads.</p></div><Link className="btn" href="/explore">View all</Link></div>
      {cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">No community uploads yet. Be the first wizard.</div>}
    </div></section>

    <section className="section"><div className="container">
      <div className="section-head"><div><div className="eyebrow">Browse</div><h2>Find by photography type.</h2></div></div>
      <div className="category-grid">{["Street","Wildlife","Animals","Architecture","Landscape","Astrophotography","Portrait","Cars","Night","Other"].map(c=><Link className="category" href={`/explore?category=${encodeURIComponent(c)}`} key={c}><strong>{c}</strong></Link>)}</div>
    </div></section>

    <section className="section"><div className="container panel" style={{padding:"40px"}}>
      <div className="section-head"><div><div className="eyebrow">Gear match</div><h2>What camera do you need?</h2><p className="muted">Tell us your budget and shooting style, then compare compatible gear from the community database.</p></div><Link className="btn primary" href="/recommend">Start the finder</Link></div>
    </div></section>
  </>;
}