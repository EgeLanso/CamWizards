import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "CamWizards — Real-world camera examples",
  description: "See what cameras and lenses can really do through real community photos and videos.",
  icons: {
    icon: "https://cdn-icons-png.flaticon.com/512/4676/4676067.png",
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