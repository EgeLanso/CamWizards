"use client";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function Signup() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [username,setUsername]=useState(""); const [msg,setMsg]=useState("");
  async function submit(e:React.FormEvent){
    e.preventDefault();setMsg("");
    const s=createClient();
    // The profile is created by the database trigger from this metadata. Writing it from the browser
    // here would fail while email confirmation is pending (no session yet), so it is not attempted.
    const {error}=await s.auth.signUp({email,password,options:{data:{username},emailRedirectTo:`${location.origin}/auth/callback`}});
    if(error){setMsg(error.message);return}
    setMsg("Account created. Check your email if confirmation is enabled.");
  }
  return <section className="form-page"><div className="form-shell" style={{maxWidth:560}}><div className="eyebrow">Join the archive</div><h2>Create your account.</h2><form onSubmit={submit}><label className="label">Username</label><input className="input" value={username} onChange={e=>setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g,"").slice(0,24))} minLength={3} maxLength={24} placeholder="your_username" required/><label className="label" style={{marginTop:14}}>Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><label className="label" style={{marginTop:14}}>Password</label><input className="input" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/><button className="btn primary" style={{marginTop:18}}>Create account</button></form>{msg&&<p className={msg.startsWith("Account")?"success":"error"}>{msg}</p>}</div></section>
}
