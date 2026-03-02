type PerfEntry = {
  label: string;
  ms: number;
};

export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<{ label: string; value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return {
    label,
    value,
    ms: Math.round((performance.now() - start) * 100) / 100,
  };
}

export function logServerPerf(route: string, entries: Array<PerfEntry | (PerfEntry & { value?: unknown })>) {
  const shouldLogInProduction = process.env.LOG_ADMIN_PERF === "1" || process.env.VERCEL === "1";
  if (process.env.NODE_ENV === "production" && !shouldLogInProduction) {
    return;
  }

  const total = Math.round(entries.reduce((sum, entry) => sum + entry.ms, 0) * 100) / 100;
  const summary = entries.map((entry) => `${entry.label}=${entry.ms}ms`).join(" ");
  console.info(`[admin-perf] route=${route} total=${total}ms ${summary}`);
}
