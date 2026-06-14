import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const simulatedBranches = Math.max(1, Number.parseInt(process.env.SCALE_SIM_BRANCHES ?? "500", 10) || 500);
const itemsPerOrder = Math.max(1, Number.parseInt(process.env.SCALE_ITEMS_PER_ORDER ?? "15", 10) || 15);
const createConcurrency = Math.max(1, Number.parseInt(process.env.SCALE_CREATE_CONCURRENCY ?? "60", 10) || 60);
const paymentConcurrency = Math.max(1, Number.parseInt(process.env.SCALE_PAYMENT_CONCURRENCY ?? "80", 10) || 80);
const summaryRuns = Math.max(1, Number.parseInt(process.env.SCALE_SUMMARY_RUNS ?? "20", 10) || 20);
const summaryConcurrency = Math.max(1, Number.parseInt(process.env.SCALE_SUMMARY_CONCURRENCY ?? "10", 10) || 10);

function fail(message) {
  throw new Error(`[scale:branches] ${message}`);
}

function toMs(value) {
  return `${value.toFixed(2)}ms`;
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index] ?? 0;
}

function summarizeDurations(name, durations) {
  if (durations.length === 0) {
    return `${name}: no data`;
  }
  const sum = durations.reduce((total, item) => total + item, 0);
  const avg = sum / durations.length;
  const p95 = percentile(durations, 0.95);
  const p99 = percentile(durations, 0.99);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  return `${name}: count=${durations.length} avg=${toMs(avg)} p95=${toMs(p95)} p99=${toMs(p99)} min=${toMs(min)} max=${toMs(max)}`;
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function consume() {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) {
        return;
      }
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => consume());
  await Promise.all(workers);
  return results;
}

function buildOrderItems(orderIndex, count) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const price = 20 + (i % 7) * 5;
    const quantity = 1 + (i % 2);
    items.push({
      product_id: "",
      name: `Scale Item ${orderIndex + 1}-${i + 1}`,
      quantity,
      unit_price: price,
      line_total: price * quantity,
      modifiers: [],
    });
  }
  return items;
}

async function run() {
  if (!url || !serviceRoleKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanimli degil.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: branchRow, error: branchError } = await supabase
    .from("branches")
    .select("id, business_id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (branchError || !branchRow) {
    fail(`aktif Şube bulunamadı: ${branchError?.message ?? "branch yok"}`);
  }

  const businessId = String(branchRow.business_id);
  const branchId = String(branchRow.id);
  const runTag = `scale-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const tablesPayload = Array.from({ length: simulatedBranches }, (_, index) => ({
    business_id: businessId,
    branch_id: branchId,
    table_number: 900000 + index,
    name: `${runTag}-t${index + 1}`,
    status: "empty",
    qr_code_identifier: `${runTag}-qr-${index + 1}`,
  }));

  const { data: createdTables, error: createTablesError } = await supabase
    .from("tables")
    .insert(tablesPayload)
    .select("id, table_number");

  if (createTablesError || !createdTables || createdTables.length === 0) {
    fail(`test masalari oluşturulamad?: ${createTablesError?.message ?? "unknown"}`);
  }

  const tableIds = createdTables.map((item) => String(item.id));
  const createdOrderIds = [];
  const createDurations = [];
  const paymentDurations = [];
  const summaryDurations = [];
  const failures = [];

  try {
    const creationResults = await runWithConcurrency(tableIds, createConcurrency, async (tableId, index) => {
      const items = buildOrderItems(index, itemsPerOrder);
      const totalPrice = items.reduce((sum, item) => sum + Number(item.line_total), 0);
      const startedAt = performance.now();
      const result = await supabase.rpc("create_or_append_order", {
        p_business_id: businessId,
        p_branch_id: branchId,
        p_table_id: tableId,
        p_channel: "dine_in",
        p_customer_name: null,
        p_customer_phone: null,
        p_delivery_address: null,
        p_delivery_note: null,
        p_courier_id: null,
        p_courier_name: null,
        p_courier_phone: null,
        p_fulfillment_status: "not_applicable",
        p_total_price: totalPrice,
        p_items: items,
      });
      const elapsed = performance.now() - startedAt;
      createDurations.push(elapsed);

      if (result.error) {
        failures.push(`order_create_failed table=${tableId} error=${result.error.message}`);
        return null;
      }
      const row = (result.data ?? [])[0] ?? null;
      const orderId = row?.order_id ? String(row.order_id) : null;
      if (!orderId) {
        failures.push(`order_create_missing_id table=${tableId}`);
      }
      return orderId;
    });

    for (const orderId of creationResults) {
      if (orderId) {
        createdOrderIds.push(orderId);
      }
    }

    const paymentResults = await runWithConcurrency(createdOrderIds, paymentConcurrency, async (orderId) => {
      const startedAt = performance.now();
      const result = await supabase.rpc("apply_order_payment_mutation", {
        p_order_id: orderId,
        p_payment_type: "sale",
        p_method: "cash",
        p_amount: 10,
        p_note: runTag,
        p_created_by: null,
        p_idempotency_key: `${runTag}-pay-${orderId}`,
        p_business_id: businessId,
        p_branch_id: branchId,
      });
      const elapsed = performance.now() - startedAt;
      paymentDurations.push(elapsed);
      if (result.error) {
        failures.push(`payment_failed order=${orderId} error=${result.error.message}`);
        return false;
      }
      return true;
    });

    const successfulPayments = paymentResults.filter(Boolean).length;

    const summaryTasks = Array.from({ length: summaryRuns }, (_, index) => index);
    await runWithConcurrency(summaryTasks, summaryConcurrency, async () => {
      const sample = createdOrderIds.slice(0, Math.min(300, createdOrderIds.length));
      if (sample.length === 0) {
        return;
      }
      const startedAt = performance.now();
      const result = await supabase.rpc("get_order_payment_summary", { p_order_ids: sample });
      const elapsed = performance.now() - startedAt;
      summaryDurations.push(elapsed);
      if (result.error) {
        failures.push(`summary_failed error=${result.error.message}`);
      }
    });

    console.log(
      `[scale:branches] config branches=${simulatedBranches} items_per_order=${itemsPerOrder} create_concurrency=${createConcurrency} payment_concurrency=${paymentConcurrency} summary_runs=${summaryRuns}`,
    );
    console.log(`[scale:branches] created_tables=${tableIds.length} created_orders=${createdOrderIds.length}`);
    console.log(`[scale:branches] successful_payments=${successfulPayments}/${createdOrderIds.length}`);
    console.log(`[scale:branches] ${summarizeDurations("order_create", createDurations)}`);
    console.log(`[scale:branches] ${summarizeDurations("payment_mutation", paymentDurations)}`);
    console.log(`[scale:branches] ${summarizeDurations("payment_summary_rpc", summaryDurations)}`);

    if (failures.length > 0) {
      console.log(`[scale:branches] failures=${failures.length}`);
      for (const failure of failures.slice(0, 20)) {
        console.log(`[scale:branches] failure_sample ${failure}`);
      }
      if (failures.length > 20) {
        console.log(`[scale:branches] failure_sample ... ${failures.length - 20} more`);
      }
      process.exitCode = 1;
    } else {
      console.log("[scale:branches] ok");
    }
  } finally {
    if (createdOrderIds.length > 0) {
      await supabase.from("payments").delete().in("order_id", createdOrderIds);
      await supabase.from("order_item_modifiers").delete().in("order_id", createdOrderIds);
      await supabase.from("order_items").delete().in("order_id", createdOrderIds);
      await supabase.from("orders").delete().in("id", createdOrderIds);
    }
    await supabase.from("tables").delete().in("id", tableIds);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
