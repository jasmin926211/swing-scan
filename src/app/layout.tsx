import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AuthProvider } from "@/lib/auth";
import { MarketProvider } from "@/lib/market";

export const metadata: Metadata = {
  title: "CandleTrade — Live markets & Kronos forecasts",
  description: "Live Indian and US stock markets with Kronos AI forecasts and an honest track record next to every one.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
