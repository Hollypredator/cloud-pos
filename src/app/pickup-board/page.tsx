import { getPickupBoardSnapshot } from "@/lib/data";
import { PickupBoardClient } from "@/components/pickup-board-client";

export const dynamic = "force-dynamic";

export default async function PickupBoardPage() {
  const snapshot = await getPickupBoardSnapshot();
  
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white overflow-hidden">
      <PickupBoardClient initialPreparing={snapshot.preparing} initialReady={snapshot.ready} />
    </div>
  );
}
