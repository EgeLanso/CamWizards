"use client";
import { useState } from "react";
import { uiText } from "@/lib/i18n";
import type { Locale } from "@/lib/ranks";

const reasons=[
  ["Harassment or hate speech","reportHarassment"],
  ["Spam or scam","reportSpam"],
  ["Impersonation or fake profile","reportImpersonation"],
  ["Other","reportOther"]
] as const;

export default function ReportProfileButton({userId,locale="en"}:{userId:string;locale?:Locale}) {
  const [open,setOpen]=useState(false);
  const [reason,setReason]=useState<string>(reasons[0][0]);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const t=(key:Parameters<typeof uiText>[1])=>uiText(locale,key);

  async function submit(){
    if(busy)return;
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/reports",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({targetUserId:userId,reason})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not submit report.");
      setNotice(t("reportSent"));setOpen(false);
    }catch(error){
      setNotice(error instanceof Error?error.message:"Could not submit report.");
    }finally{setBusy(false);}
  }

  return <div style={{marginTop:12}}>
    <button className="btn" type="button" onClick={()=>setOpen(value=>!value)}>{t("reportProfile")}</button>
    {open&&<div className="notice" style={{marginTop:9}}>
      <label className="label" htmlFor="profile-report-reason">{t("reportReason")}</label>
      <select id="profile-report-reason" value={reason} onChange={event=>setReason(event.target.value)}>
        {reasons.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}
      </select>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button className="btn primary" disabled={busy} onClick={submit}>{busy?t("sending"):t("submitReport")}</button>
        <button className="btn" type="button" onClick={()=>setOpen(false)}>{t("cancel")}</button>
      </div>
    </div>}
    {notice&&<p className="muted" style={{fontSize:12}}>{notice}</p>}
  </div>;
}
