import { SupportNav } from "@/components/support-nav";

export default async function SupportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Support</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Musteri ve destek operasyonlari</h1>
          </div>
          <SupportNav />
        </div>
      </header>
      {children}
    </div>
  );
}
