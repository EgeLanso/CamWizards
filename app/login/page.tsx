"use client";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

export default function Login() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [msg,setMsg]=useState("");
  async function login(e:React.FormEvent){e.preventDefault();setMsg("");const s=createClient();const {error}=await s.auth.signInWithPassword({email,password});if(error)setMsg(error.message);else location.href="/profile";}
  async function google(){const s=createClient();const {error}=await s.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${location.origin}/auth/callback`}});if(error)setMsg(error.message);}
  return <section className="form-page"><div className="form-shell" style={{maxWidth:520}}>
    <div className="eyebrow">CamWizards account</div><h2>Log in.</h2><p className="muted">Save your uploads, profile and gear history.</p>
    <form onSubmit={login}><label className="label">Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><label className="label" style={{marginTop:15}}>Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="btn primary" style={{marginTop:18,width:"100%"}}>Log in</button></form>
    <button className="btn" onClick={google} style={{marginTop:10,width:"100%"}}>Continue with Google</button>
    {msg&&<p className="error">{msg}</p>}<p className="muted">No account? <Link href="/signup" style={{color:"var(--accent)"}}>Create one</Link></p>
  </div></section>
}