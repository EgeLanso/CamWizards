import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";
import { CATEGORIES } from "@/types/database";
import { getCreatorRanks, getLikeCounts, rankFeed } from "@/lib/ranking";
import { getLanguageFromCookie, t } from "@/lib/i18n";

type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

export const dynamic = "force-dynamic";

export default async function Explore({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams, q=params.q?.trim()||"";
  const category=(CATEGORIES as readonly string[]).includes(params.category||"")?params.category!:"";
  const type=params.type==="photo"||params.type==="video"?params.type:"";
  const condition=params.condition==="new"||params.condition==="used"?params.condition:"";
  const cookieStore = await cookies();
  const lang = cookieStore.get("cw_lang")?.value;
  const locale: Language = (lang && ["en", "tr", "ru", "de", "es", "fr"].includes(lang) ? lang : "en");
  const supabase=await createClient();
  let query=supabase.from("uploads").select("id,user_id,media_type,storage_path,title,description,camera_name,lens_name,expires_at,created_at,camera_id,lens_id,camera_price,currency,purchased_from,condition").or("expires_at.is.null,expires_at.gt."+new Date().toISOString()).order("created_at",{ascending:false}).limit(48);
  if(type) query=query.eq("media_type",type); if(condition) query=query.eq("condition",condition);
  const safeQ=q.replace(/[,()%*\\_:"']/g," ").replace(/\s+/g," ").trim().slice(0,80);
  if(safeQ) query=query.or("camera_name.ilike.%"+safeQ+"%,lens_name.ilike.%"+safeQ+"%,title.ilike.%"+safeQ+"%,description.ilike.%"+safeQ+"%");
  let categoryIds:string[]|null=null;
  if(category){const {data:links}=await supabase.from("upload_categories").select("upload_id").eq("category",category).limit(500);categoryIds=(links||[]).map(row=>row.upload_id);}
  const {data:raw}=categoryIds&&categoryIds.length===0?{data:[]}:(categoryIds?await query.in("id",categoryIds):await query);
  const items=raw||[], rankByUser=await getCreatorRanks(supabase,items.map(i=>i.user_id)),likes=await getLikeCounts(supabase,items.map(i=>i.id)),ranked=rankFeed(items,rankByUser,likes);
  const eyebrow=await t(locale,"explore.eyebrow");
  const h1=await t(locale,"explore.h1");
  const lead=await t(locale,"explore.lead");
  const searchPlaceholder=await t(locale,"explore.searchPlaceholder");
  const applyFilters=await t(locale,"explore.applyFilters");
  const allCategories=await t(locale,"explore.allCategories");
  const photoVideo=await t(locale,"explore.photoVideo");
  const photos=await t(locale,"explore.photos");
  const videos=await t(locale,"explore.videos");
  const anyCondition=await t(locale,"explore.anyCondition");
  const newCond=await t(locale,"explore.newCond");
  const secondHand=await t(locale,"explore.secondHand");
  const resultsCount=await t(locale,"explore.resultsCount");
  const sortedBy=await t(locale,"explore.sortedBy");
  const noMatches=await t(locale,"explore.noMatches");
  const tryAnother=await t(locale,"explore.tryAnother");
  const catMap: Record<string,Record<Language,string>> = {
    "Street": { en: "Street", tr: "Sokak", ru: "Улица", de: "Straße", es: "Calle", fr: "Rue" },
    "Wildlife": { en: "Wildlife", tr: "Vahşi Hayat", ru: "Дикая природа", de: "Wildtiere", es: "Vida silvestre", fr: "Faune sauvage" },
    "Animals": { en: "Animals", tr: "Hayvanlar", ru: "Животные", de: "Tiere", es: "Animales", fr: "Animaux" },
    "Architecture": { en: "Architecture", tr: "Mimari", ru: "Архитектура", de: "Architektur", es: "Arquitectura", fr: "Architecture" },
    "Landscape": { en: "Landscape", tr: "Manzara", ru: "Пейзаж", de: "Landschaft", es: "Paisaje", fr: "Paysage" },
    "Astrophotography": { en: "Astrophotography", tr: "Astrofotografi", ru: "Астрофотография", de: "Astrofotografie", es: "Astrofotografía", fr: "Astrophotographie" },
    "Portrait": { en: "Portrait", tr: "Portre", ru: "Портрет", de: "Porträt", es: "Retrato", fr: "Portrait" },
    "Cars": { en: "Cars", tr: "Araçlar", ru: "Машины", de: "Autos", es: "Coches", fr: "Voitures" },
    "Night": { en: "Night", tr: "Gece", ru: "Ночь", de: "Nacht", es: "Noche", fr: "Nuit" },
    "Other": { en: "Other", tr: "Diğer", ru: "Другое", de: "Sonstiges", es: "Otro", fr: "Autre" },
  };
  return <section className="section"><div className="container"><div className="eyebrow">{eyebrow}</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>{h1}</h1><p className="lead">{lead}</p>
    <form className="filters"><input className="input" name="q" defaultValue={q} placeholder={searchPlaceholder} aria-label="Search uploads"/><select name="category" defaultValue={category}><option value="">{allCategories}</option>{CATEGORIES.map(c=><option key={c} value={c}>{catMap[c]?.[locale]||c}</option>)}</select><select name="type" defaultValue={type}><option value="">{photoVideo}</option><option value="photo">{photos}</option><option value="video">{videos}</option></select><select name="condition" defaultValue={condition}><option value="">{anyCondition}</option><option value="new">{newCond}</option><option value="used">{secondHand}</option></select><button className="btn primary">{applyFilters}</button></form>
    <div className="section-head"><p className="muted">{resultsCount.replace("{count}",String(ranked.length))} {sortedBy}</p></div>
    {ranked.length?<div className="grid grid-4">{ranked.map(item=>{const bucket=item.media_type==="video"?"videos":"photos";const {data}=supabase.storage.from(bucket).getPublicUrl(item.storage_path);return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} likeCount={likes.get(item.id)||0} creatorRank={rankByUser.get(item.user_id)} locale={locale}/>})}</div>:<div className="empty">{noMatches}. {tryAnother}</div>}
  </div></section>;
}
