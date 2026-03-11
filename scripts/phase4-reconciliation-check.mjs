import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const threshold = Number.isFinite(Number(process.env.CASH_RECONCILIATION_DIFF_ALERT))
  ? Number(process.env.CASH_RECONCILIATION_DIFF_ALERT)
  : 50;

function fail(message) {
  throw new Error(`[phase4:reconciliation] ${message}`);
}

async function run() {
  if (!url || !serviceRoleKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanimli degil.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select("id, status, expected_cash, closing_cash, closed_at")
    .eq("status", "closed")
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(200);

  if (error) {
    fail(`cash_register_sessions okunamadi: ${error.message}`);
  }

  const violations = [];
  for (const session of data ?? []) {
    const expected = Number(session.expected_cash ?? 0);
    const closing = Number(session.closing_cash ?? 0);
    const diff = Math.abs(closing - expected);
    if (diff > threshold) {
      violations.push({
        id: String(session.id),
        diff,
      });
    }
  }

  if (violations.length > 0) {
    fail(`esik ustu mutabakat farki var: ${violations.slice(0, 10).map((v) => `${v.id}:${v.diff.toFixed(2)}`).join(", ")}`);
  }

  console.log(`[phase4:reconciliation] ok (threshold=${threshold})`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
