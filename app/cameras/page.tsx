import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookie, type Language } from "@/lib/i18n";

type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

export default async function Cameras({ searchParams }: { searchParams: Promise<{q?:string}> }) {
  const { q = "" } = await searchParams;
  const cookieStore = await cookies();
  const lang = cookieStore.get("cw_lang")?.value;
  const locale: Language = (lang && ["en", "tr", "ru", "de", "es", "fr"].includes(lang) ? lang : "en");
  const safeQ = q.replace(/[,()%*\\_:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const supabase = await createClient();
  let query = supabase.from("cameras").select("id,name,brand,is_camcorder").order("name").limit(100);
  if (safeQ) query = query.or(`name.ilike.%${safeQ}%,brand.ilike.%${safeQ}%`);
  const { data } = await query;
  const eyebrow = locale==="tr"?"Ekipman dizini":locale==="ru"?"Каталог оборудования":locale==="de"?"Ausrüstungsverzeichnis":locale==="es"?"Directorio de equipo":locale==="fr"?"Répertoire du matériel":"Gear directory";
  const h1 = locale==="tr"?"Kameralar.":locale==="ru"?"Камеры.":locale==="de"?"Kameras.":locale==="es"?"Cámaras.":locale==="fr"?"Appareils photo.":"Cameras.";
  const lead = locale==="tr"?"Kamera modellerini inceleyin ve her biriyle çekilen gerçek fotoğrafları görün.":locale==="ru"?"Просматривайте модели камер и смотрите реальные фото, сделанные на каждую.":locale==="de"?"Durchsuchen Sie Kameramodelle und sehen Sie echte Fotos, die mit jeder gemacht wurden.":locale==="es"?"Explora modelos de cámaras y ve fotos reales tomadas con cada una.":locale==="fr"?"Parcourez les modèles d'appareils photo et voyez les vraies photos prises avec chacun.":"Browse camera models and see real photos made with each one.";
  const searchPlaceholder = locale==="tr"?"Kamera markası veya modeli ara...":locale==="ru"?"Поиск бренда или модели камеры...":locale==="de"?"Nach Kameramarke oder -modell suchen...":locale==="es"?"Buscar marca o modelo de cámara...":locale==="fr"?"Rechercher une marque ou un modèle d'appareil photo...":"Search camera brand or model...";
  const searchBtn = locale==="tr"?"Ara":locale==="ru"?"Поиск":locale==="de"?"Suchen":locale==="es"?"Buscar":locale==="fr"?"Rechercher":"Search";
  const shown = locale==="tr"?"kamera gösteriliyor":locale==="ru"?"камер показано":locale==="de"?"Kameras angezeigt":locale==="es"?"cámaras mostradas":locale==="fr"?"appareils photo affichés":"cameras shown";
  const maxPerSearch = locale==="tr"?"maksimum 100 aramada":locale==="ru"?"максимум 100 за поиск":locale==="de"?"maximal 100 pro Suche":locale==="es"?"máximo 100 por búsqueda":locale==="fr"?"maximum 100 par recherche":"maximum 100 per search";
  const noCameras = locale==="tr"?"Kamera bulunamadı. Başka bir arama deneyin.":locale==="ru"?"Камеры не найдены. Попробуйте другой поиск.":locale==="de"?"Keine Kameras gefunden. Versuchen Sie eine andere Suche.":locale==="es"?"No se encontraron cámaras. Prueba otra búsqueda.":locale==="fr"?"Aucun appareil photo trouvé. Essayez une autre recherche.":"No cameras found. Try another search.";
  return <section className="section"><div className="container">
    <div className="eyebrow">{eyebrow}</div><h1 style={{fontSize:"clamp(40px,6vw,68px)"}}>{h1}</h1>
    <p className="lead">{lead}</p>
    <form className="search-box" action="/cameras"><input className="input" name="q" defaultValue={q} placeholder={searchPlaceholder} aria-label="Search cameras"/><button className="btn primary">{searchBtn}</button></form>
    <p className="muted" style={{fontSize:12,margin:"18px 0"}}>{data?.length || 0} {shown} · {maxPerSearch}</p>
    {data?.length ? <div className="grid grid-4">{data.map(camera=><Link className="card" href={`/cameras/${camera.id}`} key={camera.id}><div className="card-body"><div className="eyebrow">{camera.brand || (locale==="tr"?"Kamera":locale==="ru"?"Камера":locale==="de"?"Kamera":locale==="es"?"Cámara":locale==="fr"?"Appareil photo":"Camera")}</div><h3 style={{marginTop:7}}>{camera.name}</h3><p className="muted">{camera.is_camcorder ? (locale==="tr"?"Kamera çubuğu":locale==="ru"?"Видеокамера":locale==="de"?"Camcorder":locale==="es"?"Cámara de video":locale==="fr"?"Caméscope":"Camcorder") : (locale==="tr"?"Kamera":locale==="ru"?"Камера":locale==="de"?"Kamera":locale==="es"?"Cámara":locale==="fr"?"Appareil photo":"Camera")}</p></div></Link>)}</div> : <div className="empty">{noCameras}</div>}
  </div></section>;
}
