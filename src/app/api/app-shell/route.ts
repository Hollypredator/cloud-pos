import { NextResponse, type NextRequest } from "next/server";
import { performance } from "node:perf_hooks";
import { getAppShellPayload, getFallbackAppShellPayload } from "@/lib/server/app-shell";

const APP_SHELL_API_BUDGET_MS = Math.max(50, Number.parseInt(process.env.APP_SHELL_API_BUDGET_MS || "180", 10) || 180);

async function getAppShellPayloadWithinBudget(authoritative: boolean) {
  if (authoritative) {
    return getAppShellPayload();
  }

  return Promise.race([
    getAppShellPayload(),
    new Promise<ReturnType<typeof getFallbackAppShellPayload>>((resolve) => {
      setTimeout(() => resolve(getFallbackAppShellPayload()), APP_SHELL_API_BUDGET_MS);
    }),
  ]);
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const hasAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.includes("auth-token"));
  const payload = await getAppShellPayloadWithinBudget(hasAuthCookie);
  const response = NextResponse.json(payload);
  response.headers.set("x-app-shell-mode", hasAuthCookie ? "authoritative" : "budget");
  response.headers.set("x-app-shell-ms", Math.round(performance.now() - startedAt).toString());
  return response;
}
