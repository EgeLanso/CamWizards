import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";
import { CATEGORIES } from "@/types/database";
import { getCreatorRanks, getLikeCounts, rankFeed } from "@/lib/ranking";
import { normalizeLocale } from "@/lib/ranks";
import { uiText } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Explore({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params=await searchParams;
  const q=params.q?.trim()||"";
  const category=(CATEGORIES as readonly string[]).includes(params.category||"")?params.category!:"";
  const type=params.type==="photo"||params.type==="video"?params.type:"";
  const condition=params.condition==="new"||params.condition==="used"?params.condition:"";
  const locale=normalizeLocale((await cookies()).get("cw_locale")?.value);
  const t=(key:Parameters<typeof uiText>[1])=>uiText(locale,key);
  const supabase=await createClient();
  let query=supabase.from("uploads").select("id,user_id,media_type,storage_path,title,description,camera_name,lens_name,expires_at,created_at,camera_id,lens_id,camera_price,currency,purchased_from,condition").or("expires_at.is.null,expires_at.gt."+new Date().toISOString()).order("created_at",{ascending:false}).limit(48);
  if(type)query=query.eq("media_type",type);
  if(condition)query=query.eq("condition",condition);
  const safeQ=q.replace(/[,()%*\\_:"']/g," ").replace(/\s+/g," ").trim().slice(0,80);
  if(safeQ)query=query.or("camera_name.ilike.%"+safeQ+"%,lens_name.ilike.%"+safeQ+"%,title.ilike.%"+safeQ+"%,description.ilike.%"+safeQ+"%");
  let categoryIds:string[]|null=null;
  if(category){const {data:links}=await supabase.from("upload_categories").select("upload_id").eq("category",category).limit(500);categoryIds=(links||[]).map(row=>row.upload_id);}
  const {data:raw}=categoryIds&&categoryIds.length===0?{data:[]}:(categoryIds?await query.in("id",categoryIds):await query);
  const items=raw||[];
  const rankByUser=await getCreatorRanks(supabase,items.map(item=>item.user_id));
  const likes=await getLikeCounts(supabase,items.map(item=>item.id));
  const ranked=rankFeed(items,rankByUser,likes);

  return <section className="section"><div className="container">
    <div className="eyebrow">{t("communityEyebrow")}</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>{t("exploreTitle")}</h1><p className="lead">{t("exploreLead")}</p>
    <form className="filters">
      <input className="input" name="q" defaultValue={q} placeholder={t("searchUploads")} aria-label={t("searchUploads")}/>
      <select name="category" defaultValue={category}><option value="">{t("allCategories")}</option>{CATEGORIES.map(item=><option key={item} value={item}>{item}</option>)}</select>
      <select name="type" defaultValue={type}><option value="">{t("photoVideo")}</option><option value="photo">{t("photos")}</option><option value="video">{t("videos")}</option></select>
      <select name="condition" defaultValue={condition}><option value="">{t("anyCondition")}</option><option value="new">{t("newItem")}</option><option value="used">{t("usedItem")}</option></select>
      <button className="btn primary">{t("applyFilters")}</button>
    </form>
    <div className="section-head"><p className="muted">{ranked.length} {t("results")}</p></div>
    {ranked.length?<div className="grid grid-4">{ranked.map(item=>{const bucket=item.media_type==="video"?"videos":"photos";const {data}=supabase.storage.from(bucket).getPublicUrl(item.storage_path);return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} likeCount={likes.get(item.id)||0} creatorRank={rankByUser.get(item.user_id)} locale={locale}/>})}</div>:<div className="empty">{t("noMatches")}</div>}
  </div></section>;
}
