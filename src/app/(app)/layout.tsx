// Members-only pages (src/proxy.ts sends signed-out visitors to /signin).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>;
}
