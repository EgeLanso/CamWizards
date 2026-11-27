import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MediaCard } from "@/components/MediaCard";
import { getCreatorRanks, getLikeCounts, rankFeed } from "@/lib/ranking";
import { normalizeLocale } from "@/lib/ranks";
import { uiText } from "@/lib/i18n";

const categories=["Street","Wildlife","Animals","Architecture","Landscape","Astrophotography","Portrait","Cars","Night","Other"];
export const dynamic = "force-dynamic";

export default async function Home() {
  const locale = normalizeLocale((await cookies()).get("cw_locale")?.value);
  const t = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);
  const supabase = await createClient();
  const { data: items } = await supabase.from("uploads")
    .select("id,user_id,media_type,storage_path,title,description,camera_name,lens_name,expires_at,created_at,camera_id,lens_id,camera_price,currency,purchased_from,condition")
    .eq("media_type","photo").or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at",{ascending:false}).limit(8);
  const raw=items||[];
  const rankByUser=await getCreatorRanks(supabase,raw.map(item=>item.user_id));
  const likes=await getLikeCounts(supabase,raw.map(item=>item.id));
  const ranked=rankFeed(raw,rankByUser,likes);
  const cards=ranked.map(item=>{
    const {data}=supabase.storage.from("photos").getPublicUrl(item.storage_path);
    return <MediaCard key={item.id} item={item} publicUrl={data.publicUrl} likeCount={likes.get(item.id)||0} creatorRank={rankByUser.get(item.user_id)} locale={locale}/>;
  });

  return <>
    <section className="hero"><div className="container hero-grid">
      <div><div className="eyebrow">{t("homeEyebrow")}</div><h1>{t("homeTitle")}</h1><p className="lead">{t("homeLead")}</p>
        <div className="hero-actions"><Link className="btn primary" href="/explore">{t("explorePhotos")} <span aria-hidden="true">↗</span></Link><Link className="btn" href="/upload">{t("shareSetup")}</Link></div>
        <form className="search-box" action="/explore"><input className="input" name="q" aria-label={t("searchGear")} placeholder={t("searchGear")}/><button className="btn primary">{t("search")}</button></form>
      </div>
      <div className="hero-visual"><img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1400&q=82" alt="Camera on a photographer's desk" fetchPriority="high"/><div className="hero-visual-caption"><strong>Made by photographers.</strong><span>Discover the equipment behind every frame.</span></div></div>
    </div></section>
    <section className="section"><div className="container"><div className="section-head"><div><div className="eyebrow">{t("communityEyebrow")}</div><h2>{t("realSetups")}</h2><p className="muted">{t("boostNote")}</p></div><Link className="btn" href="/explore">{t("viewAll")} ↗</Link></div>{cards.length?<div className="grid grid-4">{cards}</div>:<div className="empty">{t("noGallery")}</div>}</div></section>
    <section className="section"><div className="container"><div className="section-head"><div><div className="eyebrow">{t("exploreStyle")}</div><h2>{t("shootingStyle")}</h2></div></div><div className="category-grid">{categories.map(category=><Link className="category" href={"/explore?category="+encodeURIComponent(category)} key={category}>{category}</Link>)}</div></div></section>
    <section className="section"><div className="container panel"><div className="eyebrow">{t("finderEyebrow")}</div><h2>{t("finderTitle")}</h2><p className="lead">{t("finderLead")}</p><Link className="btn primary" href="/recommend">{t("openFinder")} ↗</Link></div></section>
  </>;
}
