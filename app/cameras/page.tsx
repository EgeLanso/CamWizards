import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Cameras({ searchParams }: { searchParams: Promise<{q?:string}> }) {
  const { q = "" } = await searchParams;
  const safeQ = q.replace(/[,()%*\\_:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const supabase = await createClient();
  let query = supabase.from("cameras").select("id,name,brand,is_camcorder").order("name").limit(100);
  if (safeQ) query = query.or(`name.ilike.%${safeQ}%,brand.ilike.%${safeQ}%`);
  const { data } = await query;
  return <section className="section"><div className="container">
    <div className="eyebrow">Gear directory</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>Cameras.</h1>
    <p className="lead">Browse camera models and see real photos made with each one.</p>
    <form className="search-box" action="/cameras"><input className="input" name="q" defaultValue={q} placeholder="Search camera brand or model..." aria-label="Search cameras"/><button className="btn primary">Search</button></form>
    <p className="muted" style={{fontSize:12,margin:"18px 0"}}>{data?.length || 0} cameras shown · maximum 100 per search</p>
    {data?.length ? <div className="grid grid-4">{data.map(camera=><Link className="card" href={`/cameras/${camera.id}`} key={camera.id}><div className="card-body"><div className="eyebrow">{camera.brand || "Camera"}</div><h3 style={{marginTop:7}}>{camera.name}</h3><p className="muted">{camera.is_camcorder ? "Camcorder" : "Camera"}</p></div></Link>)}</div> : <div className="empty">No cameras found. Try another search.</div>}
  </div></section>;
}