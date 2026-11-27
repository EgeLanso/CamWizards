import type { SupabaseClient } from "@supabase/supabase-js";
import { visibilityBoost } from "@/lib/ranks";

export async function getCreatorRanks(supabase:SupabaseClient, userIds:string[]) {
  const {data:profiles}=await supabase.from("profiles").select("id,xp").order("xp",{ascending:false}).order("created_at",{ascending:true}).limit(1000);
  const rankByUser=new Map<string,number>();
  (profiles||[]).forEach((p,index)=>rankByUser.set(p.id,index+1));
  return new Map(userIds.map(id=>[id,rankByUser.get(id) || 1001]));
}

export async function getLikeCounts(supabase:SupabaseClient, uploadIds:string[]) {
  const map=new Map<string,number>();
  if(!uploadIds.length) return map;
  const {data}=await supabase.from("likes").select("upload_id").in("upload_id",uploadIds);
  (data||[]).forEach(row=>map.set(row.upload_id,(map.get(row.upload_id)||0)+1));
  return map;
}

export function rankFeed<T extends {user_id:string;id:string}>(items:T[],rankByUser:Map<string,number>,likes:Map<string,number>) {
  return [...items].sort((a,b)=>{
    const score=(item:T)=> (likes.get(item.id)||0)+visibilityBoost(rankByUser.get(item.user_id)||1001);
    return score(b)-score(a);
  });
}
