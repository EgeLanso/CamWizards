import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Leaderboard(){
  const supabase=await createClient();
  const {data:members}=await supabase.from("profiles").select("id,username,display_name,avatar_url,xp").order("xp",{ascending:false}).order("created_at",{ascending:true}).limit(50);
  return <section className="section"><div className="container" style={{maxWidth:850}}>
    <div className="eyebrow">Community ranks</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>Wizard leaderboard.</h1>
    <p className="lead">Earn XP by sharing approved photography and contributing constructively to the lounge.</p>
    <div className="grid" style={{gap:9,marginTop:24}}>{(members||[]).map((member,index)=><Link href={`/profile/${member.id}`} className="panel" key={member.id} style={{display:"flex",alignItems:"center",gap:14}}>
      <strong style={{width:32,color:"var(--accent)",fontSize:18}}>#{index+1}</strong>
      <img src={member.avatar_url||"/avatar-placeholder.svg"} alt="" style={{width:42,height:42,borderRadius:"50%",objectFit:"cover"}}/>
      <div style={{flex:1,minWidth:0}}><strong>{member.display_name||member.username}</strong><p className="muted" style={{fontSize:11,margin:"3px 0 0"}}>@{member.username}</p></div>
      <strong>{member.xp.toLocaleString()} XP</strong>
    </Link>)}</div>
  </div></section>;
}