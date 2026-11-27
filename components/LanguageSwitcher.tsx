"use client";
import { LOCALES, type Locale } from "@/lib/ranks";
import { useState } from "react";

export default function LanguageSwitcher({value}:{value:Locale}) {
  const [locale,setLocale]=useState(value);
  function change(next:Locale) {
    setLocale(next);
    document.cookie = `cw_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }
  return <select aria-label="Language" value={locale} onChange={e=>change(e.target.value as Locale)} style={{width:"auto",minWidth:92,padding:"8px 10px",fontSize:11}}>
    {LOCALES.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
  </select>;
}
