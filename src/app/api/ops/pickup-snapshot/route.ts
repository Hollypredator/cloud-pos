import { NextResponse } from "next/server";
import { getPickupBoardSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getPickupBoardSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch snapshot" }, { status: 500 });
  }
}
