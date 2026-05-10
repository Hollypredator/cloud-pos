import { NextResponse } from "next/server";
import { getPickupBoardSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getPickupBoardSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch snapshot" }, { status: 500 });
  }
}
