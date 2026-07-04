import { getPickupBoardSnapshot } from "@/lib/data";
import { PickupBoardClient } from "@/components/pickup-board-client";

export const dynamic = "force-dynamic";

export default async function PickupBoardPage() {
  const snapshot = await getPickupBoardSnapshot();

  return (
    <div className="min-h-screen bg-[#080d1a] text-white overflow-hidden font-sans">
      <header className="uupm-glass-dark sticky top-0 z-10 flex items-center justify-between px-8 py-4">
        <h1 className="text-xl font-bold tracking-tight text-white/90" style={{ fontFamily: "var(--font-sora)" }}>
          Pickup Board
        </h1>
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/50">
          Canlı
        </span>
      </header>
      <PickupBoardClient initialPreparing={snapshot.preparing} initialReady={snapshot.ready} />
    </div>
  );
}
