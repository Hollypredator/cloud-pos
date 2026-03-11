import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  throw new Error(`[phase3:runtime] ${message}`);
}

async function run() {
  if (!url || !serviceRoleKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanimli degil.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: payments, error: paymentsError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase
      .from("payments")
      .select("order_id, payment_type, amount, idempotency_key"),
    supabase
      .from("orders")
      .select("id, status"),
  ]);

  if (paymentsError) {
    fail(`payments okunamadi: ${paymentsError.message}`);
  }
  if (ordersError) {
    fail(`orders okunamadi: ${ordersError.message}`);
  }

  const duplicateIdempotencyKeys = new Map();
  const paymentSummaryByOrder = new Map();
  const orderStatusById = new Map();

  for (const order of orders ?? []) {
    orderStatusById.set(String(order.id), String(order.status));
  }

  for (const row of payments ?? []) {
    const orderId = String(row.order_id);
    const paymentType = String(row.payment_type);
    const amount = Number(row.amount ?? 0);
    const idempotencyKey = row.idempotency_key ? String(row.idempotency_key) : "";

    if (idempotencyKey) {
      const dedupeKey = `${orderId}:${paymentType}:${idempotencyKey}`;
      duplicateIdempotencyKeys.set(dedupeKey, (duplicateIdempotencyKeys.get(dedupeKey) ?? 0) + 1);
    }

    const current = paymentSummaryByOrder.get(orderId) ?? { paid: 0, refunds: 0, net: 0 };
    if (paymentType === "refund") {
      current.refunds += amount;
      current.net -= amount;
    } else {
      current.paid += amount;
      current.net += amount;
    }
    paymentSummaryByOrder.set(orderId, current);
  }

  const duplicateViolations = [...duplicateIdempotencyKeys.entries()].filter(([, count]) => count > 1);
  if (duplicateViolations.length > 0) {
    fail(`idempotency duplicate bulundu: ${duplicateViolations.slice(0, 10).map(([key, count]) => `${key} x${count}`).join(", ")}`);
  }

  const cancelledWithNetPositive = [];
  const overRefundedOrders = [];

  for (const [orderId, summary] of paymentSummaryByOrder.entries()) {
    const status = orderStatusById.get(orderId);
    if (!status) continue;

    if (summary.refunds > summary.paid + 0.0001) {
      overRefundedOrders.push({ orderId, paid: summary.paid, refunds: summary.refunds });
    }
    if (status === "cancelled" && summary.net > 0.0001) {
      cancelledWithNetPositive.push({ orderId, net: summary.net });
    }
  }

  if (overRefundedOrders.length > 0) {
    fail(
      `over-refund tespit edildi: ${overRefundedOrders
        .slice(0, 10)
        .map((row) => `${row.orderId}(paid=${row.paid.toFixed(2)},refund=${row.refunds.toFixed(2)})`)
        .join(", ")}`,
    );
  }

  if (cancelledWithNetPositive.length > 0) {
    fail(
      `cancelled ama net tahsilatli siparis bulundu: ${cancelledWithNetPositive
        .slice(0, 10)
        .map((row) => `${row.orderId}(net=${row.net.toFixed(2)})`)
        .join(", ")}`,
    );
  }

  console.log("[phase3:runtime] ok");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
