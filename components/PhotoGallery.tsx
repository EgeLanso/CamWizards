"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type GalleryImage = { path: string; url: string };

export default function PhotoGallery({
  uploadId,
  images,
  initialThumbnail
}: {
  uploadId: string;
  images: GalleryImage[];
  initialThumbnail: string;
}) {
  const initialIndex = Math.max(0, images.findIndex(image => image.path === initialThumbnail));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [thumbnailPath, setThumbnailPath] = useState(initialThumbnail);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex(index => (index + 1) % images.length);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex(index => (index - 1 + images.length) % images.length);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [images.length]);

  if (!images.length) return null;
  const active = images[activeIndex] || images[0];
  const isThumbnail = active.path === thumbnailPath;

  async function setAsThumbnail() {
    if (isThumbnail || saving) return;
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("uploads").update({ storage_path: active.path }).eq("id", uploadId);
    if (error) {
      setMessage(error.message);
    } else {
      setThumbnailPath(active.path);
      setMessage("Cover photo updated.");
    }
    setSaving(false);
  }

  return (
    <div>
      <div style={{position:"relative"}}>
        <img
          className="detail-media"
          src={active.url}
          alt={`Photo ${activeIndex + 1}`}
          style={{display:"block",width:"100%",maxHeight:680,objectFit:"contain",background:"#080808"}}
        />
        {images.length > 1 && <>
          <button type="button" aria-label="Previous photo" onClick={() => setActiveIndex(index => (index - 1 + images.length) % images.length)} style={arrowStyle("left")}>‹</button>
          <button type="button" aria-label="Next photo" onClick={() => setActiveIndex(index => (index + 1) % images.length)} style={arrowStyle("right")}>›</button>
          <span style={{position:"absolute",right:12,bottom:12,background:"rgba(0,0,0,.72)",color:"white",padding:"6px 10px",borderRadius:20,fontSize:13}}>{activeIndex + 1} / {images.length}</span>
        </>}
      </div>
      {images.length > 1 && <div style={{display:"flex",gap:8,overflowX:"auto",padding:"12px 2px"}}>
        {images.map((image,index) => (
          <button
            type="button"
            key={image.path}
            onClick={() => setActiveIndex(index)}
            aria-label={`Show photo ${index + 1}`}
            aria-pressed={index === activeIndex}
            style={{position:"relative",flex:"0 0 82px",height:64,padding:0,border:index === activeIndex ? "2px solid var(--accent)" : "2px solid transparent",borderRadius:8,overflow:"hidden",background:"#111",cursor:"pointer"}}
          >
            <img src={image.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
            {image.path === thumbnailPath && <span style={{position:"absolute",left:3,bottom:3,fontSize:9,fontWeight:800,color:"#fff",background:"rgba(0,0,0,.75)",padding:"2px 4px",borderRadius:4}}>COVER</span>}
          </button>
        ))}
      </div>}
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginTop:8}}>
        <button type="button" className="btn" onClick={setAsThumbnail} disabled={isThumbnail || saving}>
          {saving ? "Saving..." : isThumbnail ? "Current cover photo" : "Set as cover photo"}
        </button>
        <span className="muted" style={{fontSize:12}}>Use ← and → keys to browse photos.</span>
      </div>
      {message && <p className={message.includes("updated") ? "success" : "error"}>{message}</p>}
    </div>
  );
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position:"absolute",top:"50%",[side]:10,transform:"translateY(-50%)",
    width:42,height:42,border:0,borderRadius:999,background:"rgba(0,0,0,.68)",
    color:"white",fontSize:30,lineHeight:1,cursor:"pointer"
  };
}
