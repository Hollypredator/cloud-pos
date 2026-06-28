"use client";

import { useEffect } from "react";

export function ThemeForcer({ theme }: { theme: "cashier-light" }) {
  useEffect(() => {
    document.body.classList.add("theme-cashier-light");
    return () => {
      document.body.classList.remove("theme-cashier-light");
    };
  }, [theme]);

  return null;
}
