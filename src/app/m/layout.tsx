import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MobileOpsShell } from "@/components/mobile-ops-shell";
import { getAppShellPayload } from "@/lib/server/app-shell";

const MOBILE_APP_SHELL_BUDGET_MS = 220;

async function getAppShellPayloadWithBudget() {
  try {
    return await Promise.race([
      getAppShellPayload(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), MOBILE_APP_SHELL_BUDGET_MS);
      }),
    ]);
  } catch {
    return null;
  }
}

export default async function MobileOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.getAll().some((cookie) => cookie.name.includes("auth-token"));
  const initialShellData = hasAuthCookie ? await getAppShellPayloadWithBudget() : null;

  if (initialShellData && !initialShellData.mobileAppExperienceEnabled) {
    redirect("/ops");
  }

  return <MobileOpsShell initialData={initialShellData}>{children}</MobileOpsShell>;
}
