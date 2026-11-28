import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { getLanguageFromCookie, type Language } from "@/lib/i18n";

const siteUrl = "https://cam-wizards.vercel.app";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "CamWizards — Real camera and lens examples", template: "%s | CamWizards" },
  description: "Discover real-world camera and lens examples shared by photographers.",
  applicationName: "CamWizards",
  verification: { google: "f5IG2MRR5ntszdOdGhLMKkxdW0RTwDsi0QkAd4lz1es" },
  openGraph: { type: "website", url: siteUrl, siteName: "CamWizards", title: "CamWizards — Real camera and lens examples", description: "Explore real photos, camera setups and community gear experiences." },
  twitter: { card: "summary", title: "CamWizards — Real camera and lens examples", description: "Explore real photos, camera setups and community gear experiences." },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const lang = cookieStore.get("cw_lang")?.value;
  const locale: Language = (lang && ["en","tr","ru","de","es","fr"].includes(lang) ? lang : "en");
  return <html lang={locale}><body><Nav locale={locale} /><main>{children}</main><footer className="site-footer"><div className="container footer-inner"><span>© {new Date().getFullYear()} CamWizards</span><span>Real gear. Real people. Real results.</span></div></footer></body></html>;
}
