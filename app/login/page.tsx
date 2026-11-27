"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { normalizeLocale, type Locale } from "@/lib/ranks";
import { uiText } from "@/lib/i18n";

export default function Login() {
  const [locale,setLocale]=useState<Locale>("en");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);
  const t=(key:Parameters<typeof uiText>[1])=>uiText(locale,key);

  useEffect(()=>{
    const value=document.cookie.split("; ").find(item=>item.startsWith("cw_locale="))?.split("=")[1];
    setLocale(normalizeLocale(value?decodeURIComponent(value):"en"));
    const params=new URLSearchParams(window.location.search);
    if(params.get("auth_error")==="oauth_callback"){
      setMsg("Google sign-in could not be completed. Check the Supabase and Google redirect URL settings, then try again.");
    }
  },[]);

  async function login(event:React.FormEvent){
    event.preventDefault();setMsg("");setBusy(true);
    try{
      const s=createClient();
      const {data,error}=await s.auth.signInWithPassword({email:email.trim(),password});
      if(error)setMsg(error.message);
      else if(data.user)window.location.assign("/profile");
      else setMsg("Login did not return a user. Please try again.");
    }catch{setMsg("Could not connect to the login service. Please try again.");}
    finally{setBusy(false);}
  }

  async function google(){
    setMsg("");setBusy(true);
    try{
      const s=createClient();
      const {data,error}=await s.auth.signInWithOAuth({
        provider:"google",
        options:{redirectTo:window.location.origin+"/auth/callback"}
      });
      if(error)setMsg(error.message);
      else if(!data.url)setMsg("Google sign-in did not return a redirect URL. Check the provider settings.");
    }catch{setMsg("Could not start Google sign-in. Please try again.");}
    finally{setBusy(false);}
  }

  return <section className="form-page"><div className="form-shell" style={{maxWidth:520}}>
    <div className="eyebrow">{t("accountTitle")}</div><h2>{t("loginTitle")}</h2><p className="muted">{t("loginLead")}</p>
    <form onSubmit={login}>
      <label className="label">{t("email")}</label><input className="input" type="email" value={email} onChange={event=>setEmail(event.target.value)} required disabled={busy}/>
      <label className="label" style={{marginTop:15}}>{t("password")}</label><input className="input" type="password" value={password} onChange={event=>setPassword(event.target.value)} required disabled={busy}/>
      <button className="btn primary" style={{marginTop:18,width:"100%"}} disabled={busy}>{busy?t("signingIn"):t("login")}</button>
    </form>
    <button className="btn" onClick={google} disabled={busy} style={{marginTop:10,width:"100%"}}>{t("continueGoogle")}</button>
    {msg&&<p className="error" role="alert">{msg}</p>}
    <p className="muted">{t("noAccount")} <Link href="/signup" style={{color:"var(--accent)"}}>{t("createOne")}</Link></p>
  </div></section>;
}
