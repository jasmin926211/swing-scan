import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AuthProvider } from "@/lib/auth";
import { MarketProvider } from "@/lib/market";
import { THEME_SCRIPT } from "@/lib/theme";

// Downloaded at build time and served from this site (no request to Google from visitors' browsers).
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans", display: "swap" });

export const metadata: Metadata = {
  title: "CandleTrade — Live markets & tested signals",
  description: "Live Indian and US stock markets with the few trading signals that held up on 10 years of data, and plain facts for the rest."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The session cookie (httpOnly, set by the backend) tells us before the first paint whether someone is signed in,
  // so the header doesn't show the signed-out menu while /me is still loading.
  const signedIn = (await cookies()).has("ct_session");
  return (
    // The inline script sets data-theme before first paint, so <html> differs from the server render on purpose.
    <html lang="en" className={openSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider signedInHint={signedIn}>
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
