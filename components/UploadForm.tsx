"use client";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/types/database";

const MAX_PHOTOS = 10;
const MAX_VIDEOS = 1;
const MAX_PHOTO_MB = 10;
const MAX_VIDEO_MB = 50;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface FileItem extends File {
  preview?: string;
  cover?: boolean;
}

export function UploadForm() {
  const [photos, setPhotos] = useState<FileItem[]>([]);
  const [videos, setVideos] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [camcorder, setCamcorder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");

  useEffect(() => {
    const urls = [...photos, ...videos].map(file => file.type.startsWith("image/") ? (file.preview || URL.createObjectURL(file)) : "");
    return () => urls.forEach(url => { if (url && url.startsWith("blob:")) URL.revokeObjectURL(url); });
  }, [photos, videos]);

  function toggleCategory(category: string) {
    setCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category]);
  }

  function chooseFiles(list: FileList | null) {
    const files = Array.from(list || []);
    const newPhotos: FileItem[] = [];
    const newVideos: FileItem[] = [];
    for (const file of files) {
      const item: FileItem = { ...file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined };
      if (file.type.startsWith("video/")) newVideos.push(item);
      else newPhotos.push(item);
    }
    setPhotos(current => [...current, ...newPhotos].slice(0, MAX_PHOTOS));
    setVideos(current => [...current, ...newVideos].slice(0, MAX_VIDEOS));
    setMessage("");
  }

  function removePhoto(index: number) {
    setPhotos(current => current.filter((_, i) => i !== index));
  }
  function removeVideo(index: number) {
    setVideos(current => current.filter((_, i) => i !== index));
  }
  function setCover(index: number) {
    setPhotos(current => current.map((p, i) => ({ ...p, cover: i === index })));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const camera = String(form.get("camera") || "").trim();
    const lens = camcorder ? null : String(form.get("lens") || "").trim() || null;
    const price = form.get("price") ? Number(form.get("price")) : null;
    const currency = String(form.get("currency") || "USD").trim();
    const coverIndex = Number(form.get("cover_index") || "0");

    if (!title) return setMessage("Title is required.");
    if (!camera) return setMessage("Camera name is required.");
    if (!categories.length) return setMessage("Choose at least one category.");
    if (photos.length === 0 && videos.length === 0) return setMessage("Choose at least one photo or video.");
    if (photos.length > MAX_PHOTOS) return setMessage(`Maximum ${MAX_PHOTOS} photos.`);
    if (videos.length > MAX_VIDEOS) return setMessage(`Maximum ${MAX_VIDEOS} video.`);

    const allFiles = [...photos.map(f => ({ file: f, type: "photo" as const })), ...videos.map(f => ({ file: f, type: "video" as const }))];
    for (const { file } of allFiles) {
      if (file.size > MAX_FILE_SIZE) return setMessage(`${file.name} is too large (max 50MB).`);
      if (file.type.startsWith("image/") && !["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)) return setMessage(`Invalid image type: ${file.type}.`);
      if (file.type.startsWith("video/") && !["video/mp4","video/webm","video/quicktime"].includes(file.type)) return setMessage(`Invalid video type: ${file.type}.`);
    }

    setBusy(true); setMessage(""); setProgress("Uploading files...");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("camera", camera);
    formData.append("lens", lens || "");
    formData.append("price", price ? String(price) : "");
    formData.append("currency", currency);
    formData.append("category", categories.join(","));
    formData.append("cover_index", String(coverIndex));
    allFiles.forEach(({ file, type }, i) => formData.append(type === "photo" ? "photos" : "videos", file));

    try {
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setProgress("");
      setMessage("Post published successfully. It is pending moderation.");
      formElement.reset();
      setPhotos([]); setVideos([]); setCategories([]); setCamcorder(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const allCount = photos.length + videos.length;
  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="full">
        <label className="label">Photos and/or video</label>
        <input className="input" type="file" accept="image/*,video/*" multiple disabled={busy} onChange={event => chooseFiles(event.target.files)} />
        <div className="notice" style={{marginTop:8}}>Up to {MAX_PHOTOS} photos + {MAX_VIDEOS} video per post. Photos stay permanently; videos expire after 10 days.</div>
        {allCount > 0 && (
          <div className="file-preview-grid">
            {photos.map((file, i) => (
              <div className="file-preview" key={`${file.name}-${i}`} style={{position:"relative"}}>
                {file.preview ? <img src={file.preview} alt="" /> : <div className="file-video-preview">PHOTO</div>}
                <span title={file.name}>{file.name}</span>
                <button className="btn danger" onClick={() => removePhoto(i)} style={{position:"absolute",top:4,right:4,padding:4}}>×</button>
                {allCount > 1 && <button className="btn" onClick={() => setCover(i)} style={{position:"absolute",bottom:4,right:4,padding:4,fontSize:10}}>{file.cover ? "★ Cover" : "Cover"}</button>}
              </div>
            ))}
            {videos.map((file, i) => (
              <div className="file-preview" key={`video-${file.name}-${i}`} style={{position:"relative"}}>
                <div className="file-video-preview">VIDEO</div>
                <span title={file.name}>{file.name}</span>
                <button className="btn danger" onClick={() => removeVideo(i)} style={{position:"absolute",top:4,right:4,padding:4}}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div><label className="label">Camera</label><input className="input" name="camera" placeholder="Sony A7 III" required disabled={busy} /></div>
      <div><label className="label">Camera type</label><label className="check"><input type="checkbox" checked={camcorder} disabled={busy} onChange={event=>setCamcorder(event.target.checked)} /> Handycam / Camcorder</label></div>
      <div><label className="label">Lens {camcorder && "(not applicable)"}</label><input className="input" name="lens" placeholder="FE 50mm F1.8" disabled={camcorder || busy} /></div>
      <div><label className="label">Price</label><input className="input" name="price" type="number" min="0" step="0.01" placeholder="999" disabled={busy} /></div>
      <div><label className="label">Currency</label><select name="currency" disabled={busy}><option>TRY</option><option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option></select></div>
      <div className="full"><label className="label">Title</label><input className="input" name="title" placeholder="Rainy Tokyo crossing" required disabled={busy} /></div>
      <div className="full"><label className="label">Description</label><textarea name="description" rows={4} placeholder="Tell people how the setup performed..." disabled={busy} /></div>
      <div className="full"><label className="label">Categories</label><div className="check-grid">{CATEGORIES.map(category=><label className="check" key={category}><input type="checkbox" checked={categories.includes(category)} disabled={busy} onChange={()=>toggleCategory(category)} />{category}</label>)}</div></div>
      <div className="full"><div className="notice">Videos automatically expire after 10 days. Photos remain in the post.</div></div>
      <div className="full"><button className="btn primary" disabled={busy||allCount===0}>{busy ? "Publishing..." : "Publish to CamWizards"}</button>{progress && <p className="muted" aria-live="polite">{progress}</p>}{message && <p className={message.toLowerCase().includes("success") ? "success" : "error"} aria-live="polite">{message}</p>}</div>
    </form>
  );
}
