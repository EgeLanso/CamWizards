"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Camera = { id: string; name: string; brand: string | null; is_camcorder: boolean };
type PriceStat = { camera_id: string; currency: string; condition: string | null; lowest: number; count: number };

export default function CameraFinder({ cameras, priceStats }: { cameras: Camera[]; priceStats: PriceStat[] }) {
  const [budget, setBudget] = useState("1000");
  const [currency, setCurrency] = useState("TRY");
  const [type, setType] = useState("any");
  const [condition, setCondition] = useState("any");

  const results = useMemo(() => {
    const max = Number(budget);
    const hasBudget = Number.isFinite(max) && max > 0;
    const pricesByCamera = new Map<string, PriceStat[]>();
    for (const stat of priceStats) {
      if (stat.currency !== currency || (condition !== "any" && stat.condition !== condition)) continue;
      const current = pricesByCamera.get(stat.camera_id);
      if (current) current.push(stat);
      else pricesByCamera.set(stat.camera_id, [stat]);
    }

    return cameras.map(camera => {
      const reported = pricesByCamera.get(camera.id) || [];
      const lowest = reported.length ? Math.min(...reported.map(item => item.lowest)) : null;
      let score = 0;
      if (type === "video") score += camera.is_camcorder ? 4 : 0;
      if (type === "photo") score += camera.is_camcorder ? 0 : 4;
      if (hasBudget && lowest !== null) score += lowest <= max ? 5 : -5;
      if (reported.length) score += 1;
      return { ...camera, score, lowest, fits: hasBudget && lowest !== null && lowest <= max };
    }).filter(camera => !(hasBudget && camera.lowest !== null && camera.lowest > max))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [budget, cameras, condition, currency, priceStats, type]);

  const hasBudget = Number.isFinite(Number(budget)) && Number(budget) > 0;

  return (
    <section className="form-page">
      <div className="container">
        <div className="form-shell">
          <div className="eyebrow">Camera finder</div>
          <h1 style={{fontSize:"clamp(36px,5vw,58px)"}}>Find a camera that fits.</h1>
          <p className="lead" style={{fontSize:14}}>Set your budget and what you shoot. Results use prices shared by CamWizards members, not made-up market prices.</p>
          <div className="form-grid" style={{marginTop:24}}>
            <div><label className="label" htmlFor="budget">Maximum budget</label><input id="budget" className="input" type="number" min="0" value={budget} onChange={event=>setBudget(event.target.value)} /></div>
            <div><label className="label" htmlFor="currency">Currency</label><select id="currency" value={currency} onChange={event=>setCurrency(event.target.value)}><option value="TRY">TRY — Turkish lira</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound</option><option value="JPY">JPY — Yen</option></select></div>
            <div><label className="label" htmlFor="use">Main use</label><select id="use" value={type} onChange={event=>setType(event.target.value)}><option value="any">Photo or video</option><option value="photo">Photography</option><option value="video">Video / camcorder</option></select></div>
            <div><label className="label" htmlFor="condition">Condition</label><select id="condition" value={condition} onChange={event=>setCondition(event.target.value)}><option value="any">New or used</option><option value="new">New</option><option value="used">Second-hand</option></select></div>
          </div>
          <div className="section" style={{paddingBottom:0}}>
            <div className="section-head">
              <div><h2 style={{fontSize:25}}>Your matches</h2><p className="muted">{results.length} cameras shown · {hasBudget ? `Budget up to ${Number(budget).toLocaleString()} ${currency}` : "Set a budget to compare prices"}</p></div>
            </div>
            {results.length ? <div className="grid grid-3">{results.map(camera=><Link href={`/cameras/${camera.id}`} className="card" key={camera.id}><div className="card-body"><div className="eyebrow">{camera.brand || "Camera"}</div><h3 style={{marginTop:7}}>{camera.name}</h3><p className="muted">{camera.is_camcorder ? "Camcorder" : "Interchangeable-lens camera"}</p><p style={{fontSize:13,fontWeight:750}}>{camera.lowest !== null ? `Community prices from ${camera.lowest.toLocaleString()} ${currency}` : "No community price yet"}</p></div></Link>)}</div> : <div className="empty">No cameras match these filters yet. Try a different budget or condition.</div>}
            <p className="muted" style={{fontSize:11,marginTop:16}}>Community prices are user-submitted and may not reflect current store prices.</p>
          </div>
        </div>
      </div>
    </section>
  );
}