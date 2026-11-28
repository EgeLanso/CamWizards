"use client";
import { useState } from "react";

type Member = { id:string; username:string; display_name:string|null; email:string; xp:number; role:string; banned:boolean; created_at:string; badge_text?:string|null; badge_color?:string|null; badge_emoji?:string|null };
type Upload = { id:string; user_id:string; username:string; title:string; media_type:string; publicUrl:string; camera_name:string; lens_name:string|null; moderation_status:string; moderation_note:string|null; gear_check_note:string|null };
type Chat = { id:string; user_id:string; username:string; body:string; status:string; created_at:string };
type Report = { id:string; reporter_id:string; target_user_id:string|null; upload_id:string|null; chat_message_id:string|null; reason:string; status:string };
type Log = {id:string;user_id:string|null;content_type:string;content_id:string|null;decision:string;reason:string|null;model:string|null;created_at:string};
type Badge = { id:string; badge_text:string; badge_color:string; badge_emoji:string; user_id?:string|null; created_by_admin_id?:string|null; created_at:string };
type ProfileReport = { id:string; reporter_id:string; reported_user_id:string; reason:string; status:string; created_at:string; reviewed_by?:string|null; reviewed_at?:string|null };

export default function AdminPanel({role,members,uploads,chat,reports,logs,profileNames,badges,profileReports}:{role:string;members:Member[];uploads:Upload[];chat:Chat[];reports:Report[];logs:Log[];profileNames:Record<string,string>;badges:Badge[];profileReports:ProfileReport[]}) {
  const [busy,setBusy]=useState("");
  const [notice,setNotice]=useState("");
  const [memberSearch,setMemberSearch]=useState("");
  const [badgeText,setBadgeText]=useState("");
  const [badgeColor,setBadgeColor]=useState("#3B82F6");
  const [badgeEmoji,setBadgeEmoji]=useState("★");
  const [selectedMemberId,setSelectedMemberId]=useState("");
  const owner=role==="owner";
  const admin=owner||role==="admin";
  const mod=admin||role==="moderator";

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

  function approveChat(id:string) { act({action:"approve-chat",messageId:id},"approve-"+id); }
  function removeChat(id:string) { act({action:"remove-chat",messageId:id},"chat-"+id); }

  return <section className="section"><div className="container">
    <div className="eyebrow">CamWizards control room</div>
    <h1 style={{fontSize:"clamp(38px,6vw,64px)"}}>Admin panel.</h1>
    <p className="lead">Signed in with {role} permissions. All privileged actions are checked again on the server.</p>
    {notice&&<p className="notice" aria-live="polite">{notice}</p>}
    <div className="grid grid-4" style={{margin:"24px 0"}}>
      <div className="panel"><div className="eyebrow">Members</div><h2>{members.length}</h2></div>
      <div className="panel"><div className="eyebrow">Pending photos</div><h2>{uploads.length}</h2></div>
      <div className="panel"><div className="eyebrow">Chat review</div><h2>{chat.length}</h2></div>
      <div className="panel"><div className="eyebrow">Open reports</div><h2>{reports.length+profileReports.filter(r=>r.status==="pending").length}</h2></div>
    </div>

    <div className="section-head"><div><h2>Members</h2><p className="muted">Search all users · Change roles · Assign custom badges</p></div></div>
    <input className="input" value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="Search username, display name or email..." style={{marginBottom:12}}/>
    <div className="grid" style={{gap:10}}>
      {members.filter(member=>(member.username+" "+(member.display_name||"")+" "+member.email).toLowerCase().includes(memberSearch.toLowerCase())).map(member=>{
        const badge = badges.find(b => b.user_id === member.id);
        return <div className="panel" key={member.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto",gap:16,alignItems:"center"}}>
          <div>
            {badge && <span style={{color:badge.badge_color,fontWeight:"700",marginRight:8}}>{badge.badge_emoji} {badge.badge_text}</span>}
            <strong>{member.display_name||member.username}</strong> <span className="pill">{member.role}</span> {member.banned&&<span className="pill" style={{color:"var(--danger)"}}>SUSPENDED</span>}
            <p className="muted" style={{fontSize:12,margin:"5px 0"}}>@{member.username} · {member.email} · {member.xp} XP</p><small className="muted">{member.id}</small>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button className="btn" disabled={!!busy} onClick={()=>{setSelectedMemberId(member.id); act({action:"set-role",targetId:member.id,role:"member"},"role-"+member.id);}}>Member</button>
            {admin&&<button className="btn" disabled={!!busy||!owner} onClick={()=>{setSelectedMemberId(member.id); act({action:"set-role",targetId:member.id,role:"moderator"},"role-"+member.id);}}>Moderator</button>}
            {admin&&owner&&<button className="btn" disabled={!!busy} onClick={()=>{setSelectedMemberId(member.id); act({action:"set-role",targetId:member.id,role:"admin"},"role-"+member.id);}}>Admin</button>}
            {admin&&<button className="btn danger" disabled={!!busy} onClick={()=>act({action:"badge-assign",targetId:member.id,badge_id:selectedMemberId||""},"badge-"+member.id)}>Assign Badge</button>}
            {member.banned&&admin&&<button className="btn primary" disabled={!!busy} onClick={()=>act({action:"unban",targetId:member.id},"unban-"+member.id)}>Unban</button>}
            {!member.banned&&role==="owner"&&<button className="btn danger" disabled={!!busy} onClick={()=>act({action:"ban",targetId:member.id,hours:24,reason:"Community rules violation"},"ban-"+member.id)}>Ban 24h</button>}
          </div>
          <div style={{gridColumn:"1/-1",marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
            <label className="muted" style={{fontSize:12}}>Custom badge:</label>
            <input className="input" value={badgeText} onChange={e=>setBadgeText(e.target.value)} placeholder="Badge text (max 50)" style={{width:150}} disabled={!admin}/>
            <input className="input" type="color" value={badgeColor} onChange={e=>setBadgeColor(e.target.value)} disabled={!admin}/>
            <input className="input" value={badgeEmoji} onChange={e=>setBadgeEmoji(e.target.value)} placeholder="★" style={{width:40}} disabled={!admin}/>
            {admin&&<button className="btn primary" disabled={!!busy||!badgeText} onClick={()=>act({action:"badge-create",badge_text:badgeText,badge_color:badgeColor,badge_emoji:badgeEmoji},"create-badge")}>Create Badge</button>}
          </div>
        </div>
      })}
      {!members.filter(member=>(member.username+" "+(member.display_name||"")+" "+member.email).toLowerCase().includes(memberSearch.toLowerCase())).length&&<div className="empty">No members found.</div>}
    </div>

    <div className="section-head" style={{marginTop:42}}><div><h2>Badge library</h2><p className="muted">Available custom badges created by staff.</p></div></div>
    <div className="grid" style={{gap:10}}>{badges.map(b=><div className="panel" key={b.id} style={{padding:13}}>
      <span style={{color:b.badge_color,fontWeight:"700"}}>{b.badge_emoji} {b.badge_text}</span> <span className="pill" style={{fontSize:11}}>{b.user_id?"Assigned":"Unassigned"}</span>
      <p className="muted" style={{fontSize:11,margin:"5px 0 0"}}>Created {new Date(b.created_at).toLocaleDateString()}</p>
    </div>)}</div>
    {!badges.length&&<div className="empty">No badges created yet.</div>}

    <div className="section-head" style={{marginTop:42}}><div><h2>Pending photos</h2><p className="muted">Community uploads waiting for review.</p></div></div>
    <div className="grid" style={{gap:10}}>{uploads.map(post=>{const coverStyle=post.publicUrl?{backgroundImage:`url(${post.publicUrl})`,backgroundSize:"cover",backgroundPosition:"center",width:96,height:96,borderRadius:12,border:"1px solid var(--border)",marginBottom:10}:{};return <div className="panel" key={post.id} style={{padding:13}}><div style={coverStyle}></div><h3 style={{margin:"8px 0 4px"}}>{post.title}</h3><p className="muted">{post.username} · {post.camera_name} · {post.lens_name||"No lens"}</p><p className="muted">{post.moderation_note}</p>{post.gear_check_note&&<div className="notice" style={{margin:"10px 0",whiteSpace:"pre-wrap"}}><strong>Gear price check</strong><br/>{post.gear_check_note}</div>}<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn primary" disabled={!!busy} onClick={()=>act({action:"upload-status",uploadId:post.id,status:"approved",reason:"Approved by moderator"},"approve-"+post.id)}>Approve (+10 XP)</button><button className="btn danger" disabled={!!busy} onClick={()=>act({action:"upload-status",uploadId:post.id,status:"removed",reason:"Rejected by moderator"},"reject-"+post.id)}>Remove</button></div></div>)}</div>
    {!uploads.length&&<div className="empty">No posts waiting for review.</div>}

    <div className="section-head" style={{marginTop:42,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h2>Chat moderation</h2><p className="muted">Messages held by the AI or waiting for review.</p></div>{admin&&<button type="button" className="btn danger" disabled={!!busy} onClick={()=>{if(window.confirm("Clear the public Lounge? All existing public messages will be hidden. This does not affect private rooms.")) act({action:"clear-chat"},"clear-chat");}}>Clear public chat</button>}</div>
    <div className="grid" style={{gap:10}}>{chat.map(message=>
      mod ? <div className="panel" key={message.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div><strong>{message.username}</strong><p style={{margin:"4px 0 0"}}>{message.body}</p><span className="muted" style={{fontSize:11}}>{message.status}</span></div>
        <div style={{display:"flex",gap:6}}>{mod&&<button className="btn" disabled={!!busy} onClick={()=>approveChat(message.id)}>Approve</button>}{mod&&<button className="btn danger" disabled={!!busy} onClick={()=>removeChat(message.id)}>Remove</button>}</div>
      </div> : <div className="panel" key={message.id}><strong>{message.username}</strong><p>{message.body}</p><button className="btn danger" disabled={!!busy} onClick={()=>removeChat(message.id)}>Remove message</button></div>)
    )}</div>
    {!chat.length&&<div className="empty">No chat messages waiting for review.</div>}

    <div className="section-head" style={{marginTop:42}}><div><h2>Reports</h2><p className="muted">Community reports submitted by members.</p></div></div>
    <div className="grid" style={{gap:10}}>{[...reports,...profileReports.filter(r=>r.status==="pending")].map(report=>{
      const isProfile = !report.upload_id && !report.chat_message_id;
      return <div className="panel" key={report.id}><p>{report.reason}</p><p className="muted" style={{fontSize:11}}>{isProfile?`Profile report · Reporter: ${profileNames[report.reporter_id]||report.reporter_id} · Target: ${profileNames[report.reported_user_id]||report.reported_user_id}`:`Reporter: ${profileNames[report.reporter_id]||report.reporter_id} · Target: ${report.target_user_id?profileNames[report.target_user_id]||report.target_user_id:report.upload_id||report.chat_message_id}`}</p><div style={{display:"flex",gap:8}}><button className="btn" disabled={!!busy} onClick={()=>act({action:isProfile?"profile-report-review":"report-status",reportId:report.id,status:"reviewing"},"reviewing-"+report.id)}>Reviewing</button><button className="btn primary" disabled={!!busy} onClick={()=>act({action:isProfile?"profile-report-review":"report-status",reportId:report.id,status:"resolved"},"resolve-"+report.id)}>Resolve</button><button className="btn" disabled={!!busy} onClick={()=>act({action:isProfile?"profile-report-review":"report-status",reportId:report.id,status:"dismissed"},"dismiss-"+report.id)}>Dismiss</button></div></div>
    )}</div>
    {reports.length===0&&profileReports.filter(r=>r.status==="pending").length===0&&<div className="empty">No open reports.</div>}

    <div className="section-head" style={{marginTop:42}}><div><h2>Moderation history</h2><p className="muted">Recent AI decisions and moderator actions.</p></div></div>
    <div className="grid" style={{gap:8}}>{logs.map(log=>
      <div className="panel" key={log.id} style={{padding:13}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{log.content_type} · {log.decision}</strong><span className="muted" style={{fontSize:11}}>{new Date(log.created_at).toLocaleString()}</span></div>
        <p className="muted" style={{fontSize:12,margin:"5px 0"}}>{log.reason||"No reason provided"} {log.model&&"· "+log.model}</p>
        {log.content_id&&<small className="muted">{log.content_id}</small>}
      </div>
    )}</div>
    {!logs.length&&<div className="empty">No moderation history yet.</div>}
  </div></section>;
}
