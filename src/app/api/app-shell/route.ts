import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { getAppShellPayload, getFallbackAppShellPayload } from "@/lib/server/app-shell";

const APP_SHELL_API_BUDGET_MS = Math.max(50, Number.parseInt(process.env.APP_SHELL_API_BUDGET_MS || "180", 10) || 180);

async function getAppShellPayloadWithinBudget() {
  return Promise.race([
    getAppShellPayload(),
    new Promise<ReturnType<typeof getFallbackAppShellPayload>>((resolve) => {
      setTimeout(() => resolve(getFallbackAppShellPayload()), APP_SHELL_API_BUDGET_MS);
    }),
  ]);
}

export async function GET() {
  const startedAt = performance.now();
  const payload = await getAppShellPayloadWithinBudget();
  const response = NextResponse.json(payload);
  response.headers.set("x-app-shell-ms", Math.round(performance.now() - startedAt).toString());
  return response;
}
