import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_PHOTOS = 10;
const MAX_VIDEOS = 1;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

async function uploadFile(admin: any, bucket: string, path: string, file: File): Promise<{ error: string | null }> {
  const arrayBuffer = await file.arrayBuffer();
  const { error } = await admin.storage.from(bucket).upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: false
  });
  return { error: error?.message || null };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });

  const admin = createAdminClient();
  const formData = await request.formData();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const camera = String(formData.get("camera") || "").trim();
  const lens = String(formData.get("lens") || "").trim();
  const price = formData.get("price") ? Number(formData.get("price")) : null;
  const currency = String(formData.get("currency") || "USD").trim();
  const category = String(formData.get("category") || "Other").trim();

  if (!title || title.length > 200) {
    return NextResponse.json({ error: "Title is required (max 200 chars)." }, { status: 400 });
  }

  const photoFiles: File[] = [];
  const videoFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "photos" && value instanceof File) photoFiles.push(value);
    if (key === "videos" && value instanceof File) videoFiles.push(value);
  }

  if (photoFiles.length === 0 && videoFiles.length === 0) {
    return NextResponse.json({ error: "At least one photo or video is required." }, { status: 400 });
  }
  if (photoFiles.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `Maximum ${MAX_PHOTOS} photos allowed.` }, { status: 400 });
  }
  if (videoFiles.length > MAX_VIDEOS) {
    return NextResponse.json({ error: `Maximum ${MAX_VIDEOS} video allowed.` }, { status: 400 });
  }

  const allFiles = [...photoFiles.map(f => ({ file: f, type: "photo" })), ...videoFiles.map(f => ({ file: f, type: "video" }))];
  for (const { file } of allFiles) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File ${file.name} is too large (max 50MB).` }, { status: 400 });
    }
    if (file.type.startsWith("image/") && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Invalid image type: ${file.type}.` }, { status: 400 });
    }
    if (file.type.startsWith("video/") && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Invalid video type: ${file.type}.` }, { status: 400 });
    }
  }

  // Create upload record first
  const expiresAt = videoFiles.length > 0 ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() : null;
  const { data: upload, error: uploadError } = await admin.from("uploads").insert({
    user_id: user.id,
    title,
    description,
    camera_name: camera || null,
    lens_name: lens || null,
    price,
    currency,
    category,
    media_count: allFiles.length,
    expires_at: expiresAt,
    moderation_status: "pending"
  }).select().single();
  if (uploadError || !upload) {
    return NextResponse.json({ error: uploadError?.message || "Could not create upload record." }, { status: 500 });
  }

  // Upload files in parallel
  const uploadResults = await Promise.allSettled(allFiles.map(async ({ file, type }, index) => {
    const bucket = type === "video" ? "videos" : "photos";
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `uploads/${user.id}/${upload.id}/${index + 1}.${ext}`;
    const { error } = await uploadFile(admin, bucket, path, file);
    if (error) return { index, type, path, error };
    return { index, type, path, error: null };
  }));

  const failed = uploadResults.filter(r => r.status === "rejected" || (r.status === "fulfilled" && r.value.error));
  if (failed.length > 0) {
    // Cleanup: delete upload record and any successfully uploaded files
    await admin.from("uploads").delete().eq("id", upload.id);
    for (const r of uploadResults) {
      if (r.status === "fulfilled" && !r.value.error) {
        const bucket = r.value.type === "video" ? "videos" : "photos";
        await admin.storage.from(bucket).remove([r.value.path]);
      }
    }
    return NextResponse.json({ error: "Some files failed to upload. The post was not created." }, { status: 500 });
  }

  // Insert upload_media records
  const mediaRecords = uploadResults.map((r, i) => ({
    upload_id: upload.id,
    storage_path: (r as { value: { path: string } }).value.path,
    sort_order: i,
    media_type: allFiles[i].type
  }));
  const { error: mediaError } = await admin.from("upload_media").insert(mediaRecords);
  if (mediaError) {
    await admin.from("uploads").delete().eq("id", upload.id);
    for (const r of uploadResults) {
      const bucket = allFiles[(r as { value: { index: number } }).value.index].type === "video" ? "videos" : "photos";
      await admin.storage.from(bucket).remove([(r as { value: { path: string } }).value.path]);
    }
    return NextResponse.json({ error: mediaError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, upload_id: upload.id, media_count: allFiles.length });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
