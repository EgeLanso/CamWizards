"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/types/database";
import { uiText } from "@/lib/i18n";
import type { Locale } from "@/lib/ranks";

const MAX_PHOTO_MB = 10;
const MAX_VIDEO_MB = 50;
const MAX_PHOTOS = 10;

type UploadJob = { file: File; path: string; bucket: "photos" | "videos"; mediaType: "photo" | "video"; expiresAt: string | null };

export function UploadForm({ locale = "en" }: { locale?: Locale }) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [camcorder, setCamcorder] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const t = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);

  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);

  function toggleCategory(category: string) {
    setCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category]);
  }

  function chooseFiles(list: FileList | null) {
    setFiles(Array.from(list || []));
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    const formElement = event.currentTarget;
    event.preventDefault();
    if (busy) return;
    if (!files.length) return setMessage(t("chooseFiles"));
    if (!categories.length) return setMessage(t("chooseCategory"));

    const photoFiles = files.filter(file => file.type.startsWith("image/"));
    const videoFiles = files.filter(file => file.type.startsWith("video/"));
    const invalidFiles = files.filter(file => !file.type.startsWith("image/") && !file.type.startsWith("video/"));
    if (invalidFiles.length) return setMessage("Only image and video files are supported.");
    if (photoFiles.length > MAX_PHOTOS) return setMessage("You can upload up to " + MAX_PHOTOS + " photos per post.");
    if (videoFiles.length > 1) return setMessage("You can upload one video per post.");
    const oversizedPhoto = photoFiles.find(file => file.size > MAX_PHOTO_MB * 1024 * 1024);
    if (oversizedPhoto) return setMessage(oversizedPhoto.name + " is larger than " + MAX_PHOTO_MB + " MB.");
    const oversizedVideo = videoFiles.find(file => file.size > MAX_VIDEO_MB * 1024 * 1024);
    if (oversizedVideo) return setMessage(oversizedVideo.name + " is larger than " + MAX_VIDEO_MB + " MB.");

    const form = new FormData(formElement);
    const cameraName = String(form.get("camera") || "").trim();
    const lensName = camcorder ? null : String(form.get("lens") || "").trim() || null;
    if (!cameraName) return setMessage(t("cameraRequired"));

    setBusy(true);
    setMessage("");
    setProgress("Preparing upload...");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Please log in first."); setBusy(false); setProgress(""); return; }

    async function findOrCreate(table: "cameras" | "lenses", name: string, extra: Record<string, unknown> = {}) {
      const find = () => supabase.from(table).select("id").eq("name", name).maybeSingle();
      const { data: found } = await find();
      if (found) return { id: found.id as string, error: null as string | null };
      const { data: created, error } = await supabase.from(table).insert({ name, ...extra }).select("id").single();
      if (created) return { id: created.id as string, error: null as string | null };
      if (error?.code === "23505") {
        const { data: again } = await find();
        if (again) return { id: again.id as string, error: null as string | null };
      }
      return { id: null, error: error?.message || "Could not save gear." };
    }

    const camera = await findOrCreate("cameras", cameraName, { is_camcorder: camcorder });
    if (!camera.id) { setMessage(camera.error!); setBusy(false); setProgress(""); return; }

    let lensId: string | null = null;
    if (lensName) {
      const lens = await findOrCreate("lenses", lensName);
      if (!lens.id) { setMessage(lens.error!); setBusy(false); setProgress(""); return; }
      lensId = lens.id;
    }

    const videoExpiry = videoFiles.length ? new Date(Date.now() + 10 * 86400000).toISOString() : null;
    const jobs: UploadJob[] = files.map(file => {
      const isVideo = file.type.startsWith("video/");
      const extension = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      return {
        file,
        path: user.id + "/" + crypto.randomUUID() + "." + extension,
        bucket: isVideo ? "videos" : "photos",
        mediaType: isVideo ? "video" : "photo",
        expiresAt: isVideo ? videoExpiry : null
      };
    });
    const photoJobs = jobs.filter(job => job.mediaType === "photo");
    const videoJobs = jobs.filter(job => job.mediaType === "video");
    let uploaded: UploadJob[] = [];

    const removeUploaded = async () => {
      await Promise.all((["photos", "videos"] as const).map(async bucket => {
        const paths = uploaded.filter(job => job.bucket === bucket).map(job => job.path);
        if (paths.length) await supabase.storage.from(bucket).remove(paths);
      }));
      uploaded = [];
    };

    const uploadOne = async (job: UploadJob) => {
      const { error } = await supabase.storage.from(job.bucket).upload(job.path, job.file, {
        upsert: false, contentType: job.file.type, cacheControl: "3600"
      });
      if (error) throw new Error(error.message);
      uploaded.push(job);
    };

    try {
      setProgress("Uploading photos and video...");
      const firstAttempt = await Promise.allSettled(jobs.map(uploadOne));
      const failedFirstAttempt = firstAttempt.some(result => result.status === "rejected");
      if (failedFirstAttempt) {
        await removeUploaded();
        setProgress("Retrying sequentially: photos first, then video...");
        for (const job of [...photoJobs, ...videoJobs]) await uploadOne(job);
      }
    } catch (error) {
      await removeUploaded();
      setMessage(error instanceof Error ? error.message : t("uploadFailed"));
      setBusy(false); setProgress("");
      return;
    }

    const rollback = async (uploadId?: string) => {
      if (uploadId) await supabase.from("uploads").delete().eq("id", uploadId);
      await removeUploaded();
    };

    const price = form.get("price") ? Number(form.get("price")) : null;
    const hasPhotos = photoJobs.length > 0;
    const cover = hasPhotos ? photoJobs[0] : videoJobs[0];
    const postMediaType = hasPhotos ? "photo" : "video";
    const postExpiry = !hasPhotos && videoFiles.length ? videoExpiry : null;

    setProgress("Saving post details...");
    const { data: created, error } = await supabase.from("uploads").insert({
      user_id: user.id,
      media_type: postMediaType,
      storage_path: cover.path,
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
      expires_at: postExpiry
    }).select("id").single();

    if (error || !created) {
      await rollback();
      setMessage(error?.message || "Could not save upload.");
      setBusy(false); setProgress("");
      return;
    }

    const mediaRows = jobs.map((job, index) => ({
      upload_id: created.id,
      storage_path: job.path,
      media_type: job.mediaType,
      expires_at: job.expiresAt,
      sort_order: index
    }));
    const { error: mediaError } = await supabase.from("upload_media").insert(mediaRows);
    if (mediaError) {
      await rollback(created.id);
      setMessage(mediaError.message);
      setBusy(false); setProgress("");
      return;
    }

    const categoryRows = categories.map(category => ({ upload_id: created.id, category }));
    const { error: categoryError } = await supabase.from("upload_categories").insert(categoryRows);
    if (categoryError) {
      await rollback(created.id);
      setMessage(categoryError.message);
      setBusy(false); setProgress("");
      return;
    }

    setProgress(t("uploadReview"));
    let finalMessage = t("uploadDone");
    try {
      const response = await fetch("/api/moderation/review-upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: created.id })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Review request failed.");
      finalMessage = result.message || finalMessage;
    } catch (error) {
      finalMessage = error instanceof Error
        ? "Upload saved, but name review could not complete: " + error.message
        : t("uploadDone");
    }

    setMessage(finalMessage);
    setProgress("");
    formElement.reset();
    setFiles([]);
    setCategories([]);
    setCamcorder(false);
    setBusy(false);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="full">
        <label className="label">{t("mediaFiles")}</label>
        <input className="input" type="file" accept="image/*,video/*" multiple disabled={busy} onChange={event => chooseFiles(event.target.files)} />
        <div className="notice" style={{ marginTop: 8 }}>{t("mediaHelp")}</div>
        {files.length > 0 && <div className="file-preview-grid">{files.map((file,index) => <div className="file-preview" key={file.name + "-" + file.lastModified + "-" + index}>
          {file.type.startsWith("image/") ? <img src={previews[index]} alt="" /> : <video src={previews[index]} muted playsInline preload="metadata" />}
          <span title={file.name}>{file.name}</span>
        </div>)}</div>}
      </div>
      <div><label className="label">{t("camera")}</label><input className="input" name="camera" placeholder="Sony A7 III" required disabled={busy} /></div>
      <div><label className="label">{t("cameraType")}</label><label className="check"><input type="checkbox" checked={camcorder} disabled={busy} onChange={event => setCamcorder(event.target.checked)} /> {t("camcorder")}</label></div>
      <div><label className="label">{t("lens")} {camcorder && "(not applicable)"}</label><input className="input" name="lens" placeholder="FE 50mm F1.8" disabled={camcorder || busy} /></div>
      <div><label className="label">{t("price")}</label><input className="input" name="price" type="number" min="0" step="0.01" placeholder="999" disabled={busy} /></div>
      <div><label className="label">{t("currency")}</label><select name="currency" disabled={busy}><option>TRY</option><option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option></select></div>
      <div><label className="label">{t("boughtFrom")}</label><input className="input" name="purchased_from" placeholder="Store / marketplace" disabled={busy} /></div>
      <div><label className="label">{t("condition")}</label><select name="condition" disabled={busy}><option value="new">{t("newItem")}</option><option value="used">{t("usedItem")}</option></select></div>
      <div className="full"><label className="label">{t("postTitle")}</label><input className="input" name="title" placeholder="Rainy Tokyo crossing" required disabled={busy} /></div>
      <div className="full"><label className="label">{t("description")}</label><textarea name="description" rows={4} placeholder="Tell people how the setup performed..." disabled={busy} /></div>
      <div className="full"><label className="label">{t("categories")}</label><div className="check-grid">{CATEGORIES.map(category => <label className="check" key={category}><input type="checkbox" checked={categories.includes(category)} disabled={busy} onChange={() => toggleCategory(category)} />{category}</label>)}</div></div>
      <div className="full"><div className="notice">{t("videoExpiry")}</div></div>
      <div className="full"><button className="btn primary" disabled={busy}>{busy ? t("publishing") : t("publishPost")}</button>{progress && <p className="muted" aria-live="polite">{progress}</p>}{message && <p className="notice" aria-live="polite">{message}</p>}</div>
    </form>
  );
}
