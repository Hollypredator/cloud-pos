import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  throw new Error(`[phase9:concurrency] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

async function run() {
  if (!url || !serviceRoleKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanimli degil.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: branchRow, error: branchError }, { data: tableNumberRow }] = await Promise.all([
    supabase.from("branches").select("id, business_id").eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("tables").select("table_number").order("table_number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (branchError || !branchRow) {
    fail(`aktif sube bulunamadi: ${branchError?.message ?? "branch yok"}`);
  }

  const businessId = String(branchRow.business_id);
  const branchId = String(branchRow.id);
  const tempTableNumber = Number(tableNumberRow?.table_number ?? 1000) + Math.floor(Math.random() * 1000) + 1;
  const tempQr = `phase9-${crypto.randomUUID()}`;

  const { data: createdTable, error: createTableError } = await supabase
    .from("tables")
    .insert({
      business_id: businessId,
      branch_id: branchId,
      table_number: tempTableNumber,
      name: `Phase9 Test ${tempTableNumber}`,
      status: "empty",
      qr_code_identifier: tempQr,
    })
    .select("id")
    .single();
  if (createTableError || !createdTable) {
    fail(`test masasi olusturulamadi: ${createTableError?.message ?? "unknown"}`);
  }

  const tableId = String(createdTable.id);
  let orderIdForCleanup = null;
  const firstRequestItems = [
    {
      product_id: "",
      name: "Phase9 Item A",
      quantity: 1,
      unit_price: 60,
      line_total: 60,
      modifiers: [],
    },
  ];
  const secondRequestItems = [
    {
      product_id: "",
      name: "Phase9 Item B",
      quantity: 1,
      unit_price: 40,
      line_total: 40,
      modifiers: [],
    },
  ];

  try {
    const [createA, createB] = await Promise.all([
      supabase.rpc("create_or_append_order", {
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
        p_total_price: 60,
        p_items: firstRequestItems,
      }),
      supabase.rpc("create_or_append_order", {
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
        p_total_price: 40,
        p_items: secondRequestItems,
      }),
    ]);

    if (createA.error || createB.error) {
      fail(`create_or_append_order race testi basarisiz: ${createA.error?.message ?? createB.error?.message}`);
    }

    const createdA = (createA.data ?? [])[0];
    const createdB = (createB.data ?? [])[0];
    const orderIdA = String(createdA?.order_id ?? "");
    const orderIdB = String(createdB?.order_id ?? "");
    assert(orderIdA.length > 0 && orderIdA === orderIdB, "eszamanli siparis acmada ayni adisyona append edilmedi");
    orderIdForCleanup = orderIdA;

    const [payA, payB] = await Promise.all([
      supabase.rpc("apply_order_payment_mutation", {
        p_order_id: orderIdForCleanup,
        p_payment_type: "sale",
        p_method: "cash",
        p_amount: 70,
        p_note: "phase9-pay-a",
        p_created_by: null,
        p_idempotency_key: null,
        p_business_id: businessId,
        p_branch_id: branchId,
      }),
      supabase.rpc("apply_order_payment_mutation", {
        p_order_id: orderIdForCleanup,
        p_payment_type: "sale",
        p_method: "cash",
        p_amount: 70,
        p_note: "phase9-pay-b",
        p_created_by: null,
        p_idempotency_key: null,
        p_business_id: businessId,
        p_branch_id: branchId,
      }),
    ]);

    if (payA.error || payB.error) {
      fail(`odeme rpc testi basarisiz: ${payA.error?.message ?? payB.error?.message}`);
    }

    const payRows = [payA, payB].map((item) => (item.data ?? [])[0] ?? null);
    const appliedPaymentCount = payRows.filter((row) => row?.applied === true).length;
    assert(appliedPaymentCount === 1, `eszamanli odemede beklenen 1 uygulama yerine ${appliedPaymentCount} uygulama oldu`);

    const [refundA, refundB] = await Promise.all([
      supabase.rpc("apply_order_payment_mutation", {
        p_order_id: orderIdForCleanup,
        p_payment_type: "refund",
        p_method: "cash",
        p_amount: 50,
        p_note: "phase9-refund-a",
        p_created_by: null,
        p_idempotency_key: null,
        p_business_id: businessId,
        p_branch_id: branchId,
      }),
      supabase.rpc("apply_order_payment_mutation", {
        p_order_id: orderIdForCleanup,
        p_payment_type: "refund",
        p_method: "cash",
        p_amount: 50,
        p_note: "phase9-refund-b",
        p_created_by: null,
        p_idempotency_key: null,
        p_business_id: businessId,
        p_branch_id: branchId,
      }),
    ]);

    if (refundA.error || refundB.error) {
      fail(`iade rpc testi basarisiz: ${refundA.error?.message ?? refundB.error?.message}`);
    }

    const refundRows = [refundA, refundB].map((item) => (item.data ?? [])[0] ?? null);
    const appliedRefundCount = refundRows.filter((row) => row?.applied === true).length;
    assert(appliedRefundCount === 1, `eszamanli iadede beklenen 1 uygulama yerine ${appliedRefundCount} uygulama oldu`);

    const { data: paymentRows, error: paymentRowsError } = await supabase
      .from("payments")
      .select("payment_type, amount")
      .eq("order_id", orderIdForCleanup);
    if (paymentRowsError) {
      fail(`payment toplam kontrolu basarisiz: ${paymentRowsError.message}`);
    }
    const net = (paymentRows ?? []).reduce((sum, row) => {
      const amount = Number(row.amount ?? 0);
      return sum + (row.payment_type === "refund" ? -amount : amount);
    }, 0);
    assert(net >= -0.009, `net tutar negatif oldu: ${net.toFixed(2)}`);

    console.log("[phase9:concurrency] ok");
  } finally {
    if (orderIdForCleanup) {
      await supabase.from("orders").delete().eq("id", orderIdForCleanup);
    }
    await supabase.from("tables").delete().eq("id", tableId);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
