"use client";
import { useState } from "react";

export default function LikeButton({uploadId,initialCount,initialLiked,locale="en"}:{uploadId:string;initialCount:number;initialLiked:boolean;locale?:string}) {
  const [count,setCount]=useState(initialCount);
  const [liked,setLiked]=useState(initialLiked);
  const [busy,setBusy]=useState(false);
  async function toggle() {
    if (busy) return;
    setBusy(true);
    const response=await fetch("/api/likes",{method:liked?"DELETE":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({uploadId})});
    if (response.status===401) { window.location.href="/login"; return; }
    const data=await response.json().catch(()=>null);
    if (response.ok) { setLiked(Boolean(data?.liked)); setCount(Number(data?.count ?? count)); }
    setBusy(false);
  }
  const text=locale==="tr" ? "Beğen" : locale==="ru" ? "Нравится" : locale==="de" ? "Gefällt mir" : locale==="es" ? "Me gusta" : locale==="fr" ? "J'aime" : "Like";
  return <button className="btn" type="button" onClick={toggle} disabled={busy} aria-pressed={liked}>♥ {count} · {text}</button>;
}
