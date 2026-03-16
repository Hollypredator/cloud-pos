import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintActions } from "@/components/print-actions";
import { requireRole } from "@/lib/auth";
import { getOrderReceipt } from "@/lib/domains/orders";

function orderSourceLabel(order: {
  channel?: string;
  table_number?: number;
  customer_name?: string | null;
}) {
  if (order.channel === "delivery") {
    return order.customer_name ? `Paket servis - ${order.customer_name}` : "Paket servis";
  }
  if (order.channel === "pickup") {
    return order.customer_name ? `Gel-al - ${order.customer_name}` : "Gel-al";
  }
  return `Masa ${order.table_number ?? "-"}`;
}

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

export default async function KitchenTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ layout?: string; station?: string; logo?: string }>;
}) {
  await requireRole(["admin", "kitchen"], "/admin/print-center");
  const { orderId } = await params;
  const { layout, station } = await searchParams;
  const { order } = await getOrderReceipt(orderId);

  if (!order) {
    notFound();
  }

  const compact = layout === "thermal58";
  const thermal = layout === "thermal" || compact;
  const stationName = station === "Bar" || station === "Tatli" ? station : "Mutfak";
  const stationTone =
    stationName === "Bar"
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : stationName === "Tatli"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-[#ffd5ca] bg-[#fff2ee] text-[#ff5a34]";

  return (
    <div className="print-root bg-slate-100 px-4 py-8">
      <main
        className={`print-card mx-auto rounded-2xl bg-white shadow-sm ${
          compact ? "max-w-[280px] p-3" : thermal ? "max-w-[340px] p-4" : "max-w-2xl p-6"
        }`}
      >
        <header className="border-b border-slate-200 pb-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Mutfak Siparis Fisi</p>
          <h1 className={`mt-2 font-semibold text-slate-900 ${thermal ? "text-xl" : "text-3xl"}`}>Siparis #{orderRef(order)}</h1>
          <p className="mt-2 text-sm text-slate-600">{orderSourceLabel(order)}</p>
          <p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleString("tr-TR")}</p>
          <div className="mt-3 flex justify-center">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${stationTone}`}>
              {stationName} Istasyonu
            </span>
          </div>
          {order.delivery_note ? <p className="mt-2 text-xs text-slate-500">Not: {order.delivery_note}</p> : null}
        </header>

        <div className="mt-4 space-y-3">
          {order.items.map((item, index) => (
            <div key={`${order.id}-${item.product_id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <span className={`font-semibold text-slate-900 ${thermal ? "text-base" : "text-lg"}`}>
                  {item.quantity}x {item.name}
                </span>
              </div>
              {item.modifiers?.length ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  {item.modifiers.map((modifier, modifierIndex) => (
                    <li key={`${order.id}-${item.product_id}-${modifier.group_name}-${modifier.option_name}-${modifierIndex}`}>
                      - {modifier.group_name}: {modifier.option_name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>

        <PrintActions baseHref={`/admin/print-center/kitchen/${order.id}`} />

        <div className="no-print mt-4">
          <Link href="/kitchen" className="text-sm font-medium text-slate-700 underline">
            Mutfaga Don
          </Link>
        </div>
      </main>
    </div>
  );
}
