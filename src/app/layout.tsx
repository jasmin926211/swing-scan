import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { MarketProvider } from "@/lib/market";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Kronos — Stock Forecasts",
  description: "Live India and USA stock prices with on-demand Kronos forecasts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <MarketProvider>
          <Header />
          <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
        </MarketProvider>
      </body>
    </html>
  );
}
