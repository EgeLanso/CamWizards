import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SuspendedPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const {data:ban}=await supabase.from("user_bans").select("reason,expires_at,created_at")
  .eq("user_id",user.id).is("revoked_at",null)
  .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
  .order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(!ban)redirect("/profile");
 return <section className="section"><div className="container" style={{maxWidth:650}}>
  <div className="panel"><div className="eyebrow">Account status</div><h1 style={{fontSize:42}}>Temporarily suspended.</h1>
   <p className="lead">Your account cannot upload, chat or access member tools while this suspension is active.</p>
   <p><strong>Reason:</strong> {ban.reason}</p>
   <p className="muted">{ban.expires_at ? "Suspension ends " + new Date(ban.expires_at).toLocaleString() : "This suspension has no scheduled end time."}</p>
   <p className="muted" style={{fontSize:12}}>If you believe this was a mistake, contact the CamWizards team through the site's published contact method.</p>
  </div>
 </div></section>;
}