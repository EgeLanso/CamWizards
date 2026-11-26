import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

const siteUrl = "https://cam-wizards.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CamWizards — Real camera and lens examples",
    template: "%s | CamWizards",
  },
  description:
    "Discover real-world camera and lens examples shared by photographers. Explore sample photos, compare gear, and find camera setups by budget and photography style.",
  applicationName: "CamWizards",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "CamWizards",
    title: "CamWizards — Real camera and lens examples",
    description:
      "Explore real photos, camera setups, lens examples and community-reported gear experiences.",
  },
  twitter: {
    card: "summary",
    title: "CamWizards — Real camera and lens examples",
    description:
      "Explore real photos, camera setups, lens examples and community-reported gear experiences.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container footer-inner">
            <span>© {new Date().getFullYear()} CamWizards</span>
            <span>Real gear. Real people. Real results.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
