"use client";

import { useEffect } from "react";

export function ThemeForcer({ theme }: { theme: "kitchen-dark" | "cashier-light" }) {
  useEffect(() => {
    const className = theme === "kitchen-dark" ? "theme-kitchen-dark" : "theme-cashier-light";
    document.body.classList.add(className);
    return () => {
      document.body.classList.remove(className);
    };
  }, [theme]);

  return null;
}
