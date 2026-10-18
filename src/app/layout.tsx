import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AuthProvider } from "@/lib/auth";
import { MarketProvider } from "@/lib/market";
import { THEME_SCRIPT } from "@/lib/theme";

// Downloaded at build time and served from this site (no request to Google from visitors' browsers).
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans", display: "swap" });

export const metadata: Metadata = {
  title: "CandleTrade — Live markets & AI forecasts",
  description: "Live Indian and US stock markets with AI forecasts and an honest track record next to every one.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The inline script sets data-theme before first paint, so <html> differs from the server render on purpose.
    <html lang="en" className={openSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider>
          <MarketProvider>
            <Header />
            <div className="flex-1">{children}</div>
            <Footer />
          </MarketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
