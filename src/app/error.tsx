"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Bir hata oluştu</h1>
        <p className="mt-2 text-sm text-slate-600">İşlem tamamlanamadi. Lütfen tekrar deneyin.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}

