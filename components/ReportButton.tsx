"use client";
import { useState } from "react";
import { uiText } from "@/lib/i18n";
import type { Locale } from "@/lib/ranks";

const reasons=[
  ["Inappropriate content","reportInappropriate"],
  ["Harassment or hate speech","reportHarassment"],
  ["Spam or scam","reportSpam"],
  ["False camera or gear information","reportFalseGear"],
  ["Copyright or ownership concern","reportCopyright"]
] as const;

export default function ReportButton({uploadId,locale="en"}:{uploadId:string;locale?:Locale}) {
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
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({uploadId,reason})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not submit report.");
      setNotice(t("reportSent"));setOpen(false);
    }catch(error){setNotice(error instanceof Error?error.message:"Could not submit report.");}
    finally{setBusy(false);}
  }

  return <div style={{marginTop:14}}>
    <button className="btn" type="button" onClick={()=>setOpen(value=>!value)}>{t("reportPost")}</button>
    {open&&<div className="notice" style={{marginTop:9}}>
      <label className="label" htmlFor="report-reason">{t("reportPostReason")}</label>
      <select id="report-reason" value={reason} onChange={event=>setReason(event.target.value)}>
        {reasons.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}
        <option value="Other">{t("reportOther")}</option>
      </select>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button className="btn primary" disabled={busy} onClick={submit}>{busy?t("sending"):t("submitReport")}</button>
        <button className="btn" type="button" onClick={()=>setOpen(false)}>{t("cancel")}</button>
      </div>
    </div>}
    {notice&&<p className="muted" style={{fontSize:12}}>{notice}</p>}
  </div>;
}
