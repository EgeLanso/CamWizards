"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { userId: string; initialName: string; initialUsername: string; initialAvatar: string; };

export default function ProfileEditor({ userId, initialName, initialUsername, initialAvatar }: Props) {
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
    if (error) setMessage(error.code === "23505" ? "This username is already taken." : error.message);
    else {
      await supabase.auth.updateUser({ data: { full_name: name.trim(), name: name.trim(), avatar_url: avatar.trim() } });
      setMessage("Profile saved!");
      window.location.reload();
    }
    setSaving(false);
  }

  return <div className="panel" style={{marginBottom:32}}>
    <h3 style={{marginBottom:18}}>Edit profile</h3>
    <div style={{display:"grid",gap:14,maxWidth:620}}>
      <label><span className="label">Display name</span><input className="input" value={name} onChange={e=>setName(e.target.value)} maxLength={50} placeholder="Your name" /></label>
      <label><span className="label">Username</span><input className="input" value={username} onChange={e=>setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g,"").slice(0,24))} minLength={3} maxLength={24} placeholder="your_username" /></label>
      <label><span className="label">Profile photo URL</span><input className="input" type="url" value={avatar} onChange={e=>setAvatar(e.target.value)} placeholder="https://..." /></label>
      {avatar && <img src={avatar} alt="Profile preview" style={{width:72,height:72,borderRadius:"50%",objectFit:"cover"}} />}
      {message && <p className={message === "Profile saved!" ? "success" : "error"}>{message}</p>}
      <div><button className="btn primary" onClick={save} disabled={saving || username.trim().length < 3}>{saving ? "Saving..." : "Save changes"}</button></div>
    </div>
  </div>;
}
