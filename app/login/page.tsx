"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Login() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error") === "oauth_callback") {
      setMsg("Google sign-in could not be completed. Check the Supabase and Google redirect URL settings, then try again.");
    }
  }, []);

  async function login(e:React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const s=createClient();
      const {data,error}=await s.auth.signInWithPassword({email:email.trim(),password});
      if(error) setMsg(error.message);
      else if(data.user) window.location.assign("/profile");
      else setMsg("Login did not return a user. Please try again.");
    } catch {
      setMsg("Could not connect to the login service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMsg("");
    setBusy(true);
    try {
      const s=createClient();
      const {data,error}=await s.auth.signInWithOAuth({
        provider:"google",
        options:{redirectTo:`${window.location.origin}/auth/callback`}
      });
      if(error) setMsg(error.message);
      else if(!data.url) setMsg("Google sign-in did not return a redirect URL. Check the provider settings.");
    } catch {
      setMsg("Could not start Google sign-in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="form-page"><div className="form-shell" style={{maxWidth:520}}>
    <div className="eyebrow">CamWizards account</div><h2>Log in.</h2><p className="muted">Save your uploads, profile and gear history.</p>
    <form onSubmit={login}><label className="label">Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required disabled={busy}/><label className="label" style={{marginTop:15}}>Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/><button className="btn primary" style={{marginTop:18,width:"100%"}} disabled={busy}>{busy ? "Signing in..." : "Log in"}</button></form>
    <button className="btn" onClick={google} disabled={busy} style={{marginTop:10,width:"100%"}}>Continue with Google</button>
    {msg&&<p className="error" role="alert">{msg}</p>}<p className="muted">No account? <Link href="/signup" style={{color:"var(--accent)"}}>Create one</Link></p>
  </div></section>
}
