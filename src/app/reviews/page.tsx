import React from "react";

const DEMO_REVIEWS = [
  { name: "Ayse Yilmaz", comment: "Kahveler harikaydi, servis çok hizliydi. Atmosfere bayildim!", rating: 5, time: "2 saat önce" },
  { name: "Caner Yildiz", comment: "Özelikle tatlilar efsane. Garsonlar çok ilgiliydi.", rating: 5, time: "1 gun önce" },
  { name: "Merve Kaya", comment: "Hafta sonu kalabalik olmasina ragmen hic beklemedik. Guler yuzlu bir ekip.", rating: 5, time: "Dön" },
  { name: "Burak Celik", comment: "Çok temiz ve kaliteli bir mekan. Kesinlikle favori yerim oldu.", rating: 5, time: "3 gun önce" },
  { name: "Selin Sahin", comment: "Harika muzikler ve mukemmel kahveler. Herkese tavsiye ederim.", rating: 5, time: "1 hafta önce" },
  { name: "Kemal Demir", comment: "Özelikle sunum ve personelin ilgisi çok iyiydi.", rating: 5, time: "2 hafta önce" },
];

export default function ReviewsAdvertisementPage() {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-950 font-sans text-slate-100 selection:bg-rose-500/30">
      {/* Ambient Animated Background Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[70vh] w-[70vw] animate-pulse rounded-full bg-rose-500/20 blur-[120px] mix-blend-screen opacity-50 animation-delay-2000" />
        <div className="absolute top-[40%] -right-[20%] h-[60vh] w-[60vw] animate-pulse rounded-full bg-amber-500/20 blur-[120px] mix-blend-screen opacity-40 animation-delay-4000" />
        <div className="absolute -bottom-[20%] left-[20%] h-[80vh] w-[80vw] animate-pulse rounded-full bg-violet-600/20 blur-[120px] mix-blend-screen opacity-30" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex min-h-screen flex-col">
        {/* Header / Marquee */}
        <header className="flex w-full flex-col items-center justify-center pt-20 pb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 opacity-0 animate-[fade-in-up_1s_ease-out_forwards]">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Canlı Geri Bildirimler</span>
          </div>
          <h1 className="text-balance text-5xl font-extrabold tracking-tight text-white sm:text-7xl lg:text-8xl opacity-0 animate-[fade-in-up_1s_ease-out_0.2s_forwards]">
            Misafirlerimizin <br />
            <span className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-amber-400 bg-clip-text text-transparent">Deneyimleri</span>
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg text-slate-400 opacity-0 animate-[fade-in-up_1s_ease-out_0.4s_forwards]">
            Her gun bizi tercih eden yuzlerce mutlu musavirimizin degerli yorumlari. Siz de deneyiminizi bizimle paylasin.
          </p>
        </header>

        {/* Bento Grid Reviews */}
        <section className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {DEMO_REVIEWS.map((review, i) => {
              // Creating a bento-like asymmetrical grid by spanning some elements
              const isLarge = i === 0 || i === 3;
              return (
                <div
                  key={i}
                  className={`group relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl transition-all duration-500 hover:-translate-y-2 hover:bg-white/10 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] opacity-0 animate-[fade-in-up_0.8s_ease-out_forwards] ${
                    isLarge ? "md:col-span-2 lg:col-span-2" : "col-span-1"
                  }`}
                  style={{ animationDelay: `${0.5 + i * 0.15}s` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-amber-400">
                         {[...Array(5)].map((_, star) => (
                           <svg key={star} className="h-5 w-5 fill-current drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" viewBox="0 0 20 20">
                             <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                           </svg>
                         ))}
                      </div>
                      <p className={`mt-6 font-medium text-slate-200 ${isLarge ? "text-2xl leading-relaxed sm:text-3xl" : "text-xl leading-relaxed"}`}>
                        "{review.comment}"
                      </p>
                    </div>
                    
                    <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-500 font-bold text-white shadow-inner">
                          {review.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{review.name}</p>
                          <p className="text-xs text-slate-400">Onayli Misafir</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-slate-500">{review.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="relative mt-auto border-t border-white/5 bg-black/40 py-8 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
            <p className="text-sm text-slate-400">
              Siz de geri bildirim birakmak için masadaki QR kodu okutabilirsiniz.
            </p>
            <div className="h-12 w-32 rounded-xl bg-white/10 animate-pulse"></div>
          </div>
        </footer>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(40px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
