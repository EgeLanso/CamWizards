import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Lounge from "@/components/Lounge";

export const dynamic = "force-dynamic";

export default async function LoungePage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:ban}=await supabase.from("user_bans").select("id").eq("user_id",user.id).is("revoked_at",null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle();
  if(ban)redirect("/suspended");
  const {data:rows}=await supabase.from("chat_messages").select("id,user_id,body,status,created_at").in("status",["visible","pending"])
    .order("created_at",{ascending:false}).limit(60);
  const messages=(rows||[]).reverse();
  const ids=Array.from(new Set(messages.map(row=>row.user_id)));
  const {data:profiles}=ids.length?await supabase.from("profiles").select("id,username,display_name").in("id",ids):{data:[]};
  const names=new Map((profiles||[]).map(p=>[p.id,p.username||p.display_name||"Member"]));
  const initialMessages=messages.map(row=>({...row,username:names.get(row.user_id)||"Member"}));
  return <section className="section"><div className="container" style={{maxWidth:900}}>
    <div className="eyebrow">Community lounge</div><h1 style={{fontSize:"clamp(38px,6vw,64px)"}}>Talk photography.</h1>
    <p className="lead">Ask about camera bodies, lenses, settings, editing and real-world shooting experiences.</p>
    <Lounge initialMessages={initialMessages} currentUserId={user.id}/>
  </div></section>;
}