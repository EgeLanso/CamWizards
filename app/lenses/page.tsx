import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Lenses({ searchParams }: { searchParams: Promise<{q?:string}> }) {
  const { q = "" } = await searchParams;
  const safeQ = q.replace(/[,()%*\\_:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const supabase = await createClient();
  let query = supabase.from("lenses").select("id,name,brand").order("name").limit(100);
  if (safeQ) query = query.or(`name.ilike.%${safeQ}%,brand.ilike.%${safeQ}%`);
  const { data } = await query;
  return <section className="section"><div className="container">
    <div className="eyebrow">Gear directory</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>Lenses.</h1>
    <p className="lead">Find lenses and explore the community photos captured with them.</p>
    <form className="search-box" action="/lenses"><input className="input" name="q" defaultValue={q} placeholder="Search lens brand or model..." aria-label="Search lenses"/><button className="btn primary">Search</button></form>
    <p className="muted" style={{fontSize:12,margin:"18px 0"}}>{data?.length || 0} lenses shown · maximum 100 per search</p>
    {data?.length ? <div className="grid grid-4">{data.map(lens=><Link className="card" href={`/lenses/${lens.id}`} key={lens.id}><div className="card-body"><div className="eyebrow">{lens.brand || "Lens"}</div><h3 style={{marginTop:7}}>{lens.name}</h3></div></Link>)}</div> : <div className="empty">No lenses found. Try another search.</div>}
  </div></section>;
}