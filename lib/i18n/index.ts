import { cookies } from "next/headers";

export type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

export const SUPPORTED_LANGUAGES: Language[] = ["en", "tr", "ru", "de", "es", "fr"];

export const DEFAULT_LANGUAGE: Language = "en";

export function getLanguageFromCookie(): Language {
  try {
    const cookieStore = cookies();
    const lang = cookieStore.get("cw_lang")?.value;
    if (lang && SUPPORTED_LANGUAGES.includes(lang as Language)) return lang as Language;
  } catch {}
  return DEFAULT_LANGUAGE;
}

export function setLanguageCookie(lang: Language): void {
  try {
    const cookieStore = cookies();
    cookieStore.set("cw_lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  } catch {}
}

let translationsCache: Record<Language, Record<string, string>> | null = null;

async function loadTranslations(lang: Language): Promise<Record<string, string>> {
  if (translationsCache?.[lang]) return translationsCache[lang];
  try {
    const module = await import(`./translations/${lang}.ts`);
    return module.default || {};
  } catch {
    return {};
  }
}

export async function t(lang: Language, key: string, params?: Record<string, string | number>): Promise<string> {
  const translations = await loadTranslations(lang);
  let text = translations[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`{{${k}}}`, "g"), String(v));
    }
  }
  return text;
}
