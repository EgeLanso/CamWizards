"use client";
import { useEffect, useState } from "react";
import { uiText } from "@/lib/i18n";
import type { Locale } from "@/lib/ranks";

type Room = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  locked: boolean;
  unlocked: boolean;
  participants: string[];
};
type Message = { id:string; user_id:string; body:string; created_at:string; username:string };

export default function PrivateChats({ locale = "en" }: { locale?: Locale }) {
  const [rooms,setRooms]=useState<Room[]>([]);
  const [activeRoom,setActiveRoom]=useState<Room|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [roomName,setRoomName]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [roomCode,setRoomCode]=useState("");
  const [unlockPassword,setUnlockPassword]=useState("");
  const [draft,setDraft]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const t=(key:Parameters<typeof uiText>[1])=>uiText(locale,key);

  async function loadRooms():Promise<Room[]> {
    try{
      const response=await fetch("/api/private-chats",{cache:"no-store"});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not load private rooms.");
      const next=(result.rooms||[]) as Room[];
      setRooms(next);
      return next;
    }catch(error){
      setNotice(error instanceof Error?error.message:"Could not load private rooms.");
      return [];
    }
  }

  useEffect(()=>{void loadRooms();},[]);

  useEffect(()=>{
    if(!activeRoom||!activeRoom.unlocked)return;
    let stopped=false;
    async function refresh(){
      try{
        const response=await fetch("/api/private-chats/"+activeRoom!.id+"/messages",{cache:"no-store"});
        const result=await response.json();
        if(!response.ok){
          if(response.status===403&&!stopped)setActiveRoom(current=>current?.id===activeRoom!.id?{...current,unlocked:false}:current);
          return;
        }
        if(!stopped)setMessages(result.messages||[]);
      }catch{
        if(!stopped)setNotice("Connection issue while loading messages.");
      }
    }
    void refresh();
    const timer=window.setInterval(()=>void refresh(),4000);
    return ()=>{stopped=true;window.clearInterval(timer);};
  },[activeRoom?.id,activeRoom?.unlocked]);

  async function createRoom(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/private-chats",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:roomName,password:newPassword})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not create room.");
      setRoomName("");setNewPassword("");
      setActiveRoom(result.room as Room);setMessages([]);
      await loadRooms();
    }catch(error){setNotice(error instanceof Error?error.message:"Could not create room.");}
    finally{setBusy(false);}
  }

  async function joinRoom(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const code=roomCode.trim().match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]||roomCode.trim();
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/private-chats/"+encodeURIComponent(code),{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({password:unlockPassword})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not join room.");
      setRoomCode("");setUnlockPassword("");
      const nextRooms=await loadRooms();
      const joined=nextRooms.find(room=>room.id===code);
      if(joined)setActiveRoom({...joined,unlocked:true});
      setMessages([]);
    }catch(error){setNotice(error instanceof Error?error.message:"Could not join room.");}
    finally{setBusy(false);}
  }

  async function unlockRoom(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!activeRoom||busy)return;
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/private-chats/"+activeRoom.id,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({password:unlockPassword})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not unlock room.");
      setActiveRoom({...activeRoom,unlocked:true});setUnlockPassword("");setNotice("");
      await loadRooms();
    }catch(error){setNotice(error instanceof Error?error.message:"Could not unlock room.");}
    finally{setBusy(false);}
  }

  async function sendMessage(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!activeRoom||!draft.trim()||busy)return;
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/private-chats/"+activeRoom.id+"/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:draft.trim()})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not send message.");
      setMessages(current=>[...current.filter(item=>item.id!==result.message.id),result.message].slice(-100));
      setDraft("");
    }catch(error){setNotice(error instanceof Error?error.message:"Could not send message.");}
    finally{setBusy(false);}
  }

  async function copyRoomCode(){
    if(!activeRoom)return;
    try{
      await navigator.clipboard.writeText(activeRoom.id);
      setNotice(t("roomCodeCopied"));
    }catch{setNotice(activeRoom.id);}
  }

  function leaveRoom(){setActiveRoom(null);setMessages([]);setNotice("");void loadRooms();}

  return <section>
    <div className="section-head" style={{marginTop:44}}>
      <div><div className="eyebrow">Just your group</div><h2>{t("privateRooms")}</h2><p className="muted">{t("privateLead")}</p></div>
    </div>

    {!activeRoom?<>
      <form className="panel" onSubmit={createRoom} style={{display:"grid",gap:10,marginBottom:14}}>
        <strong>{t("createRoom")}</strong>
        <input className="input" value={roomName} onChange={event=>setRoomName(event.target.value)} maxLength={60} placeholder={t("roomName")} aria-label={t("roomName")} required/>
        <input className="input" type="password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} minLength={6} maxLength={64} placeholder={t("roomPassword")} aria-label={t("roomPassword")} autoComplete="new-password" required/>
        <button className="btn primary" disabled={busy||!roomName.trim()||newPassword.length<6}>{busy?t("saving"):t("create")}</button>
      </form>

      <form className="panel" onSubmit={joinRoom} style={{display:"grid",gap:10,marginBottom:18}}>
        <strong>{t("joinCode")}</strong>
        <input className="input" value={roomCode} onChange={event=>setRoomCode(event.target.value)} placeholder={t("pasteCode")} aria-label={t("pasteCode")} required/>
        <input className="input" type="password" value={unlockPassword} onChange={event=>setUnlockPassword(event.target.value)} placeholder={t("roomPassword")} aria-label={t("roomPassword")} autoComplete="current-password" required/>
        <button className="btn" disabled={busy||!roomCode.trim()||!unlockPassword}>{busy?t("joining"):t("joinRoom")}</button>
      </form>

      <div className="grid" style={{gap:10}}>
        {rooms.map(room=><button key={room.id} type="button" className="panel" onClick={()=>{setActiveRoom(room);setMessages([]);setNotice("");}} style={{textAlign:"left",cursor:"pointer",color:"inherit"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
            <strong>🔒 {room.name}</strong><span className="pill">{room.unlocked?t("unlock"):"Password required"}</span>
          </div>
          <p className="muted" style={{fontSize:12,margin:"6px 0 0"}}>{room.participants.join(" · ")}</p>
        </button>)}
        {!rooms.length&&<div className="empty">{t("noRooms")}</div>}
      </div>
    </>:<div className="panel">
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div><div className="eyebrow">{t("privateRooms")}</div><h3 style={{margin:"4px 0"}}>{activeRoom.name}</h3></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn" type="button" onClick={copyRoomCode}>{t("copyCode")}</button>
          <button className="btn" type="button" onClick={leaveRoom}>{t("backRooms")}</button>
        </div>
      </div>
      <p className="muted" style={{fontSize:11}}>Room code: <code>{activeRoom.id}</code></p>
      {!activeRoom.unlocked?<form onSubmit={unlockRoom} style={{display:"grid",gap:10,maxWidth:420,marginTop:22}}>
        <p className="muted">Enter this room's password to continue.</p>
        <input className="input" type="password" value={unlockPassword} onChange={event=>setUnlockPassword(event.target.value)} placeholder={t("roomPassword")} autoComplete="current-password" required/>
        <button className="btn primary" disabled={busy||!unlockPassword}>{busy?t("joining"):t("unlock")}</button>
      </form>:<>
        <p className="muted" style={{fontSize:12}}>{activeRoom.participants.join(" · ")}</p>
        <div style={{height:360,overflowY:"auto",display:"flex",flexDirection:"column",gap:9,padding:"12px 0"}}>
          {messages.map(message=><div key={message.id} style={{padding:"10px 12px",border:"1px solid var(--border)",borderRadius:12}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:10}}><strong style={{fontSize:12}}>{message.username}</strong><span className="muted" style={{fontSize:10}}>{new Date(message.created_at).toLocaleTimeString()}</span></div>
            <p style={{margin:"6px 0 0",whiteSpace:"pre-wrap"}}>{message.body}</p>
          </div>)}
          {!messages.length&&<div className="empty">{t("noMessages")}</div>}
        </div>
        <form onSubmit={sendMessage} style={{display:"flex",gap:8,marginTop:8}}>
          <input className="input" value={draft} onChange={event=>setDraft(event.target.value)} maxLength={1000} placeholder={t("privateMessage")} aria-label={t("privateMessage")} disabled={busy}/>
          <button className="btn primary" disabled={busy||!draft.trim()}>{busy?t("sending"):t("send")}</button>
        </form>
      </>}
    </div>}

    {notice&&<p className="notice" aria-live="polite" style={{marginTop:12}}>{notice}</p>}
    <p className="muted" style={{fontSize:11,marginTop:12}}>{t("roomSecurity")}</p>
  </section>;
}
