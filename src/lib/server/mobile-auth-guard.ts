import { cookies } from "next/headers";

function isServiceRoleConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function shouldUseMobileClientAuthRedirect() {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.getAll().some((cookie) => cookie.name.includes("auth-token"));
  return !hasAuthCookie && isServiceRoleConfigured();
}
