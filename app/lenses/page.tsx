import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookie, type Language } from "@/lib/i18n";

type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

export default async function Lenses({ searchParams }: { searchParams: Promise<{q?:string}> }) {
  const { q = "" } = await searchParams;
  const cookieStore = await cookies();
  const lang = cookieStore.get("cw_lang")?.value;
  const locale: Language = (lang && ["en", "tr", "ru", "de", "es", "fr"].includes(lang) ? lang : "en");
  const safeQ = q.replace(/[,()%*\\_:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const supabase = await createClient();
  let query = supabase.from("lenses").select("id,name,brand").order("name").limit(100);
  if (safeQ) query = query.or(`name.ilike.%${safeQ}%,brand.ilike.%${safeQ}%`);
  const { data } = await query;
  const eyebrow = locale==="tr"?"Ekipman dizini":locale==="ru"?"Каталог оборудования":locale==="de"?"Ausrüstungsverzeichnis":locale==="es"?"Directorio de equipo":locale==="fr"?"Répertoire du matériel":"Gear directory";
  const h1 = locale==="tr"?"Lensler.":locale==="ru"?"Объективы.":locale==="de"?"Objektive.":locale==="es"?"Lentes.":locale==="fr"?"Objectifs.":"Lenses.";
  const lead = locale==="tr"?"Lensleri bulun ve bunlarla çekilen topluluk fotoğraflarını keşfedin.":locale==="ru"?"Найдите объективы и изучите общественные фотографии, снятые с их помощью.":locale==="de"?"Finden Sie Objektive und entdecken Sie Community-Fotos, die damit aufgenommen wurden.":locale==="es"?"Encuentra lentes y explora las fotos de la comunidad capturadas con ellos.":locale==="fr"?"Trouvez des objectifs et explorez les photos communautaires capturées avec eux.":"Find lenses and explore the community photos captured with them.";
  const searchPlaceholder = locale==="tr"?"Lens markası veya modeli ara...":locale==="ru"?"Поиск бренда или модели объектива...":locale==="de"?"Nach Objektivmarke oder -modell suchen...":locale==="es"?"Buscar marca o modelo de lente...":locale==="fr"?"Rechercher une marque ou un modèle d'objectif...":"Search lens brand or model...";
  const searchBtn = locale==="tr"?"Ara":locale==="ru"?"Поиск":locale==="de"?"Suchen":locale==="es"?"Buscar":locale==="fr"?"Rechercher":"Search";
  const shown = locale==="tr"?"lens gösteriliyor":locale==="ru"?"объективов показано":locale==="de"?"Objektive angezeigt":locale==="es"?"lentes mostradas":locale==="fr"?"objectifs affichés":"lenses shown";
  const maxPerSearch = locale==="tr"?"maksimum 100 aramada":locale==="ru"?"максимум 100 за поиск":locale==="de"?"maximal 100 pro Suche":locale==="es"?"máximo 100 por búsqueda":locale==="fr"?"maximum 100 par recherche":"maximum 100 per search";
  const noLenses = locale==="tr"?"Lens bulunamadı. Başka bir arama deneyin.":locale==="ru"?"Объективы не найдены. Попробуйте другой поиск.":locale==="de"?"Keine Objektive gefunden. Versuchen Sie eine andere Suche.":locale==="es"?"No se encontraron lentes. Prueba otra búsqueda.":locale==="fr"?"Aucun objectif trouvé. Essayez une autre recherche.":"No lenses found. Try another search.";
  const brandOrLens = locale==="tr"?"Lens":locale==="ru"?"Объектив":locale==="de"?"Objektiv":locale==="es"?"Lente":locale==="fr"?"Objectif":"Lens";
  return <section className="section"><div className="container">
    <div className="eyebrow">{eyebrow}</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>{h1}</h1>
    <p className="lead">{lead}</p>
    <form className="search-box" action="/lenses"><input className="input" name="q" defaultValue={q} placeholder={searchPlaceholder} aria-label="Search lenses"/><button className="btn primary">{searchBtn}</button></form>
    <p className="muted" style={{fontSize:12,margin:"18px 0"}}>{data?.length || 0} {shown} · {maxPerSearch}</p>
    {data?.length ? <div className="grid grid-4">{data.map(lens=><Link className="card" href={`/lenses/${lens.id}`} key={lens.id}><div className="card-body"><div className="eyebrow">{lens.brand || brandOrLens}</div><h3 style={{marginTop:7}}>{lens.name}</h3></div></Link>)}</div> : <div className="empty">{noLenses}</div>}
  </div></section>;
}
