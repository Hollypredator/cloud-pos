import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sayfa bulunamadı</h1>
        <p className="mt-2 text-sm text-slate-600">Yazdigin rota geçersiz olabilir veya aradigin sayfa kaldirilmis olabilir.</p>
        <Link href="/" className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
