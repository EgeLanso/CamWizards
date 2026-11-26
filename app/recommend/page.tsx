"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Cam = { id: string; name: string; brand: string | null; is_camcorder: boolean };
type Price = { camera_id: string; camera_price: number; currency: string | null; condition: string | null };

export default function Recommend() {
  const [budget, setBudget] = useState("1000");
  const [currency, setCurrency] = useState("USD");
  const [type, setType] = useState("any");
  const [condition, setCondition] = useState("any");
  const [cams, setCams] = useState<Cam[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);

  useEffect(() => {
    const s = createClient();
    s.from("cameras").select("*").order("name").then(({ data }) => setCams(data || []));
    s.from("uploads").select("camera_id,camera_price,currency,condition").not("camera_price", "is", null).then(({ data }) => setPrices((data as Price[]) || []));
  }, []);

  const max = Number(budget);
  const hasBudget = Number.isFinite(max) && max > 0;

  const scored = cams.map(c => {
    // Only prices that uploaders reported in the chosen currency (and condition, if chosen) are compared.
    const own = prices.filter(p => p.camera_id === c.id && (p.currency || "USD") === currency && (condition === "any" || p.condition === condition));
    const lowest = own.length ? Math.min(...own.map(p => Number(p.camera_price))) : null;
    let score = 0;
    if (type === "video") score += c.is_camcorder ? 4 : 0;
    if (type === "photo") score += c.is_camcorder ? 0 : 4;
    if (hasBudget && lowest !== null) score += lowest <= max ? 5 : -5;
    if (own.length) score += 1;
    return { ...c, score, lowest, fits: hasBudget && lowest !== null && lowest <= max };
  }).filter(c => !(hasBudget && c.lowest !== null && c.lowest > max))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 8);

  return <section className="form-page"><div className="container"><div className="form-shell">
    <div className="eyebrow">Gear finder</div><h2>What camera do you need?</h2>
    <p className="lead" style={{fontSize:15}}>Recommendations use the cameras and prices reported by the community. As more photographers upload, the matching gets better.</p>
    <div className="form-grid">
      <div><label className="label">Budget</label><input className="input" type="number" min="0" value={budget} onChange={e=>setBudget(e.target.value)}/></div>
      <div><label className="label">Currency</label><select value={currency} onChange={e=>setCurrency(e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>TRY</option><option>JPY</option></select></div>
      <div><label className="label">Main use</label><select value={type} onChange={e=>setType(e.target.value)}><option value="any">Anything</option><option value="photo">Photography</option><option value="video">Video</option></select></div>
      <div><label className="label">Condition</label><select value={condition} onChange={e=>setCondition(e.target.value)}><option value="any">New or used</option><option value="new">New</option><option value="used">Used</option></select></div>
    </div>
    <div className="section"><h3>Matches</h3>
      <p className="muted">Budget: {hasBudget ? `${max} ${currency}` : "not set"}. Cameras with no reported price in {currency} are still listed, but cannot be checked against your budget.</p>
      {scored.length ? <div className="grid grid-3">{scored.map(c=><Link href={`/cameras/${c.id}`} className="card" key={c.id}><div className="card-body"><div className="eyebrow">{c.brand||"Camera"}</div><h3>{c.name}</h3><p className="muted">{c.is_camcorder?"Camcorder":"Interchangeable-lens camera"}</p>{c.lowest!==null&&<p className="muted">From {c.lowest} {currency} (community reported)</p>}</div></Link>)}</div> : <div className="empty">No cameras match yet.</div>}
    </div>
  </div></div></section>;
}
