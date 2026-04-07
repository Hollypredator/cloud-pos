function readBooleanFlag(rawValue: string | undefined, fallback: boolean) {
  if (typeof rawValue !== "string") {
    return fallback;
  }
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "") {
    return fallback;
  }
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

// Queue defaults to enabled for near-native cashier/table responsiveness.
export const POS_CLIENT_QUEUE_TABLES_ENABLED = readBooleanFlag(
  process.env.NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES,
  true,
);
export const POS_CLIENT_QUEUE_CASHIER_ENABLED = readBooleanFlag(
  process.env.NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER,
  true,
);
