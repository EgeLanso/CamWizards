"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { normalizeLocale, type Locale } from "@/lib/ranks";
import { uiText } from "@/lib/i18n";

export default function Signup() {
  const [locale,setLocale]=useState<Locale>("en");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [username,setUsername]=useState("");
  const [msg,setMsg]=useState("");
  const t=(key:Parameters<typeof uiText>[1])=>uiText(locale,key);

  useEffect(()=>{
    const value=document.cookie.split("; ").find(item=>item.startsWith("cw_locale="))?.split("=")[1];
    setLocale(normalizeLocale(value?decodeURIComponent(value):"en"));
  },[]);

  async function submit(event:React.FormEvent){
    event.preventDefault();setMsg("");
    const supabase=createClient();
    const {error}=await supabase.auth.signUp({
      email,
      password,
      options:{data:{username},emailRedirectTo:window.location.origin+"/auth/callback"}
    });
    if(error){setMsg(error.message);return;}
    setMsg(t("accountCreated"));
  }

  return <section className="form-page"><div className="form-shell" style={{maxWidth:560}}>
    <div className="eyebrow">{t("signupEyebrow")}</div><h2>{t("signupTitle")}</h2>
    <form onSubmit={submit}>
      <label className="label">{t("username")}</label><input className="input" value={username} onChange={event=>setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g,"").slice(0,24))} minLength={3} maxLength={24} placeholder="your_username" required/>
      <label className="label" style={{marginTop:14}}>{t("email")}</label><input className="input" type="email" value={email} onChange={event=>setEmail(event.target.value)} required/>
      <label className="label" style={{marginTop:14}}>{t("confirmPassword")}</label><input className="input" type="password" minLength={8} value={password} onChange={event=>setPassword(event.target.value)} required/>
      <button className="btn primary" style={{marginTop:18}}>{t("createAccount")}</button>
    </form>
    {msg&&<p className={msg===t("accountCreated")?"success":"error"}>{msg}</p>}
  </div></section>;
}
