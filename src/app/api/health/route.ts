import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "cloud-pos",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}

