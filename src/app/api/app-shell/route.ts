import { NextResponse } from "next/server";
import { getAppShellPayload } from "@/lib/data";

export async function GET() {
  return NextResponse.json(await getAppShellPayload());
}
