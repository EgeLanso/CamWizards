"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/types/database";

export function UploadForm() {
  const [media, setMedia] = useState<File | null>(null);
  const [camcorder, setCamcorder] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function toggleCategory(c: string) {
    setCategories(x => x.includes(c) ? x.filter(v => v !== c) : [...x, c]);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    const formElement = e.currentTarget;
    e.preventDefault();
    if (!media) return setMessage("Choose a photo or video first.");
    if (!categories.length) return setMessage("Choose at least one category.");
    setBusy(true); setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Please log in first."); setBusy(false); return; }

    const form = new FormData(formElement);
    const cameraName = String(form.get("camera") || "").trim();
    const lensName = camcorder ? null : String(form.get("lens") || "").trim() || null;
    if (!cameraName) { setMessage("Camera name is required."); setBusy(false); return; }

    const ext = media.name.split(".").pop()?.toLowerCase() || "bin";
    const mediaType = media.type.startsWith("video/") ? "video" : "photo";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const bucket = mediaType === "video" ? "videos" : "photos";

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, media, { upsert: false, contentType: media.type });
    if (uploadError) { setMessage(uploadError.message); setBusy(false); return; }

    const { data: camera, error: cameraError } = await supabase
      .from("cameras").upsert({ name: cameraName, is_camcorder: camcorder }, { onConflict: "name" }).select().single();
    if (cameraError) { setMessage(cameraError.message); setBusy(false); return; }

    let lensId: string | null = null;
    if (lensName) {
      const { data: lens, error: lensError } = await supabase
        .from("lenses").upsert({ name: lensName }, { onConflict: "name" }).select().single();
      if (lensError) { setMessage(lensError.message); setBusy(false); return; }
      lensId = lens.id;
    }

    const expiresAt = mediaType === "video" ? new Date(Date.now() + 10 * 86400000).toISOString() : null;
    const { data: created, error } = await supabase.from("uploads").insert({
      user_id: user.id,
      media_type: mediaType,
      storage_path: path,
      title: String(form.get("title") || "Untitled"),
      description: String(form.get("description") || "") || null,
      camera_id: camera.id,
      lens_id: lensId,
      camera_name: cameraName,
      lens_name: lensName,
      camera_price: form.get("price") ? Number(form.get("price")) : null,
      currency: String(form.get("currency") || "USD"),
      purchased_from: String(form.get("purchased_from") || "") || null,
      condition: String(form.get("condition") || "new"),
      expires_at: expiresAt
    }).select().single();

    if (error || !created) { setMessage(error?.message || "Could not save upload."); setBusy(false); return; }

    const rows = categories.map(category => ({ upload_id: created.id, category }));
    const { error: catError } = await supabase.from("upload_categories").insert(rows);
    if (catError) { setMessage(catError.message); setBusy(false); return; }

    setMessage("Upload published successfully.");
    formElement.reset();
    setCategories([]);
    setMedia(null);
    setBusy(false);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="full"><label className="label">Photo or video</label><input className="input" type="file" accept="image/*,video/*" onChange={e=>setMedia(e.target.files?.[0] || null)} /></div>
      <div><label className="label">Camera</label><input className="input" name="camera" placeholder="Sony A7 III" /></div>
      <div><label className="label">Camera type</label><label className="check"><input type="checkbox" checked={camcorder} onChange={e=>setCamcorder(e.target.checked)} /> Handycam / Camcorder</label></div>
      <div><label className="label">Lens {camcorder && "(not applicable)"}</label><input className="input" name="lens" placeholder="FE 50mm F1.8" disabled={camcorder} /></div>
      <div><label className="label">Price</label><input className="input" name="price" type="number" min="0" step="0.01" placeholder="999" /></div>
      <div><label className="label">Currency</label><select name="currency"><option>USD</option><option>EUR</option><option>GBP</option><option>TRY</option><option>JPY</option></select></div>
      <div><label className="label">Bought from</label><input className="input" name="purchased_from" placeholder="Store / marketplace" /></div>
      <div><label className="label">Condition</label><select name="condition"><option value="new">New</option><option value="used">Second-hand</option></select></div>
      <div className="full"><label className="label">Title</label><input className="input" name="title" placeholder="Rainy Tokyo crossing" required /></div>
      <div className="full"><label className="label">Description</label><textarea name="description" rows={5} placeholder="Tell people how the setup performed..." /></div>
      <div className="full"><label className="label">Categories</label><div className="check-grid">{CATEGORIES.map(c=><label className="check" key={c}><input type="checkbox" checked={categories.includes(c)} onChange={()=>toggleCategory(c)} />{c}</label>)}</div></div>
      <div className="full">
        <div className="notice">Videos automatically expire after 10 days. You can renew them from your profile before they expire.</div>
      </div>
      <div className="full"><button className="btn primary" disabled={busy}>{busy ? "Publishing..." : "Publish to CamWizards"}</button>{message && <p className={message.includes("success") ? "success" : "error"}>{message}</p>}</div>
    </form>
  );
}