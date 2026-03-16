import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintActions } from "@/components/print-actions";
import { getOrderReceipt } from "@/lib/data";

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

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ layout?: string; logo?: string }>;
}) {
  const { orderId } = await params;
  const { layout, logo } = await searchParams;
  const { order } = await getOrderReceipt(orderId);
  if (!order) {
    notFound();
  }
  const compact = layout === "thermal58";
  const thermal = layout === "thermal" || compact;
  const hideLogo = logo === "0";

  const subtotal = Number(order.total_price);
  const discount = Number(order.discount_amount ?? 0);
  const serviceFee = Number(order.service_fee ?? 0);
  const final = Number(order.final_price ?? order.total_price);
  const paid = Number(order.amount_paid ?? 0);
  const remaining = Number(order.remaining_balance ?? Math.max(0, final - paid));
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Cloud POS";
  const businessPhone = process.env.NEXT_PUBLIC_BUSINESS_PHONE || "";
  const businessAddress = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "";
  const receiptFooter = process.env.NEXT_PUBLIC_RECEIPT_FOOTER || "Bizi tercih ettiginiz icin tesekkur ederiz.";
  const logoUrl = process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || "";
  const vatRate = Math.max(0, Number(process.env.NEXT_PUBLIC_VAT_RATE ?? 10));
  const vatIncludedAmount = vatRate > 0 ? final - final / (1 + vatRate / 100) : 0;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <main className={`print-card mx-auto w-full rounded-2xl bg-white shadow-sm ${compact ? "max-w-[280px] p-3" : thermal ? "max-w-[340px] p-4" : "max-w-2xl p-6"}`}>
        <header className="mb-4 border-b border-slate-200 pb-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h1 className={`${compact ? "text-lg" : thermal ? "text-xl" : "text-2xl"} font-semibold leading-none text-slate-900`}>{businessName}</h1>
              <p className={`${compact ? "mt-1 text-[10px]" : "text-sm"} text-slate-600`}>{thermal ? "Fis" : "Adisyon"}</p>
            </div>
            {logoUrl && !hideLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="isletme logo" className={`${compact ? "h-8 w-8" : "h-12 w-12"} rounded object-cover`} />
            ) : null}
          </div>
          {businessPhone ? <p className={`${compact ? "text-[10px]" : "text-xs"} text-slate-600`}>Tel: {businessPhone}</p> : null}
          {businessAddress ? <p className={`${compact ? "text-[10px]" : "text-xs"} break-words text-slate-600`}>{businessAddress}</p> : null}
          <p className={`${compact ? "text-[11px]" : "text-sm"} break-words text-slate-600`}>Siparis #{orderRef(order)} - {orderSourceLabel(order)}</p>
          {order.customer_phone ? <p className={`${compact ? "text-[10px]" : "text-xs"} text-slate-600`}>Telefon: {order.customer_phone}</p> : null}
          {order.delivery_address ? <p className={`${compact ? "text-[10px] leading-tight" : "text-xs"} break-words text-slate-600`}>{order.delivery_address}</p> : null}
          <p className={`${compact ? "text-[10px]" : "text-xs"} text-slate-500`}>{new Date(order.created_at).toLocaleString("tr-TR")}</p>
        </header>

        <ul className={compact ? "space-y-1.5" : "space-y-2"}>
          {order.items.map((item, index) => (
            <li key={`${order.id}-${item.product_id}-${index}`} className={compact ? "text-xs" : "text-sm"}>
              <div className="flex items-start justify-between gap-3">
                <span className={`min-w-0 break-words text-slate-700 ${compact ? "pr-2 leading-tight" : ""}`}>
                  {item.quantity}x {item.name}
                </span>
                <span className={`shrink-0 font-medium text-slate-900 ${compact ? "text-[11px]" : ""}`}>{Number(item.line_total).toFixed(2)} TL</span>
              </div>
              {item.modifiers?.length ? (
                <div className={`mt-1 text-slate-500 ${compact ? "text-[10px] leading-tight" : "text-xs"}`}>
                  {item.modifiers.map((modifier) => `${modifier.group_name}: ${modifier.option_name}`).join(" / ")}
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        <div className={`mt-4 border-t border-slate-200 pt-4 ${compact ? "text-xs" : "text-sm"}`}>
          <p className="flex justify-between">
            <span>Ara Toplam</span>
            <span>{subtotal.toFixed(2)} TL</span>
          </p>
          <p className="mt-1 flex justify-between">
            <span>Indirim</span>
            <span>-{discount.toFixed(2)} TL</span>
          </p>
          <p className="mt-1 flex justify-between">
            <span>Servis Ucreti</span>
            <span>+{serviceFee.toFixed(2)} TL</span>
          </p>
          <p className={`mt-2 flex justify-between font-semibold text-slate-900 ${compact ? "text-sm" : "text-base"}`}>
            <span>Toplam</span>
            <span>{final.toFixed(2)} TL</span>
          </p>
          <p className={`mt-1 flex justify-between text-slate-600 ${compact ? "text-[11px]" : "text-sm"}`}>
            <span>Odenen</span>
            <span>{paid.toFixed(2)} TL</span>
          </p>
          <p className={`mt-1 flex justify-between font-semibold text-rose-700 ${compact ? "text-[11px]" : "text-sm"}`}>
            <span>Kalan</span>
            <span>{remaining.toFixed(2)} TL</span>
          </p>
          {remaining > 0 ? (
            <div className={`mt-3 rounded-lg bg-slate-50 text-slate-600 ${compact ? "p-2 text-[10px]" : "p-3 text-xs"}`}>
              <p className="font-semibold text-slate-700">Adisyon Bolunmus Tutarlar</p>
              <p className="mt-2">2 kisi: {(remaining / 2).toFixed(2)} TL</p>
              <p>3 kisi: {(remaining / 3).toFixed(2)} TL</p>
              <p>4 kisi: {(remaining / 4).toFixed(2)} TL</p>
            </div>
          ) : null}
          {vatRate > 0 ? (
            <p className={`mt-1 flex justify-between text-slate-500 ${compact ? "text-[10px]" : "text-xs"}`}>
              <span>KDV ({vatRate}% dahil)</span>
              <span>{vatIncludedAmount.toFixed(2)} TL</span>
            </p>
          ) : null}
        </div>

        <p className={`mt-4 text-center text-slate-500 ${compact ? "text-[10px] leading-tight" : "text-xs"}`}>{receiptFooter}</p>

        <div className="mt-5">
          <PrintActions baseHref={`/receipt/${order.id}`} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Link href="/ops" className="w-full text-sm font-medium text-slate-700 underline sm:w-auto">
            Ana Panele Don
          </Link>
        </div>
      </main>
    </div>
  );
}
