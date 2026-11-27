"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uiText } from "@/lib/i18n";
import type { Locale } from "@/lib/ranks";

type Props = {
  userId: string;
  initialName: string;
  initialUsername: string;
  initialAvatar: string;
  locale?: Locale;
};

export default function ProfileEditor({
  userId,
  initialName,
  initialUsername,
  initialAvatar,
  locale = "en"
}: Props) {
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const t = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);

  useEffect(() => {
    if (!avatarFile) { setFilePreview(""); return; }
    const url = URL.createObjectURL(avatarFile);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  function chooseAvatar(file: File | undefined) {
    setMessage("");
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setMessage("Choose a JPG, PNG, WebP or AVIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Profile images must be 5 MB or smaller.");
      return;
    }
    setAvatarFile(file);
  }

  async function save() {
    if (saving) return;
    setSaving(true); setMessage("");
    const supabase = createClient();
    let nextAvatar = avatar.trim() || null;
    let uploadedPath: string | null = null;

    if (avatarFile) {
      const extension = avatarFile.type === "image/jpeg" ? "jpg"
        : avatarFile.type === "image/png" ? "png"
        : avatarFile.type === "image/webp" ? "webp" : "avif";
      uploadedPath = userId + "/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(uploadedPath, avatarFile, {
        upsert: false,
        contentType: avatarFile.type,
        cacheControl: "3600"
      });
      if (uploadError) {
        setMessage("Profile photo upload failed: " + uploadError.message);
        setSaving(false);
        return;
      }
      nextAvatar = supabase.storage.from("avatars").getPublicUrl(uploadedPath).data.publicUrl;
    }

    const { error } = await supabase.from("profiles").update({
      display_name: name.trim() || null,
      username: username.trim(),
      avatar_url: nextAvatar
    }).eq("id", userId);

    if (error) {
      if (uploadedPath) await supabase.storage.from("avatars").remove([uploadedPath]);
      setMessage(error.code === "23505" ? "This username is already taken." : error.message);
    } else {
      await supabase.auth.updateUser({
        data: { full_name: name.trim(), name: name.trim(), avatar_url: nextAvatar || "" }
      });
      setMessage(t("profileSaved"));
      window.location.reload();
    }
    setSaving(false);
  }

  const preview = filePreview || avatar;
  return <div className="panel" style={{ marginBottom: 32 }}>
    <h3 style={{ marginBottom: 18 }}>{t("editProfile")}</h3>
    <div style={{ display: "grid", gap: 14, maxWidth: 620 }}>
      <label><span className="label">{t("displayName")}</span><input className="input" value={name} onChange={event => setName(event.target.value)} maxLength={50} placeholder="Your name" /></label>
      <label><span className="label">{t("username")}</span><input className="input" value={username} onChange={event => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24))} minLength={3} maxLength={24} placeholder="your_username" /></label>
      <label><span className="label">{t("avatarUrl")}</span><input className="input" type="url" value={avatar} onChange={event => { setAvatar(event.target.value); setAvatarFile(null); }} placeholder="https://..." /></label>
      <label><span className="label">{t("avatarFile")}</span><input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => chooseAvatar(event.target.files?.[0])} disabled={saving} /><small className="muted">{t("avatarHelp")}</small></label>
      {preview && <img src={preview} alt="Profile preview" style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover" }} />}
      {message && <p className={message === t("profileSaved") ? "success" : "error"}>{message}</p>}
      <div><button className="btn primary" type="button" onClick={save} disabled={saving || username.trim().length < 3}>{saving ? t("saving") : t("save")}</button></div>
    </div>
  </div>;
}
