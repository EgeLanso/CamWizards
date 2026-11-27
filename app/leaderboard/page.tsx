import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getRank, normalizeLocale, rankText, visibilityBoost } from "@/lib/ranks";

export const dynamic = "force-dynamic";

export default async function Leaderboard(){
  const locale=normalizeLocale((await cookies()).get("cw_locale")?.value);
  const t=rankText(locale);
  const supabase=await createClient();
  const {data:members}=await supabase.from("profiles").select("id,username,display_name,avatar_url,xp").order("xp",{ascending:false}).order("created_at",{ascending:true}).limit(100);
  return <section className="section"><div className="container" style={{maxWidth:900}}>
    <div className="eyebrow">Community ranks</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>{t.leaderboard}</h1><p className="lead">{t.earn}</p>
    <div className="notice" style={{marginTop:16}}><strong>{t.boost}</strong><br/>{t.top}</div>
    <div className="grid" style={{gap:9,marginTop:24}}>{(members||[]).map((member,index)=>{const rank=index+1,level=getRank(member.xp||0,locale),boost=visibilityBoost(rank);return <Link href={"/profile/"+member.id} className="panel" key={member.id} style={{display:"flex",alignItems:"center",gap:14}}>
      <strong style={{width:32,color:"var(--accent)",fontSize:18}}>#{rank}</strong><img src={member.avatar_url||"/avatar-placeholder.svg"} alt="" style={{width:46,height:46,borderRadius:"50%",objectFit:"cover"}}/>
      <div style={{flex:1,minWidth:0}}><strong>{member.display_name||member.username}</strong><p className="muted" style={{fontSize:11,margin:"3px 0 0"}}>@{member.username} · {level.label}</p></div>
      <div style={{textAlign:"right"}}><strong>{(member.xp||0).toLocaleString()} {t.xp}</strong>{boost>0&&<p className="muted" style={{fontSize:10,margin:"3px 0 0"}}>+{boost} visibility</p>}</div>
    </Link>})}</div>
  </div></section>;
}
