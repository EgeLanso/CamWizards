import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UploadForm } from "@/components/UploadForm";

export default async function UploadPage() {
  const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) redirect("/login");
  return <section className="form-page"><div className="container"><div className="form-shell"><div className="eyebrow">Publish</div><h2>Show the world what your setup can do.</h2><p className="lead" style={{fontSize:15}}>Attach the actual camera and lens so other photographers can discover the result.</p><UploadForm/></div></div></section>;
}