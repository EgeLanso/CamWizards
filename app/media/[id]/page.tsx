import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PhotoGallery from "@/components/PhotoGallery";
import ReportButton from "@/components/ReportButton";
import LikeButton from "@/components/LikeButton";
import { getRank, normalizeLocale } from "@/lib/ranks";
import { getCreatorRanks } from "@/lib/ranking";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function MediaPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params,s=await createClient(),locale=normalizeLocale((await cookies()).get("cw_locale")?.value);
  const {data:item}=await s.from("uploads").select("*").eq("id",id).maybeSingle(); if(!item)notFound();
  const {data:{user}}=await s.auth.getUser(),owner=user?.id===item.user_id,expired=Boolean(item.expires_at&&new Date(item.expires_at)<=new Date()); if(expired&&!owner)notFound();
  const bucket=item.media_type==="video"?"videos":"photos",publicUrl=s.storage.from(bucket).getPublicUrl(item.storage_path).data.publicUrl;
  const [{data:cats},{data:p},{count:likeCount},{data:likedRow}]=await Promise.all([
    s.from("upload_categories").select("category").eq("upload_id",id),
    s.from("profiles").select("username,avatar_url,xp").eq("id",item.user_id).maybeSingle(),
    s.from("likes").select("*",{count:"exact",head:true}).eq("upload_id",id),
    user?s.from("likes").select("upload_id").eq("upload_id",id).eq("user_id",user.id).maybeSingle():Promise.resolve({data:null})
  ]);
  let gallery=[{path:item.storage_path,url:publicUrl}];
  if(item.media_type==="photo"){const {data:mediaRows}=await s.from("upload_media").select("storage_path").eq("upload_id",id).order("sort_order",{ascending:true});const paths=Array.from(new Set([item.storage_path,...(mediaRows||[]).map(row=>row.storage_path)]));gallery=paths.map(path=>({path,url:s.storage.from("photos").getPublicUrl(path).data.publicUrl}));}
  const rankMap=await getCreatorRanks(s,[item.user_id]),creatorRank=rankMap.get(item.user_id)||1001;
  return <section className="detail"><div className="container"><div className="detail-grid"><div>{item.media_type==="video"?<video className="detail-media" src={publicUrl} controls/>:<PhotoGallery uploadId={item.id} images={gallery} initialThumbnail={item.storage_path} canEdit={owner}/>}</div><div className="panel">
    <div className="eyebrow">{item.media_type}</div><h2>{item.title}</h2><p className="muted">{item.description}</p><p>by <Link href={"/profile/"+item.user_id} style={{color:"var(--accent)"}}>{p?.username||"Unknown wizard"}</Link></p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"14px 0"}}><LikeButton uploadId={item.id} initialCount={likeCount||0} initialLiked={Boolean(likedRow)} locale={locale}/>{creatorRank<=25&&<span className="pill">#{creatorRank} · {getRank(p?.xp||0,locale).label}</span>}</div>
    <div className="meta">{cats?.map(c=><span className="pill" key={c.category}>{c.category}</span>)}</div><div className="kv"><div><small className="muted">Camera</small><br/>{item.camera_name}</div><div><small className="muted">Lens</small><br/>{item.lens_name||"Built-in / N/A"}</div><div><small className="muted">Price</small><br/>{item.camera_price?item.camera_price+" "+(item.currency||""):"Not listed"}</div><div><small className="muted">Condition</small><br/>{item.condition||"Not listed"}</div></div>
    {item.purchased_from&&<p className="muted">Bought from: {item.purchased_from}</p>}{item.expires_at&&<p className="notice">{expired?"This video has expired and is only visible to you.":"Video expires "+new Date(item.expires_at).toLocaleString()}</p>}{owner&&item.media_type==="video"&&<form action={"/api/uploads/"+item.id+"/renew"} method="post"><button className="btn primary">Renew for 10 days</button></form>}{owner&&<form action={"/api/uploads/"+item.id+"/delete"} method="post" style={{marginTop:10}}><button className="btn danger">Delete upload</button></form>}{!owner&&user&&<ReportButton uploadId={item.id}/>}
  </div></div></div></section>;
}
