import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";
import { getCreatorRanks, getLikeCounts, rankFeed } from "@/lib/ranking";
import { getLanguageFromCookie, t } from "@/lib/i18n";

type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

const categories = ["Street", "Wildlife", "Animals", "Architecture", "Landscape", "Astrophotography", "Portrait", "Cars", "Night", "Other"];
export const dynamic = "force-dynamic";

async function getLocalizedCategory(lang: Language, category: string): Promise<string> {
  const catMap: Record<string, Record<Language, string>> = {
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
  return catMap[category]?.[lang] || category;
}

export default async function Home() {
  const cookieStore = await cookies();
  const lang = cookieStore.get("cw_lang")?.value;
  const locale: Language = (lang && ["en", "tr", "ru", "de", "es", "fr"].includes(lang) ? lang : "en");
  const supabase = await createClient();
  const { data: items } = await supabase.from("uploads").select("id,user_id,media_type,storage_path,title,description,camera_name,lens_name,expires_at,created_at,camera_id,lens_id,camera_price,currency,purchased_from,condition").eq("media_type", "photo").or("expires_at.is.null,expires_at.gt." + new Date().toISOString()).order("created_at", { ascending: false }).limit(8);
  const raw = items || [], rankByUser = await getCreatorRanks(supabase, raw.map(i => i.user_id)), likes = await getLikeCounts(supabase, raw.map(i => i.id)), ranked = rankFeed(raw, rankByUser, likes);
  const cards = ranked.map(item => { const { data } = supabase.storage.from("photos").getPublicUrl(item.storage_path); return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} likeCount={likes.get(item.id) || 0} creatorRank={rankByUser.get(item.user_id)} /> });
  const eyebrow = await t(locale, "home.eyebrow");
  const h1 = await t(locale, "home.h1");
  const lead = await t(locale, "home.lead");
  const explorePhotos = await t(locale, "home.explorePhotos");
  const shareSetup = await t(locale, "home.shareSetup");
  const searchPlaceholder = await t(locale, "home.searchPlaceholder");
  const searchBtn = await t(locale, "home.searchBtn");
  const madeBy = await t(locale, "home.madeBy");
  const discoverEquipment = await t(locale, "home.discoverEquipment");
  const communityEyebrow = await t(locale, "home.communityEyebrow");
  const realPhotos = await t(locale, "home.realPhotos");
  const mutedBoost = await t(locale, "home.mutedBoost");
  const viewAll = await t(locale, "home.viewAll");
  const galleryWaiting = await t(locale, "home.galleryWaiting");
  const firstShare = await t(locale, "home.firstShare");
  const styleEyebrow = await t(locale, "home.styleEyebrow");
  const loveShooting = await t(locale, "home.loveShooting");
  const findSetup = await t(locale, "home.findSetup");
  const notSure = await t(locale, "home.notSure");
  const comparePrices = await t(locale, "home.comparePrices");
  const openFinder = await t(locale, "home.openFinder");
  return <><section className="hero"><div className="container hero-grid"><div><div className="eyebrow">{eyebrow}</div><h1>{h1}</h1><p className="lead">{lead}</p><div className="hero-actions"><Link className="btn primary" href="/explore">{explorePhotos} <span aria-hidden="true">↗</span></Link><Link className="btn" href="/upload">{shareSetup}</Link></div><form className="search-box" action="/explore"><input className="input" name="q" aria-label={searchPlaceholder} placeholder={searchPlaceholder} /><button className="btn primary">{searchBtn}</button></form></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1400&q=82" alt="Camera on a photographer's desk" fetchPriority="high" /><div className="hero-visual-caption"><strong>{madeBy}</strong><span>{discoverEquipment}</span></div></div></div></section>
  <section className="section"><div className="container"><div className="section-head"><div><div className="eyebrow">{communityEyebrow}</div><h2>{realPhotos}</h2><p className="muted">{mutedBoost}</p></div><Link className="btn" href="/explore">{viewAll} ↗</Link></div>{cards.length ? <div className="grid grid-4">{cards}</div> : <div className="empty">{galleryWaiting}. {firstShare}</div>}</div></section>
  <section className="section"><div className="container"><div className="section-head"><div><div className="eyebrow">{styleEyebrow}</div><h2>{loveShooting}</h2></div></div><div className="category-grid">{categories.map(category => <Link className="category" href={"/explore?category=" + encodeURIComponent(category)} key={category}>{await getLocalizedCategory(locale, category)}</Link>)}</div></div></section>
  <section className="section"><div className="container panel"><div className="eyebrow">{findSetup}</div><h2>{notSure}</h2><p className="lead">{comparePrices}</p><Link className="btn primary" href="/recommend">{openFinder} ↗</Link></div></section></>;
}
