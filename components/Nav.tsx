import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { normalizeLocale } from "@/lib/ranks";
import { uiText } from "@/lib/i18n";

const OWNER_EMAIL = process.env.OWNER_EMAIL?.toLowerCase();

export async function Nav() {
  const locale = normalizeLocale((await cookies()).get("cw_locale")?.value);
  const t = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: roleRow }] = user ? await Promise.all([
    supabase.from("profiles").select("avatar_url,display_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle()
  ]) : [{ data: null }, { data: null }];
  const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const isOwner = Boolean(OWNER_EMAIL && user?.email?.toLowerCase() === OWNER_EMAIL);
  const isStaff = isOwner || Boolean(roleRow?.role);

  return <nav className="site-nav" aria-label="Main navigation"><div className="container nav-inner">
    <Link href="/" className="logo"><span className="logo-mark" aria-hidden="true" />CamWizards</Link>
    <div className="nav-links">
      <Link href="/explore">{t("explore")}</Link>
      <Link href="/cameras">{t("cameras")}</Link>
      <Link href="/lenses">{t("lenses")}</Link>
      <Link href="/recommend">{t("finder")}</Link>
      <Link href="/lounge">{t("lounge")}</Link>
      <Link href="/leaderboard">{t("leaderboard")}</Link>
    </div>
    <div className="nav-actions">
      <LanguageSwitcher value={locale}/>
      {user
        ? <>{isStaff && <Link href="/admin" className="btn ghost">{t("admin")}</Link>}<Link href="/profile" className="nav-profile" aria-label={t("account")}>{avatar ? <img className="nav-avatar" src={avatar} alt="" /> : <span className="nav-avatar" />}<span style={{fontSize:12,fontWeight:800}}>{isOwner ? "OWNER" : profile?.display_name || t("profile")}</span></Link><Link className="btn primary" href="/upload">＋ {t("upload")}</Link></>
        : <><Link className="btn ghost hide-mobile" href="/login">{t("login")}</Link><Link className="btn primary" href="/signup">{t("join")}</Link></>}
    </div>
  </div></nav>;
}
