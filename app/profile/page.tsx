import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ProfileEditor from "@/components/ProfileEditor";
import { cookies } from "next/headers";
import { getRank, normalizeLocale } from "@/lib/ranks";
import { getLanguageFromCookie, type Language } from "@/lib/i18n";

type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

export const dynamic = "force-dynamic";
export default async function Profile() {
  const cookieStore = await cookies();
  const lang = cookieStore.get("cw_lang")?.value;
  const locale: Language = (lang && ["en", "tr", "ru", "de", "es", "fr"].includes(lang) ? lang : "en");
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: p }, { data: items }] = await Promise.all([
    s.from("profiles").select("username,display_name,avatar_url,xp").eq("id", user.id).maybeSingle(),
    s.from("uploads").select("id,media_type,storage_path,title,expires_at,moderation_status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(60)
  ]);
  const count = items?.length || 0;
  const isOwner = Boolean(OWNER_EMAIL && user.email?.toLowerCase() === OWNER_EMAIL);
  const avatar = p?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
  const displayName = p?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || "";

  const uploadCards = (items || []).map(item => {
    const bucket = item.media_type === "video" ? "videos" : "photos";
    const { data } = s.storage.from(bucket).getPublicUrl(item.storage_path);
    return <div className="card" key={item.id}>
      <Link href={`/media/${item.id}`}>
        {item.media_type === "video"
          ? <video className="media" src={data.publicUrl} muted playsInline preload="none" />
          : <img className="media" src={data.publicUrl} alt={item.title} loading="lazy" decoding="async" />}
      </Link>
      <div className="card-body">
        <h3>{item.title}</h3>
        {item.moderation_status !== "approved" && <span className="pill" style={{display:"inline-block",marginTop:7,color:"var(--accent)"}}>{item.moderation_status === "rejected" ? "Rejected" : "Awaiting moderation"}</span>}
        {item.expires_at && <div className="meta" style={{marginTop:7}}>Expires {new Date(item.expires_at).toLocaleDateString()}</div>}
        <div style={{display:"flex",gap:7,marginTop:12}}><Link className="btn" href={`/media/${item.id}`}>Manage</Link></div>
      </div>
    </div>;
  });

  const eyebrow = locale==="tr"?"Hesap":locale==="ru"?"Аккаунт":locale==="de"?"Konto":locale==="es"?"Cuenta":locale==="fr"?"Compte":"Account";
  const displayNameText = locale==="tr"?"Adınız":locale==="ru"?"Ваше имя":locale==="de"?"Name":locale==="es"?"Nombre":locale==="fr"?"Nom":"Display name";
  const usernameText = locale==="tr"?"Kullanıcı adı":locale==="ru"?"Логин":locale==="de"?"Benutzername":locale==="es"?"Nombre de usuario":locale==="fr"?"Nom d'utilisateur":"Username";
  const uploadsText = locale==="tr"?"Gönderileriniz":locale==="ru"?"Ваши загрузки":locale==="de"?"Ihre Hochladungen":locale==="es"?"Sus subidas":locale==="fr"?"Vos chargements":"Your uploads";
  const recentUploadsText = locale==="tr"?"son 60 yükleme":locale==="ru"?"последние 60 загрузок":locale==="de"?"letzte 60 Uploads":locale==="es"?"tus últimas 60 publicaciones":locale==="fr"?"vos 60 dernières chargements":"your latest 60 uploads";
  const noUploadsText = locale==="tr"?"Henüz hiçbir şey yüklemediniz. İlk fotoğrafınızla topluluğa katılın.":locale==="ru"?"Вы еще ничего не загружали. Присоединитесь к сообществу, загрузив первое фото.":locale==="de"?"Sie haben noch nichts hochgeladen. Werden Sie Teil der Gemeinschaft und laden Sie Ihr erstes Foto hoch.":locale==="es"?"Aún no ha cargado nada. Únase a la comunidad y comparta su primera foto.":locale==="fr"?"Vous n'avez pas encore rien téléchargé. Rejoignez la communauté et téléchargez votre première photo.":"You haven't uploaded anything yet. Share your first photo with the community.";
  const xpText = locale==="tr"?"XP":locale==="ru"?"XP":locale==="de"?"XP":locale==="es"?"XP":locale==="fr"?"XP":"XP";
  const rankText = locale==="tr"?"Sıra":locale==="ru"?"Ранг":locale==="de"?"Rang":locale==="es"?"Rango":locale==="fr"?"Rang":"Rank";
  const logOutText = locale==="tr"?"Çıkış":locale==="ru"?"Выход":locale==="de"?"Abmelden":locale==="es"?"Cerrar sesión":locale==="fr"?"Déconnexion":"Log out";

  return <section className="section"><div className="container">
    <div className="profile-head">
      <img className="avatar" src={avatar || "/avatar-placeholder.svg"} alt="" decoding="async" />
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{displayName || p?.username || "Wizard"} {isOwner && <span style={{display:"inline-block",verticalAlign:"middle",fontSize:10,letterSpacing:1,background:"linear-gradient(135deg,#ffe08a,#d99b20)",color:"#241600",padding:"6px 10px",borderRadius:999,fontWeight:900}}>★ OWNER</span>}</h2>
        <div className="stats"><span className="stat"><strong>{p?.xp || 0}</strong> {xpText}</span><span className="pill">{getRank(p?.xp || 0, locale).label}</span><span className="stat"><strong>{count === 60 ? "60+" : count}</strong> {recentUploadsText}</span><span>{user.email}</span></div>
      </div>
      <div style={{marginLeft:"auto"}}><form action="/api/auth/signout" method="post"><button className="btn">{logOutText}</button></form></div>
    </div>
    <ProfileEditor userId={user.id} initialName={displayName} initialUsername={p?.username || ""} initialAvatar={avatar} locale={locale} />
    <div className="section-head" style={{marginTop:35}}><div><h2>{uploadsText}</h2><p className="muted">Your latest 60 posts.</p></div><Link className="btn primary" href="/upload">{locale==="tr"?"+ Yeni yükleme":locale==="ru"?"+ Загрузить":locale==="de"?"+ Hochladen":locale==="es"?"+ Subir":locale==="fr"?"+ Publier":"＋ New upload</Link></div>
    {count ? <div className="grid grid-4">{uploadCards}</div> : <div className="empty">{noUploadsText}</div>}
  </div></section>;
}
