import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Lounge from "@/components/Lounge";
import PrivateChats from "@/components/PrivateChats";
import { normalizeLocale } from "@/lib/ranks";
import { uiText } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function LoungePage() {
  const locale = normalizeLocale((await cookies()).get("cw_locale")?.value);
  const t = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ban } = await supabase.from("user_bans").select("id")
    .eq("user_id", user.id).is("revoked_at", null)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .limit(1).maybeSingle();
  if (ban) redirect("/suspended");

  const { data: rows } = await supabase.from("chat_messages")
    .select("id,user_id,body,status,created_at").in("status", ["visible", "pending"])
    .order("created_at", { ascending: false }).limit(60);
  const messages = (rows || []).reverse();
  const ids = Array.from(new Set(messages.map(row => row.user_id)));
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id,username,display_name").in("id", ids)
    : { data: [] };
  const names = new Map((profiles || []).map(profile => [profile.id, profile.username || profile.display_name || "Member"]));
  const initialMessages = messages.map(row => ({ ...row, username: names.get(row.user_id) || "Member" }));

  return <section className="section"><div className="container" style={{ maxWidth: 900 }}>
    <div className="eyebrow">{t("lounge")}</div>
    <h1 style={{ fontSize: "clamp(38px,6vw,64px)" }}>{t("loungeTitle")}</h1>
    <p className="lead">{t("loungeLead")}</p>
    <Lounge initialMessages={initialMessages} currentUserId={user.id} locale={locale}/>
    <PrivateChats locale={locale}/>
  </div></section>;
}
