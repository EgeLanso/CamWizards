"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/types/database";

const MAX_PHOTO_MB = 10;
const MAX_VIDEO_MB = 50;

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
    const isVideo = media.type.startsWith("video/");
    const isPhoto = media.type.startsWith("image/");
    if (!isVideo && !isPhoto) return setMessage("Only photo and video files can be uploaded.");
    const limitMb = isVideo ? MAX_VIDEO_MB : MAX_PHOTO_MB;
    if (media.size > limitMb * 1024 * 1024) return setMessage(`${isVideo ? "Videos" : "Photos"} can be at most ${limitMb} MB.`);

    const form = new FormData(formElement);
    const cameraName = String(form.get("camera") || "").trim();
    const lensName = camcorder ? null : String(form.get("lens") || "").trim() || null;
    if (!cameraName) return setMessage("Camera name is required.");

    setBusy(true); setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Please log in first."); setBusy(false); return; }

    const mediaType = isVideo ? "video" : "photo";
    const bucket = isVideo ? "videos" : "photos";
    const ext = (media.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    // Gear records are shared, so they are looked up first and only inserted when missing.
    async function findOrCreate(table: "cameras" | "lenses", name: string, extra: Record<string, unknown> = {}) {
      const find = () => supabase.from(table).select("id").eq("name", name).maybeSingle();
      const { data: found } = await find();
      if (found) return { id: found.id as string, error: null as string | null };
      const { data: created, error } = await supabase.from(table).insert({ name, ...extra }).select("id").single();
      if (created) return { id: created.id as string, error: null };
      if (error?.code === "23505") { // someone else added it a moment ago
        const { data: again } = await find();
        if (again) return { id: again.id as string, error: null };
      }
      return { id: null, error: error?.message || "Could not save gear." };
    }

    const camera = await findOrCreate("cameras", cameraName, { is_camcorder: camcorder });
    if (!camera.id) { setMessage(camera.error!); setBusy(false); return; }

    let lensId: string | null = null;
    if (lensName) {
      const lens = await findOrCreate("lenses", lensName);
      if (!lens.id) { setMessage(lens.error!); setBusy(false); return; }
      lensId = lens.id;
    }

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, media, { upsert: false, contentType: media.type });
    if (uploadError) { setMessage(uploadError.message); setBusy(false); return; }

    // From here on, a failure removes what was already stored so no orphaned files or half-published uploads remain.
    const rollback = async (uploadId?: string) => {
      if (uploadId) await supabase.from("uploads").delete().eq("id", uploadId);
      await supabase.storage.from(bucket).remove([path]);
    };

    const price = form.get("price") ? Number(form.get("price")) : null;
    const expiresAt = mediaType === "video" ? new Date(Date.now() + 10 * 86400000).toISOString() : null;
    const { data: created, error } = await supabase.from("uploads").insert({
      user_id: user.id,
      media_type: mediaType,
      storage_path: path,
      title: String(form.get("title") || "").trim() || "Untitled",
      description: String(form.get("description") || "").trim() || null,
      camera_id: camera.id,
      lens_id: lensId,
      camera_name: cameraName,
      lens_name: lensName,
      camera_price: price !== null && Number.isFinite(price) && price >= 0 ? price : null,
      currency: String(form.get("currency") || "USD"),
      purchased_from: String(form.get("purchased_from") || "").trim() || null,
      condition: String(form.get("condition") || "new"),
      expires_at: expiresAt
    }).select("id").single();

    if (error || !created) { await rollback(); setMessage(error?.message || "Could not save upload."); setBusy(false); return; }

    const rows = categories.map(category => ({ upload_id: created.id, category }));
    const { error: catError } = await supabase.from("upload_categories").insert(rows);
    if (catError) { await rollback(created.id); setMessage(catError.message); setBusy(false); return; }

    setMessage("Upload published successfully.");
    formElement.reset();
    setCategories([]);
    setMedia(null);
    setCamcorder(false);
    setBusy(false);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="full"><label className="label">Photo or video</label><input className="input" type="file" accept="image/*,video/*" onChange={e=>setMedia(e.target.files?.[0] || null)} /></div>
      <div><label className="label">Camera</label><input className="input" name="camera" placeholder="Sony A7 III" required /></div>
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
        <div className="notice">Photos can be up to {MAX_PHOTO_MB} MB, videos up to {MAX_VIDEO_MB} MB. Videos automatically expire after 10 days. You can renew them from your profile before they expire.</div>
      </div>
      <div className="full"><button className="btn primary" disabled={busy}>{busy ? "Publishing..." : "Publish to CamWizards"}</button>{message && <p className={message.includes("success") ? "success" : "error"}>{message}</p>}</div>
    </form>
  );
}
