import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { UploadForm } from "@/components/UploadForm";
import { normalizeLocale } from "@/lib/ranks";
import { uiText } from "@/lib/i18n";

export default async function UploadPage() {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login");
  const locale = normalizeLocale((await cookies()).get("cw_locale")?.value);
  const t = (key: Parameters<typeof uiText>[1]) => uiText(locale, key);

  return <section className="form-page"><div className="container"><div className="form-shell">
    <div className="eyebrow">{t("publish")}</div>
    <h2>{t("uploadTitle")}</h2>
    <p className="lead" style={{ fontSize: 15 }}>{t("uploadLead")}</p>
    <UploadForm locale={locale}/>
  </div></div></section>;
}
