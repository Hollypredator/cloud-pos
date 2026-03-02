import { NextResponse } from "next/server";
import { getAppShellPayload } from "@/lib/server/app-shell";

export async function GET() {
  return NextResponse.json(await getAppShellPayload());
}
