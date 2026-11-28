"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TEXTS } from "@/lib/i18n";

type Props = { userId: string; initialName: string; initialUsername: string; initialAvatar: string; };

export default function ProfileEditor({ userId, initialName, initialUsername, initialAvatar, locale="en" }: Props) {
  const T = TEXTS[locale] || TEXTS.en;
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({
      display_name: name.trim() || null,
      username: username.trim(),
      avatar_url: avatar.trim() || null
    }).eq("id", userId);
    if (error) setMessage(TEXTS[locale]?.["error_username_taken"] || "This username is already taken." : "This username is already taken.");
    else {
      await supabase.auth.updateUser({ data: { full_name: name.trim(), name: name.trim(), avatar_url: avatar.trim() } });
      setMessage(T.success_profile_saved);
      window.location.reload();
    }
    setSaving(false);
  }

  return <div className="panel" style={{marginBottom:32}}>
    <h3 style={{marginBottom:18}}>{T.header_edit_profile}</h3>
    <div style={{display:"grid",gap:14,maxWidth:620}}>
      <label><span className="label">{T.label_display_name}</span><input className="input" value={name} onChange={e=>setName(e.target.value)} maxLength={50} placeholder={T.placeholder_display_name} /></label>
      <label><span className="label">{T.label_username}</span><input className="input" value={username} onChange={e=>setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g,"").slice(0,24))} minLength={3} maxLength={24} placeholder={T.placeholder_username} /></label>
      <label><span className="label">{T.label_profile_photo_url}</span><input className="input" type="url" value={avatar} onChange={e=>setAvatar(e.target.value)} placeholder={T.placeholder_avatar_url} /></label>
      {avatar && <img src={avatar} alt="Profile preview" style={{width:72,height:72,borderRadius:"50%",objectFit:"cover"}} />}
      {message && <p className={message === T.success_profile_saved ? "success" : "error"}>{message}</p>}
      <div><button className="btn primary" onClick={save} disabled={saving || username.trim().length < 3}>{saving ? T.button_saving : T.button_save_changes}</button></div>
    </div>
  </div>;
}
