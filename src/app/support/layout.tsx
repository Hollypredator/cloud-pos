import { LogoutButton } from "@/components/logout-button";
import { SupportNav } from "@/components/support-nav";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";

export default async function SupportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getCurrentLocale();
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{translateUiText("Support", locale)}</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">{translateUiText("Musteri ve destek operasyonlari", locale)}</h1>
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
