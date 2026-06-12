"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function MobileAuthRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    const nextPath = `${pathname || "/m/ops"}${query ? `?${query}` : ""}`;
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [pathname, router, searchParams]);

  return <div className="min-h-[60vh] bg-slate-100" aria-hidden="true" />;
}
