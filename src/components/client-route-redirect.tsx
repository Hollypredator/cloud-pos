"use client";

import { useEffect } from "react";

export function ClientRouteRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return <div className="min-h-[60vh] bg-slate-100" aria-hidden="true" />;
}
