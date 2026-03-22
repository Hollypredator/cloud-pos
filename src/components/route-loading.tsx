export function RouteLoading({ title }: { title: string }) {
  return (
    <div className="min-h-[60vh] px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl animate-pulse space-y-4">
        <div className="h-8 w-56 rounded-xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-24 rounded-2xl bg-slate-100" />
          <div className="h-24 rounded-2xl bg-slate-100" />
          <div className="h-24 rounded-2xl bg-slate-100" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-700">{title} yukleniyor...</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-64 rounded-2xl bg-slate-100" />
          <div className="h-64 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
