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
  const total = Math.round(entries.reduce((sum, entry) => sum + entry.ms, 0) * 100) / 100;
  const summary = entries.map((entry) => `${entry.label}=${entry.ms}ms`).join(" ");
  const level = total > 1000 ? "slow" : total > 500 ? "warm" : "fast";
  const message = `[admin-perf] route=${route} level=${level} total=${total}ms ${summary}`;
  if (total > 1000) {
    console.warn(message);
    return;
  }
  console.info(message);
}
