"use client";
import { useState } from "react";
import { uiText } from "@/lib/i18n";
import type { Locale } from "@/lib/ranks";

export default function LikeButton({
  uploadId,initialCount,initialLiked,locale="en"
}:{
  uploadId:string;initialCount:number;initialLiked:boolean;locale?:Locale
}) {
  const [count,setCount]=useState(initialCount);
  const [liked,setLiked]=useState(initialLiked);
  const [busy,setBusy]=useState(false);
  const t=(key:Parameters<typeof uiText>[1])=>uiText(locale,key);

  async function toggle() {
    if(busy)return;
    setBusy(true);
    try {
      const response=await fetch("/api/likes",{
        method:liked?"DELETE":"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({uploadId})
      });
      if(response.status===401){window.location.href="/login";return;}
      const data=await response.json().catch(()=>null);
      if(response.ok){setLiked(Boolean(data?.liked));setCount(Number(data?.count??count));}
    } finally { setBusy(false); }
  }
  return <button className="btn" type="button" onClick={toggle} disabled={busy} aria-pressed={liked}>
    ♥ {count} · {t("likes")}
  </button>;
}
