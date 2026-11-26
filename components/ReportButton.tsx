"use client";
import { useState } from "react";
export default function ReportButton({uploadId}:{uploadId:string}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState("Inappropriate content"),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 async function submit(){
  setBusy(true);setNotice("");
  try{
   const response=await fetch("/api/reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({uploadId,reason})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not submit report.");
   setNotice("Report sent to the moderation team.");setOpen(false);
  }catch(error){setNotice(error instanceof Error?error.message:"Could not submit report.");}
  finally{setBusy(false);}
 }
 return <div style={{marginTop:14}}>
  <button className="btn" type="button" onClick={()=>setOpen(v=>!v)}>Report post</button>
  {open&&<div className="notice" style={{marginTop:9}}>
   <label className="label" htmlFor="report-reason">Why are you reporting this post?</label>
   <select id="report-reason" value={reason} onChange={e=>setReason(e.target.value)}><option>Inappropriate content</option><option>Harassment or hate speech</option><option>Spam or scam</option><option>False camera or gear information</option><option>Copyright or ownership concern</option><option>Other</option></select>
   <div style={{display:"flex",gap:8,marginTop:10}}><button className="btn primary" disabled={busy} onClick={submit}>{busy?"Sending...":"Submit report"}</button><button className="btn" onClick={()=>setOpen(false)}>Cancel</button></div>
  </div>}
  {notice&&<p className="muted" style={{fontSize:12}}>{notice}</p>}
 </div>;
}