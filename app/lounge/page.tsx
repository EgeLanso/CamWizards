import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Lounge from "@/components/Lounge";
import PrivateChats from "@/components/PrivateChats";
import { getLanguageFromCookie, type Language } from "@/lib/i18n";

type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

export const dynamic = "force-dynamic";

export default async function LoungePage(){
  const cookieStore = await cookies();
  const lang = cookieStore.get("cw_lang")?.value;
  const locale: Language = (lang && ["en", "tr", "ru", "de", "es", "fr"].includes(lang) ? lang : "en");
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:ban}=await supabase.from("user_bans").select("id").eq("user_id",user.id).is("revoked_at",null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle();
  if(ban)redirect("/suspended");
  const {data:rows}=await supabase.from("chat_messages").select("id,user_id,body,status,created_at").in("status",["visible","pending"])
    .order("created_at",{ascending:false}).limit(60);
  const messages=(rows||[]).reverse();
  const ids=Array.from(new Set(messages.map(row=>row.user_id)));
  const {data:profiles}=ids.length?await supabase.from("profiles").select("id,username,display_name").in("id",ids):{data:[]};
  const names=new Map((profiles||[]).map(p=>[p.id,p.username||p.display_name||"Member"]));
  const initialMessages=messages.map(row=>({...row,username:names.get(row.user_id)||"Member"}));
  const eyebrow=locale==="tr"?"Topluluk salonu":locale==="ru"?"Общий лаунж":locale==="de"?"Community-Lounge":locale==="es"?"Salón comunitario":locale==="fr"?"Salon communautaire":"Community lounge";
  const h1=locale==="tr"?"Fotoğrafçılık hakkında konuş.":locale==="ru"?"Говорите о фотографии.":locale==="de"?"Über Fotografie sprechen.":locale==="es"?"Habla de fotografía.":locale==="fr"?"Parlez photographie.":"Talk photography.";
  const lead=locale==="tr"?"Kamera gövdeleri, lensler, ayarlar, düzenleme ve gerçek çekim deneyimleri hakkında sorun.":locale==="ru"?"Спрашивайте о камерах, объективах, настройках, монтаже и реальном опыте съемки.":locale==="de"?"Fragen Sie zu Kameras, Objektiven, Einstellungen, Bearbeitung und realen Aufnahmeerfahrungen.":locale==="es"?"Pregunta sobre cámaras, lentes, ajustes, edición y experiencias reales de disparo.":locale==="fr"?"Posez des questions sur les boîtiers, objectifs, réglages, retouche et expériences de prise de vue réelles.":"Ask about camera bodies, lenses, settings, editing and real-world shooting experiences.";
  return <section className="section"><div className="container" style={{maxWidth:900}}>
    <div className="eyebrow">{eyebrow}</div><h1 style={{fontSize:"clamp(38px,6vw,64px)"}}>{h1}</h1>
    <p className="lead">{lead}</p>
    <Lounge initialMessages={initialMessages} currentUserId={user.id} locale={locale}/>
    <PrivateChats locale={locale}/>
  </div></section>;
}
