import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { UploadForm } from "@/components/UploadForm";
import { type Language } from "@/lib/i18n";

type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

export default async function UploadPage() {
  const cookieStore = await cookies();
  const lang = cookieStore.get("cw_lang")?.value;
  const locale: Language = (lang && ["en", "tr", "ru", "de", "es", "fr"].includes(lang) ? lang : "en");
  const s=await createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) redirect("/login");
  const eyebrow = locale==="tr"?"Yayınla":locale==="ru"?"Опубликовать":locale==="de"?"Veröffentlichen":locale==="es"?"Publicar":locale==="fr"?"Publier":"Publish";
  const h2 = locale==="tr"?"Kurumun dünyayı görsün.":locale==="ru"?"Покажите миру вашу технику.":locale==="de"?"Zeigen Sie der Welt, was Ihre Ausrüstung kann.":locale==="es"?"Muestra al mundo lo que tu equipo puede hacer.":locale==="fr"?"Montrez au monde ce que votre équipement peut faire.":"Show the world what your setup can do.";
  const lead = locale==="tr"?"Gerçek kamera ve lensi ekleyin ki diğer fotoğrafçılar sonucu keşfetsin.":locale==="ru"?"Прикрепите реальную камеру и объектив, чтобы другие фотографы могли открыть результат.":locale==="de"?"Hängen Sie die tatsächliche Kamera und das Objektiv an, damit andere Fotografen das Ergebnis entdecken können.":locale==="es"?"Adjunta la cámara y el objetivo reales para que otros fotógrafos puedan descubrir el resultado.":locale==="fr"?"Joignez l'appareil photo et l'objectif réels pour que d'autres photographes puissent découvrir le résultat.":"Attach the actual camera and lens so other photographers can discover the result.";
  return <section className="form-page"><div className="container"><div className="form-shell"><div className="eyebrow">{eyebrow}</div><h2>{h2}</h2><p className="lead" style={{fontSize:15}}>{lead}</p><UploadForm locale={locale}/></div></div></section>;
}
