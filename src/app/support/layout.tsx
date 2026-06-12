import { LogoutButton } from "@/components/logout-button";
import { SupportNav } from "@/components/support-nav";

export default async function SupportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-emerald-500 text-sm font-bold text-white shadow-lg shadow-cyan-500/20">
                SP
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">Support</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Müşteri ve destek operasyonları</h1>
              </div>
            </div>
            <LogoutButton redirectPath="/support/login" />
          </div>
          <SupportNav />
        </div>
      </header>
      {children}
    </div>
  );
}
