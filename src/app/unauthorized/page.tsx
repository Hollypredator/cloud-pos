import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,#f5f1e8_0%,#e4edf4_40%,#fafaf8_100%)] px-4 py-10">
      <div className="absolute left-[-6rem] top-20 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="absolute bottom-[-4rem] right-[-4rem] h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_25px_70px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">
            Access Restricted
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">Yetki Yok</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-600">
            Bu alana erismek için hesabinizin gerekli role sahip olmasi gerekiyor. Farkli bir hesapla giriş yapin ya da
            yoneticinizden rol atamasi isteyin.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/ops" className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
              Ana Panele Don
            </Link>
            <Link
              href="/login"
              className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Baska Hesapla Giriş Yap
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
