export const posQueryKeys = {
  tablesSnapshot: ["tables.snapshot"] as const,
  cashierSnapshot: ["cashier.snapshot"] as const,
  opsMetrics: ["ops.metrics"] as const,
};

export type PosQueryKey = (typeof posQueryKeys)[keyof typeof posQueryKeys];
