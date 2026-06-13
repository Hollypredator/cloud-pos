import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { MobileOpsShell } from "@/components/mobile-ops-shell";
import { getAppShellPayload } from "@/lib/server/app-shell";
import { protectedRobots } from "@/lib/seo";

const MOBILE_APP_SHELL_BUDGET_MS = 220;

export const metadata: Metadata = {
  title: "Mobil Operasyon",
  robots: protectedRobots,
};

function isServiceRoleConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

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

  if (!hasAuthCookie && isServiceRoleConfigured()) {
    return (
      <MobileOpsShell initialData={null}>
        <MobileAuthRedirect />
      </MobileOpsShell>
    );
  }

  return <MobileOpsShell initialData={initialShellData}>{children}</MobileOpsShell>;
}
