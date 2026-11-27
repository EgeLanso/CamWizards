import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { normalizeLocale } from "@/lib/ranks";
import { uiText } from "@/lib/i18n";

export default async function Lenses({ searchParams }: { searchParams: Promise<{q?:string}> }) {
  const { q = "" } = await searchParams;
  const safeQ = q.replace(/[,()%*\\_:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const locale=normalizeLocale((await cookies()).get("cw_locale")?.value);
  const t=(key:Parameters<typeof uiText>[1])=>uiText(locale,key);
  const supabase = await createClient();
  let query = supabase.from("lenses").select("id,name,brand").order("name").limit(100);
  if (safeQ) query = query.or("name.ilike.%" + safeQ + "%,brand.ilike.%" + safeQ + "%");
  const { data } = await query;
  return <section className="section"><div className="container">
    <div className="eyebrow">{t("gearDirectory")}</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>{t("lensTitle")}</h1>
    <p className="lead">{t("lensLead")}</p>
    <form className="search-box" action="/lenses"><input className="input" name="q" defaultValue={q} placeholder={t("searchLens")} aria-label={t("searchLens")}/><button className="btn primary">{t("search")}</button></form>
    <p className="muted" style={{fontSize:12,margin:"18px 0"}}>{data?.length || 0} {t("lensesShown")}</p>
    {data?.length ? <div className="grid grid-4">{data.map(lens=><Link className="card" href={"/lenses/"+lens.id} key={lens.id}><div className="card-body"><div className="eyebrow">{lens.brand || t("lens")}</div><h3 style={{marginTop:7}}>{lens.name}</h3></div></Link>)}</div> : <div className="empty">{t("noLenses")}</div>}
  </div></section>;
}
