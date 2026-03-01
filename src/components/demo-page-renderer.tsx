"use client";

import Link from "next/link";
import { PublicTopNav } from "@/components/public-top-nav";
import type { DemoPageContent, DemoSectionStyle } from "@/lib/demo";

type DemoRendererEditorOptions = {
  activeSectionId?: string | null;
  onSelectSection?: (id: string) => void;
  previewMode?: boolean;
};

type DemoSectionId =
  | "hero"
  | "metrics"
  | "presentation"
  | "accounts"
  | "orders"
  | "tables"
  | "stock"
  | "packages"
  | "closing";

const metrics = {
  openOrders: 12,
  pending: 4,
  preparing: 5,
  todayRevenue: 18450,
  occupiedTables: 9,
  emptyTables: 7,
};

const recentOrders = [
  { id: "DM-1024", table: 4, status: "pending", total: 780, time: "14:12" },
  { id: "DM-1023", table: 2, status: "preparing", total: 540, time: "14:09" },
  { id: "DM-1022", table: 7, status: "served", total: 920, time: "14:03" },
  { id: "DM-1021", table: 1, status: "paid", total: 360, time: "13:58" },
];

const lowStock = [
  { name: "Cheesecake", count: 3 },
  { name: "Cold Brew", count: 4 },
  { name: "Croissant", count: 5 },
];

function statusBadge(status: string) {
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "preparing") return "bg-sky-100 text-sky-800";
  if (status === "served") return "bg-emerald-100 text-emerald-800";
  if (status === "paid") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function getSurfaceClass(style: DemoSectionStyle) {
  if (style.surface === "white") return "bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]";
  if (style.surface === "glass")
    return "border border-white/70 bg-white/60 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur";
  if (style.surface === "dark") return "bg-slate-950 text-white shadow-[0_20px_60px_rgba(15,23,42,0.20)]";
  return "";
}

function wrapEditableSection(
  id: DemoSectionId,
  label: string,
  content: React.ReactNode,
  style: DemoSectionStyle,
  editor?: DemoRendererEditorOptions,
) {
  const isActive = editor?.activeSectionId === id;
  const chromePadding = style.surface === "transparent" ? 0 : 8;
  const sectionBody = (
    <div
      className={`overflow-hidden ${getSurfaceClass(style)}`}
      style={{
        paddingTop: style.paddingTop + chromePadding,
        paddingBottom: style.paddingBottom + chromePadding,
        paddingLeft: style.contentPadding + chromePadding,
        paddingRight: style.contentPadding + chromePadding,
        borderRadius: style.radius,
      }}
    >
      {content}
    </div>
  );

  if (!editor?.onSelectSection) {
    return <div key={id}>{sectionBody}</div>;
  }

  return (
    <div
      key={id}
      role="button"
      tabIndex={0}
      onClick={() => editor.onSelectSection?.(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          editor.onSelectSection?.(id);
        }
      }}
      className={`group relative rounded-[2rem] transition ${
        isActive
          ? "ring-4 ring-sky-500/45 ring-offset-4 ring-offset-transparent"
          : "hover:ring-2 hover:ring-sky-400/35 hover:ring-offset-2 hover:ring-offset-transparent"
      }`}
    >
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white shadow-lg">
        {label}
      </div>
      {sectionBody}
    </div>
  );
}

function renderHeaderActions(content: DemoPageContent, previewMode?: boolean) {
  if (previewMode) {
    return (
      <>
        <span className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white">
          Ana Sayfa
        </span>
        <span className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white">
          Blog
        </span>
        <span className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white">
          {content.opsCtaLabel}
        </span>
        <span className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950">
          {content.loginCtaLabel}
        </span>
      </>
    );
  }

  return (
    <>
      <PublicTopNav
        items={[
          { href: "/", label: "Ana Sayfa" },
          { href: "/blog", label: "Blog" },
          { href: "/ops", label: content.opsCtaLabel },
          { href: "/login", label: content.loginCtaLabel },
        ]}
        tone="dark"
      />
    </>
  );
}

export function DemoPageRenderer({
  content,
  editor,
}: {
  content: DemoPageContent;
  editor?: DemoRendererEditorOptions;
}) {
  const hasFlowColumn = content.showPresentationFlow;
  const hasAccountsColumn = content.showStaffAccounts;
  const presentationGridClass =
    hasFlowColumn && hasAccountsColumn ? "grid gap-6 xl:grid-cols-[1.1fr_0.9fr]" : "grid gap-6";

  const hasOrdersColumn = content.showRecentOrders;
  const hasSideColumn = content.showTableStatus || content.showLowStock;
  const operationsGridClass =
    hasOrdersColumn && hasSideColumn ? "grid gap-6 xl:grid-cols-[1.2fr_1fr]" : "grid gap-6";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef3f7_0%,#f7f2e8_100%)] px-4 py-8 md:px-10">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {wrapEditableSection(
          "hero",
          "hero",
          <header className="rounded-[2rem] bg-[linear-gradient(120deg,#020617_0%,#172554_48%,#334155_100%)] p-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">{content.heroEyebrow}</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight">{content.heroTitle}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{content.heroBody}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">
                  {content.previewBadge}
                </span>
                {renderHeaderActions(content, editor?.previewMode)}
              </div>
            </div>
          </header>,
          content.sectionStyles.hero,
          editor,
        )}

        {content.showMetrics
          ? wrapEditableSection(
              "metrics",
              "metric cards",
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Acik Siparis</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.openOrders}</p>
                </article>
                <article className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Pending</p>
                  <p className="mt-2 text-3xl font-semibold text-amber-700">{metrics.pending}</p>
                </article>
                <article className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Preparing</p>
                  <p className="mt-2 text-3xl font-semibold text-sky-700">{metrics.preparing}</p>
                </article>
                <article className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Bugun Ciro</p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-700">{metrics.todayRevenue.toFixed(2)} TL</p>
                </article>
              </section>,
              content.sectionStyles.metrics,
              editor,
            )
          : null}

        {content.showPresentationFlow || content.showStaffAccounts ? (
          <section className={presentationGridClass}>
            {content.showPresentationFlow
              ? wrapEditableSection(
                  "presentation",
                  "sunum akis",
                  <article className="rounded-2xl bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{content.flowEyebrow}</p>
                        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{content.flowTitle}</h2>
                      </div>
                      {editor?.previewMode ? (
                        <span className="text-sm font-medium text-slate-700 underline">Canli girise gec</span>
                      ) : (
                        <Link href="/login" className="text-sm font-medium text-slate-700 underline">
                          Canli girise gec
                        </Link>
                      )}
                    </div>
                    <div className="mt-6 grid gap-4">
                      {content.presentationFlow.map((item) => (
                        <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                        </article>
                      ))}
                    </div>
                  </article>,
                  content.sectionStyles.presentation,
                  editor,
                )
              : null}

            {content.showStaffAccounts
              ? wrapEditableSection(
                  "accounts",
                  "demo hesaplari",
                  <article className="rounded-2xl bg-white p-6 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{content.accountsEyebrow}</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">{content.accountsTitle}</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{content.accountsBody}</p>
                    <div className="mt-5 space-y-3">
                      {content.staffAccounts.map((account) => (
                        <article key={account.email} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{account.fullName}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">{account.role}</p>
                            </div>
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                              {account.password}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-slate-600">{account.email}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{account.summary}</p>
                        </article>
                      ))}
                    </div>
                  </article>,
                  content.sectionStyles.accounts,
                  editor,
                )
              : null}
          </section>
        ) : null}

        {content.showRecentOrders || content.showTableStatus || content.showLowStock ? (
          <section className={operationsGridClass}>
            {content.showRecentOrders
              ? wrapEditableSection(
                  "orders",
                  "siparis tablosu",
                  <article className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-slate-900">{content.recentOrdersTitle}</h2>
                      {editor?.previewMode ? (
                        <span className="text-sm font-medium text-slate-700 underline">{content.recentOrdersCtaLabel}</span>
                      ) : (
                        <Link href="/login" className="text-sm font-medium text-slate-700 underline">
                          {content.recentOrdersCtaLabel}
                        </Link>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2">Siparis</th>
                            <th className="py-2">Masa</th>
                            <th className="py-2">Durum</th>
                            <th className="py-2">Tutar</th>
                            <th className="py-2">Saat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentOrders.map((order) => (
                            <tr key={order.id} className="border-b border-slate-100">
                              <td className="py-2 font-medium text-slate-900">{order.id}</td>
                              <td className="py-2 text-slate-700">{order.table}</td>
                              <td className="py-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusBadge(order.status)}`}
                                >
                                  {order.status}
                                </span>
                              </td>
                              <td className="py-2 text-slate-700">{order.total.toFixed(2)} TL</td>
                              <td className="py-2 text-slate-700">{order.time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>,
                  content.sectionStyles.orders,
                  editor,
                )
              : null}

            {content.showTableStatus || content.showLowStock ? (
              <div className="space-y-6">
                {content.showTableStatus
                  ? wrapEditableSection(
                      "tables",
                      "masa durumu",
                      <article className="rounded-2xl bg-white p-5 shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-900">{content.tableStatusTitle}</h2>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-amber-50 p-3">
                            <p className="text-xs uppercase text-amber-700">Dolu</p>
                            <p className="mt-1 text-2xl font-semibold text-amber-800">{metrics.occupiedTables}</p>
                          </div>
                          <div className="rounded-xl bg-emerald-50 p-3">
                            <p className="text-xs uppercase text-emerald-700">Bos</p>
                            <p className="mt-1 text-2xl font-semibold text-emerald-800">{metrics.emptyTables}</p>
                          </div>
                        </div>
                      </article>,
                      content.sectionStyles.tables,
                      editor,
                    )
                  : null}

                {content.showLowStock
                  ? wrapEditableSection(
                      "stock",
                      "kritik stok",
                      <article className="rounded-2xl bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <h2 className="text-xl font-semibold text-slate-900">{content.lowStockTitle}</h2>
                          <span className="text-sm font-medium text-slate-500">{content.lowStockLabel}</span>
                        </div>
                        <ul className="space-y-2">
                          {lowStock.map((product) => (
                            <li key={product.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                              <span className="text-sm text-slate-700">{product.name}</span>
                              <span className="text-sm font-semibold text-rose-700">{product.count}</span>
                            </li>
                          ))}
                        </ul>
                      </article>,
                      content.sectionStyles.stock,
                      editor,
                    )
                  : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {content.showPackages
          ? wrapEditableSection(
              "packages",
              "paketler",
              <section className="grid gap-4 lg:grid-cols-3">
                {content.packages.map((item) => (
                  <article key={item.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.name}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{item.price}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.summary}</p>
                  </article>
                ))}
              </section>,
              content.sectionStyles.packages,
              editor,
            )
          : null}

        {content.showClosingCta
          ? wrapEditableSection(
              "closing",
              "kapanis cta",
              <section className="rounded-[2rem] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#22c55e_100%)] p-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="max-w-3xl">
                    <h2 className="text-3xl font-semibold tracking-tight">{content.closingCtaTitle}</h2>
                    <p className="mt-3 text-sm leading-7 text-white/80 sm:text-base">{content.closingCtaBody}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {editor?.previewMode ? (
                      <>
                        <span className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">
                          {content.closingCtaPrimaryLabel}
                        </span>
                        <span className="rounded-2xl border border-white/30 px-5 py-3 text-sm font-semibold text-white">
                          {content.closingCtaSecondaryLabel}
                        </span>
                      </>
                    ) : (
                      <>
                        <Link href="/login" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">
                          {content.closingCtaPrimaryLabel}
                        </Link>
                        <Link href="/demo" className="rounded-2xl border border-white/30 px-5 py-3 text-sm font-semibold text-white">
                          {content.closingCtaSecondaryLabel}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </section>,
              content.sectionStyles.closing,
              editor,
            )
          : null}
      </main>
    </div>
  );
}
