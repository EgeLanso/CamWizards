"use client";
import { useState } from "react";

type Member = { id:string; username:string; display_name:string|null; email:string; xp:number; role:string; banned:boolean; created_at:string };
type Upload = { id:string; user_id:string; username:string; title:string; media_type:string; camera_name:string; lens_name:string|null; moderation_status:string; moderation_note:string|null; gear_check_note:string|null };
type Chat = { id:string; user_id:string; username:string; body:string; created_at:string };
type Report = { id:string; reporter_id:string; target_user_id:string|null; upload_id:string|null; chat_message_id:string|null; reason:string; status:string };
type Log = {id:string;user_id:string|null;content_type:string;content_id:string|null;decision:string;reason:string|null;model:string|null;created_at:string};

export default function AdminPanel({role,members,uploads,chat,reports,logs,profileNames}:{role:string;members:Member[];uploads:Upload[];chat:Chat[];reports:Report[];logs:Log[];profileNames:Record<string,string>}) {
  const [busy,setBusy]=useState("");
  const [notice,setNotice]=useState("");
  const [reason,setReason]=useState("Community rules violation");
  const [memberSearch,setMemberSearch]=useState("");
  const owner=role==="owner";
  const admin=owner||role==="admin";

  async function act(payload:Record<string,unknown>,key:string) {
    setBusy(key); setNotice("");
    try {
      const response=await fetch("/api/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"Action failed.");
      setNotice("Saved. Refresh this page to see the update.");
      window.location.reload();
    } catch(error) { setNotice(error instanceof Error?error.message:"Action failed."); }
    finally { setBusy(""); }
  }

  return <section className="section"><div className="container">
    <div className="eyebrow">CamWizards control room</div>
    <h1 style={{fontSize:"clamp(38px,6vw,64px)"}}>Admin panel.</h1>
    <p className="lead">Signed in with {role} permissions. All privileged actions are checked again on the server.</p>
    {notice&&<p className="notice" aria-live="polite">{notice}</p>}
    <div className="grid grid-4" style={{margin:"24px 0"}}>
      <div className="panel"><div className="eyebrow">Members</div><h2>{members.length}</h2></div>
      <div className="panel"><div className="eyebrow">Pending photos</div><h2>{uploads.length}</h2></div>
      <div className="panel"><div className="eyebrow">Chat review</div><h2>{chat.length}</h2></div>
      <div className="panel"><div className="eyebrow">Open reports</div><h2>{reports.length}</h2></div>
    </div>

    <div className="section-head"><div><h2>Members</h2><p className="muted">Latest 100 registered accounts · XP and staff roles</p></div></div>
    <input className="input" value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="Search username, display name or email..." style={{marginBottom:12}}/>
    <div className="grid" style={{gap:10}}>
      {members.filter(member=>(member.username+" "+(member.display_name||"")+" "+member.email).toLowerCase().includes(memberSearch.toLowerCase())).map(member=><div className="panel" key={member.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:16,alignItems:"center"}}>
        <div><strong>{member.display_name||member.username}</strong> <span className="pill">{member.role}</span> {member.banned&&<span className="pill" style={{color:"var(--danger)"}}>SUSPENDED</span>}<p className="muted" style={{fontSize:12,margin:"5px 0"}}>@{member.username} · {member.email} · {member.xp} XP</p><small className="muted">{member.id}</small></div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"end"}}>
          {owner&&member.role!=="owner"&&<select aria-label="Change member role" defaultValue={member.role} disabled={!!busy} onChange={e=>act({action:"set-role",targetId:member.id,role:e.target.value},"role-"+member.id)}><option value="member">Member</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select>}
          {admin && member.role !== "owner" && <>
            <button className="btn" disabled={!!busy} onClick={()=>act({action:"grant-xp",targetId:member.id,amount:10,reason:"Community contribution"},"xp-"+member.id)}>+10 XP</button>
            {member.banned
              ? <button className="btn" disabled={!!busy} onClick={()=>act({action:"unban",targetId:member.id},"unban-"+member.id)}>Unban</button>
              : <button className="btn danger" disabled={!!busy} onClick={()=>act({action:"ban",targetId:member.id,hours:24,reason},"ban-"+member.id)}>Ban 24h</button>}
            {owner && <button className="btn danger" disabled={!!busy} onClick={()=>act({action:"ban",targetId:member.id,hours:0,reason},"permanent-ban-"+member.id)}>Permanent ban</button>}
          </>}
        </div>
      </div>)}
      {!members.length&&<div className="empty">No members found.</div>}
    </div>

    <div className="panel" style={{marginTop:12}}><label className="label">Reason used for manual suspensions</label><input className="input" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/><p className="muted" style={{fontSize:11}}>Owner can choose a permanent ban. IP addresses are not collected or stored by this panel.</p></div>

    <div className="section-head" style={{marginTop:42}}><div><h2>Post moderation</h2><p className="muted">AI-held posts and posts that need manual review.</p></div></div>
    <div className="grid grid-3">{uploads.map(post=><div className="panel" key={post.id}><div className="eyebrow">{post.moderation_status}</div><h3>{post.title}</h3><p className="muted">{post.username} · {post.camera_name} · {post.lens_name||"No lens"}</p><p className="muted">{post.moderation_note}</p>{post.gear_check_note&&<div className="notice" style={{margin:"10px 0",whiteSpace:"pre-wrap"}}><strong>Gear price check</strong><br/>{post.gear_check_note}</div>}<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn primary" disabled={!!busy} onClick={()=>act({action:"upload-review",uploadId:post.id,status:"approved",reason:"Approved by moderator"},"approve-"+post.id)}>Approve (+10 XP)</button><button className="btn danger" disabled={!!busy} onClick={()=>act({action:"upload-review",uploadId:post.id,status:"rejected",reason:"Rejected by moderator"},"reject-"+post.id)}>Reject</button></div></div>)}</div>
    {!uploads.length&&<div className="empty">No posts waiting for review.</div>}

    <div className="section-head" style={{marginTop:42}}><div><h2>Chat moderation</h2><p className="muted">Messages held by the AI or waiting for review.</p></div></div>
    <div className="grid" style={{gap:10}}>{chat.map(message=><div className="panel" key={message.id}><strong>{message.username}</strong><p>{message.body}</p><button className="btn danger" disabled={!!busy} onClick={()=>act({action:"remove-chat",messageId:message.id},"chat-"+message.id)}>Remove message</button></div>)}</div>
    {!chat.length&&<div className="empty">No chat messages waiting for review.</div>}

    <div className="section-head" style={{marginTop:42}}><div><h2>Reports</h2><p className="muted">Community reports submitted by members.</p></div></div>
    <div className="grid" style={{gap:10}}>{reports.map(report=><div className="panel" key={report.id}><p>{report.reason}</p><p className="muted" style={{fontSize:11}}>Reporter: {profileNames[report.reporter_id]||report.reporter_id} · Target: {report.target_user_id?profileNames[report.target_user_id]||report.target_user_id:report.upload_id||report.chat_message_id}</p><div style={{display:"flex",gap:8}}><button className="btn" disabled={!!busy} onClick={()=>act({action:"report-status",reportId:report.id,status:"reviewing"},"reporting-"+report.id)}>Reviewing</button><button className="btn primary" disabled={!!busy} onClick={()=>act({action:"report-status",reportId:report.id,status:"resolved"},"resolve-"+report.id)}>Resolve</button><button className="btn" disabled={!!busy} onClick={()=>act({action:"report-status",reportId:report.id,status:"dismissed"},"dismiss-"+report.id)}>Dismiss</button></div></div>)}</div>
    {!reports.length&&<div className="empty">No open reports.</div>}

    <div className="section-head" style={{marginTop:42}}><div><h2>Moderation history</h2><p className="muted">Recent AI decisions and moderator actions.</p></div></div>
    <div className="grid" style={{gap:8}}>{logs.map(log=><div className="panel" key={log.id} style={{padding:13}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{log.content_type} · {log.decision}</strong><span className="muted" style={{fontSize:11}}>{new Date(log.created_at).toLocaleString()}</span></div>
      <p className="muted" style={{fontSize:12,margin:"5px 0"}}>{log.reason||"No reason provided"} {log.model&&"· "+log.model}</p>
      {log.content_id&&<small className="muted">{log.content_id}</small>}
    </div>)}</div>
    {!logs.length&&<div className="empty">No moderation history yet.</div>}
  </div></section>;
}