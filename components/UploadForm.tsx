"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/types/database";

const MAX_PHOTO_MB = 10;
const MAX_VIDEO_MB = 50;
const MAX_PHOTOS = 10;

export function UploadForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [camcorder, setCamcorder] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function toggleCategory(c: string) {
    setCategories(x => x.includes(c) ? x.filter(v => v !== c) : [...x, c]);
  }

  function chooseFiles(list: FileList | null) {
    const selected = Array.from(list || []);
    setFiles(selected);
    setMessage("");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    const formElement = e.currentTarget;
    e.preventDefault();
    if (!files.length) return setMessage("Choose at least one photo or one video.");
    if (!categories.length) return setMessage("Choose at least one category.");

    const isVideo = files[0].type.startsWith("video/");
    const validSet = files.every(file => isVideo ? file.type.startsWith("video/") : file.type.startsWith("image/"));
    if (!validSet) return setMessage("Upload photos together, or upload one video separately.");
    if (isVideo && files.length !== 1) return setMessage("Only one video can be uploaded per post.");
    if (!isVideo && files.length > MAX_PHOTOS) return setMessage(`You can upload up to ${MAX_PHOTOS} photos per post.`);

    const limitMb = isVideo ? MAX_VIDEO_MB : MAX_PHOTO_MB;
    const oversized = files.find(file => file.size > limitMb * 1024 * 1024);
    if (oversized) return setMessage(`${oversized.name} is larger than the ${limitMb} MB limit.`);

    const form = new FormData(formElement);
    const cameraName = String(form.get("camera") || "").trim();
    const lensName = camcorder ? null : String(form.get("lens") || "").trim() || null;
    if (!cameraName) return setMessage("Camera name is required.");

    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Please log in first."); setBusy(false); return; }

    const mediaType = isVideo ? "video" : "photo";
    const bucket = isVideo ? "videos" : "photos";
    const paths = files.map(file => {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      return `${user.id}/${crypto.randomUUID()}.${ext}`;
    });

    async function findOrCreate(table: "cameras" | "lenses", name: string, extra: Record<string, unknown> = {}) {
      const find = () => supabase.from(table).select("id").eq("name", name).maybeSingle();
      const { data: found } = await find();
      if (found) return { id: found.id as string, error: null as string | null };
      const { data: created, error } = await supabase.from(table).insert({ name, ...extra }).select("id").single();
      if (created) return { id: created.id as string, error: null };
      if (error?.code === "23505") {
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

    const uploadedPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const { error: uploadError } = await supabase.storage.from(bucket).upload(paths[i], files[i], { upsert: false, contentType: files[i].type });
      if (uploadError) {
        if (uploadedPaths.length) await supabase.storage.from(bucket).remove(uploadedPaths);
        setMessage(uploadError.message);
        setBusy(false);
        return;
      }
      uploadedPaths.push(paths[i]);
    }

    const rollback = async (uploadId?: string) => {
      if (uploadId) await supabase.from("uploads").delete().eq("id", uploadId);
      await supabase.storage.from(bucket).remove(uploadedPaths);
    };

    const price = form.get("price") ? Number(form.get("price")) : null;
    const expiresAt = mediaType === "video" ? new Date(Date.now() + 10 * 86400000).toISOString() : null;
    const { data: created, error } = await supabase.from("uploads").insert({
      user_id: user.id,
      media_type: mediaType,
      storage_path: paths[0],
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

    if (error || !created) {
      await rollback();
      setMessage(error?.message || "Could not save upload.");
      setBusy(false);
      return;
    }

    if (mediaType === "photo") {
      const mediaRows = paths.map((storage_path, sort_order) => ({ upload_id: created.id, storage_path, sort_order }));
      const { error: mediaError } = await supabase.from("upload_media").insert(mediaRows);
      if (mediaError) {
        await rollback(created.id);
        setMessage(mediaError.message);
        setBusy(false);
        return;
      }
    }

    const rows = categories.map(category => ({ upload_id: created.id, category }));
    const { error: catError } = await supabase.from("upload_categories").insert(rows);
    if (catError) {
      await rollback(created.id);
      setMessage(catError.message);
      setBusy(false);
      return;
    }

    setMessage("Upload published successfully.");
    formElement.reset();
    setFiles([]);
    setCategories([]);
    setCamcorder(false);
    setBusy(false);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="full">
        <label className="label">Photos or video</label>
        <input className="input" type="file" accept="image/*,video/*" multiple onChange={e => chooseFiles(e.target.files)} />
        <div className="notice" style={{marginTop:8}}>Select up to {MAX_PHOTOS} photos for one gallery, or one video. Each photo can be up to {MAX_PHOTO_MB} MB; videos can be up to {MAX_VIDEO_MB} MB.</div>
        {files.length > 0 && <div className="meta" style={{marginTop:8}}>{files.length} file(s) selected: {files.map(file => file.name).join(", ")}</div>}
      </div>
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
        <div className="notice">Videos automatically expire after 10 days. You can renew them from your profile before they expire.</div>
      </div>
      <div className="full"><button className="btn primary" disabled={busy}>{busy ? "Publishing..." : "Publish to CamWizards"}</button>{message && <p className={message.includes("success") ? "success" : "error"}>{message}</p>}</div>
    </form>
  );
}
