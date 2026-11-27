import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";

const categories = ["Street","Wildlife","Animals","Architecture","Landscape","Astrophotography","Portrait","Cars","Night","Other"];

export default async function Home() {
  const supabase = await createClient();
  const { data: items } = await supabase.from("uploads")
    .select("id,user_id,media_type,storage_path,title,description,camera_name,lens_name,expires_at,created_at,camera_id,lens_id,camera_price,currency,purchased_from,condition")
    .eq("media_type", "photo")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false }).limit(8);
  const cards = (items || []).map(item => {
    const { data } = supabase.storage.from("photos").getPublicUrl(item.storage_path);
    return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} />;
  });

  return <>
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <div className="eyebrow">A living photography archive</div>
          <h1>Find the gear behind the photo.</h1>
          <p className="lead">Real photos, real camera setups, and honest experiences from photographers. Explore what people create with the gear they own.</p>
          <div className="hero-actions">
            <Link className="btn primary" href="/explore">Explore photos <span aria-hidden="true">↗</span></Link>
            <Link className="btn" href="/upload">Share your setup</Link>
          </div>
          <form className="search-box" action="/explore">
            <input className="input" name="q" aria-label="Search cameras, lenses and photos" placeholder="Search a camera, lens or photo..." />
            <button className="btn primary">Search</button>
          </form>
        </div>
        <div className="hero-visual">
          <img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1400&q=82" alt="Camera on a photographer's desk" fetchPriority="high" />
          <div className="hero-visual-caption">
            <strong>Made by photographers.</strong>
            <span>Discover the equipment behind every frame.</span>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="section-head">
          <div><div className="eyebrow">From the community</div><h2>Real photos. Real setups.</h2><p className="muted">Every example comes from a photographer's own upload.</p></div>
          <Link className="btn" href="/explore">View all photos ↗</Link>
        </div>
        {cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">The gallery is waiting for its first photos. Be the first to share your setup.</div>}
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="section-head"><div><div className="eyebrow">Explore by style</div><h2>What do you love shooting?</h2></div></div>
        <div className="category-grid">{categories.map(category => <Link className="category" href={`/explore?category=${encodeURIComponent(category)}`} key={category}>{category}</Link>)}</div>
      </div>
    </section>

    <section className="section">
      <div className="container panel">
        <div className="eyebrow">Find your next setup</div>
        <h2>Not sure which camera fits?</h2>
        <p className="lead">Compare community-reported prices and find gear that fits your budget and the way you shoot.</p>
        <Link className="btn primary" href="/recommend">Open camera finder ↗</Link>
      </div>
    </section>
  </>;
}