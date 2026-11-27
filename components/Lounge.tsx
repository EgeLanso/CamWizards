"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uiText } from "@/lib/i18n";
import type { Locale } from "@/lib/ranks";

type Message = { id:string; user_id:string; body:string; status:string; created_at:string; username:string };
export default function Lounge({
  initialMessages,
  currentUserId,
  locale = "en"
}: {
  initialMessages: Message[];
  currentUserId: string;
  locale?: Locale;
}) {
  const [messages,setMessages]=useState(initialMessages);
  const [body,setBody]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const t = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);

  useEffect(()=>{
    const supabase=createClient();
    const channel=supabase.channel("camwizards-lounge")
      .on("postgres_changes",{event:"*",schema:"public",table:"chat_messages"},async payload=>{
        const row=(payload.new||payload.old) as {id?:string;user_id?:string;body?:string;status?:string;created_at?:string};
        if(!row.id) return;
        if(payload.eventType==="DELETE"||row.status==="removed"){
          setMessages(current=>current.filter(item=>item.id!==row.id));
          return;
        }
        if(row.status!=="visible" && row.user_id!==currentUserId) return;
        const {data:profile}=await supabase.from("profiles").select("username,display_name").eq("id",row.user_id!).maybeSingle();
        setMessages(current=>{
          const next=current.filter(item=>item.id!==row.id);
          if(row.status==="visible"||row.user_id===currentUserId) next.push({...row as Message,username:profile?.username||profile?.display_name||"Member"});
          return next.sort((a,b)=>a.created_at.localeCompare(b.created_at)).slice(-80);
        });
      }).subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[currentUserId]);

  async function send(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const text=body.trim();
    if(!text||busy)return;
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/lounge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not send message.");
      setBody("");
      setNotice(result.message|| (result.status==="visible"?"Message sent. +1 XP":"Message sent for review."));
    }catch(error){setNotice(error instanceof Error?error.message:"Could not send message.");}
    finally{setBusy(false);}
  }

  return <div className="panel">
    <div style={{height:460,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingRight:5}}>
      {messages.map(message=><div key={message.id} style={{padding:"11px 13px",border:"1px solid var(--border)",borderRadius:12,background:message.user_id===currentUserId?"rgba(214,243,106,.06)":"#0d1116"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10}}><strong style={{fontSize:12}}>{message.username}{message.user_id===currentUserId?" · You":""}</strong><span className="muted" style={{fontSize:10}}>{new Date(message.created_at).toLocaleTimeString()}</span></div>
        <p style={{margin:"7px 0 0",whiteSpace:"pre-wrap"}}>{message.body}</p>
        {message.status==="pending"&&<span className="muted" style={{fontSize:10}}>Waiting for moderation</span>}
      </div>)}
      {!messages.length&&<div className="empty">Be the first to start a photography conversation.</div>}
    </div>
    <form onSubmit={send} style={{display:"flex",gap:8,marginTop:14}}>
      <input className="input" value={body} onChange={event=>setBody(event.target.value)} maxLength={1000} placeholder={t("privateMessage")} aria-label="Chat message" disabled={busy}/>
      <button className="btn primary" disabled={busy||!body.trim()}>{busy?t("sending"):t("send")}</button>
    </form>
    {notice&&<p className="muted" aria-live="polite" style={{fontSize:12}}>{notice}</p>}
    <p className="muted" style={{fontSize:11}}>Normal swearing is allowed. Hate speech, targeted harassment and threats are not. Messages are checked before appearing.</p>
  </div>;
}
