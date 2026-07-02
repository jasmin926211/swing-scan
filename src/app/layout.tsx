import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SwingScan - Stock Pattern Scanner',
  description: 'Scan Nifty 500 stocks for 25 chart patterns - 5-7 day swing trading signals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="ml-64 flex-1">
            <Header />
            <div className="p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
