import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

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
    <html lang="en" className="dark">
      <body className="font-serif">
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
