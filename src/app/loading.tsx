export default function GlobalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
        <p className="mt-3 text-sm text-slate-600">Sayfa yukleniyor...</p>
      </div>
    </div>
  );
}

