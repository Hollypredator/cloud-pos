import { LogoutButton } from "@/components/logout-button";
import { StudioNav } from "@/components/studio-nav";

export default async function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Studio</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Site ve backoffice yonetimi</h1>
            </div>
            <LogoutButton redirectPath="/studio/login" />
          </div>
          <StudioNav />
        </div>
      </header>
      {children}
    </div>
  );
}
