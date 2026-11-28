"use client";
import { type Language } from "@/lib/i18n";
import { useState } from "react";

export default function LanguageSwitcher({ value }: { value: Language }) {
  const [locale, setLocale] = useState<Language>(value);
  function change(next: Language) {
    setLocale(next);
    document.cookie = `cw_lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }
  return <select aria-label="Language" value={locale} onChange={e => change(e.target.value as Language)} style={{ width: "auto", minWidth: 92, padding: "8px 10px", fontSize: 11 }}>
    {[["en", "English"], ["tr", "Türkçe"], ["ru", "Русский"], ["de", "Deutsch"], ["es", "Español"], ["fr", "Français"]] as [Language, string][]
      .map(([code, label]) => <option key={code} value={code}>{label}</option>)}
  </select>;
}
