import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  throw new Error(`[phase5:consistency] ${message}`);
}

function expectedStatus(finalAmount, netAmount) {
  if (netAmount >= finalAmount - 0.0001) return "paid";
  if (netAmount <= 0.0001) return "refunded";
  return "served";
}

async function run() {
  if (!url || !serviceRoleKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanimli degil.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: orders, error: ordersError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from("orders").select("id, status, final_price, total_price"),
    supabase.from("payments").select("order_id, payment_type, amount"),
  ]);

  if (ordersError) fail(`orders okunamadi: ${ordersError.message}`);
  if (paymentsError) fail(`payments okunamadi: ${paymentsError.message}`);

  const netByOrder = new Map();
  for (const row of payments ?? []) {
    const orderId = String(row.order_id);
    const amount = Number(row.amount ?? 0);
    const current = netByOrder.get(orderId) ?? 0;
    netByOrder.set(orderId, current + (row.payment_type === "refund" ? -amount : amount));
  }

  const violations = [];
  for (const order of orders ?? []) {
    const id = String(order.id);
    const status = String(order.status);
    if (!["served", "paid", "refunded"].includes(status)) continue;

    const finalAmount = Number(order.final_price ?? order.total_price ?? 0);
    const net = Math.max(0, Number(netByOrder.get(id) ?? 0));
    const shouldBe = expectedStatus(finalAmount, net);

    if (status !== shouldBe) {
      violations.push(`${id}:${status}->${shouldBe}(net=${net.toFixed(2)},final=${finalAmount.toFixed(2)})`);
    }
  }

  if (violations.length > 0) {
    fail(`durum tutarsizligi bulundu: ${violations.slice(0, 20).join(", ")}`);
  }

  console.log("[phase5:consistency] ok");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
