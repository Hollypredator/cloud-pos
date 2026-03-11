import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getFinancialInsights, getOpsMetricsSnapshot, getSalesReportSummary } from "@/lib/domains/finance";
import { listBranches, listProfileRoleCounts } from "@/lib/data";
import { ALL_BRANCHES_VALUE } from "@/lib/business";
import {
  BackofficePage,
  ContentCard,
  EmptyPanel,
  FeatureLockedState,
  FilterButton,
  SegmentedTabs,
  SidebarPanel,
  SummaryCard,
} from "@/components/backoffice-ui";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getFeatureAccess } from "@/lib/plan-access";

type ReportTab = "general" | "cari" | "detail" | "staff";

function dayLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function paymentTypeLabel(method: string) {
  if (method === "cash") return "Nakit";
  if (method === "card") return "Kart";
  if (method === "mixed") return "Karma";
  return method;
}

function buildPolylinePoints(values: number[], width: number, height: number) {
  if (values.length === 0) return "";
  const max = Math.max(1, ...values);
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (Math.max(0, value) / max) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function buildAreaPoints(values: number[], width: number, height: number) {
  const line = buildPolylinePoints(values, width, height);
  if (!line) return "";
  return `0,${height} ${line} ${width},${height}`;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: Array<{ value: number; color: string; label: string }>;
  centerLabel: string;
  centerValue: string;
}) {
  const total = Math.max(1, segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0));
  const arcSegments = segments.reduce<Array<{ label: string; color: string; startAngle: number; endAngle: number; value: number }>>(
    (acc, segment) => {
      const previousEnd = acc[acc.length - 1]?.endAngle ?? 0;
      const sweep = (Math.max(0, segment.value) / total) * 360;
      acc.push({
        label: segment.label,
        color: segment.color,
        value: segment.value,
        startAngle: previousEnd,
        endAngle: previousEnd + sweep,
      });
      return acc;
    },
    [],
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 220 220" className="h-56 w-56">
        <circle cx="110" cy="110" r="70" fill="none" stroke="#e5e7eb" strokeWidth="22" />
        {arcSegments.map((segment) => {
          if (segment.endAngle - segment.startAngle <= 0) return null;
          return (
            <path
              key={segment.label}
              d={describeArc(110, 110, 70, segment.startAngle, segment.endAngle)}
              fill="none"
              stroke={segment.color}
              strokeWidth="22"
              strokeLinecap="round"
            />
          );
        })}
        <circle cx="110" cy="110" r="48" fill="#ffffff" />
        <text x="110" y="98" textAnchor="middle" fontSize="12" fill="#64748b">
          {centerLabel}
        </text>
        <text x="110" y="122" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0f172a">
          {centerValue}
        </text>
      </svg>
      <div className="grid w-full gap-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-slate-700">{segment.label}</span>
            </div>
            <span className="font-numeric font-semibold text-slate-900">{segment.value.toFixed(2)} TL</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; days?: string }>;
}) {
  try {
    await requireRole(["admin"], "/admin/reports");
    const locale = await getCurrentLocale();
    const featureAccessResult = await measureAsync("feature_access", () => getFeatureAccess("advanced_reports"));
    const featureAccess = featureAccessResult.value;
    if (!featureAccess.enabled) {
      logServerPerf("/admin/reports", [featureAccessResult]);
      return (
        <BackofficePage title={translateUiText("Raporlar", locale)} description={translateUiText("Satis, cari ve personel performansi", locale)}>
          <FeatureLockedState
            title={featureAccess.title}
            description={featureAccess.description}
            currentPlan={featureAccess.plan}
            requiredPlan={featureAccess.requiredPlan}
          />
        </BackofficePage>
      );
    }
    const { tab: tabParam, days: daysParam } = await searchParams;
    const days = Number.isFinite(Number(daysParam)) ? Number(daysParam) : 7;
    const activeTab: ReportTab =
      tabParam === "cari" || tabParam === "detail" || tabParam === "staff" ? tabParam : "general";
    const shouldLoadFinancial = activeTab === "cari" || activeTab === "detail";
    const shouldLoadStaff = activeTab === "staff";

    const safeOpsPromise = shouldLoadStaff
      ? measureAsync("ops_metrics", () => getOpsMetricsSnapshot()).catch((error) => {
          console.error("[admin-reports-page] ops_metrics failed", error);
          return {
            label: "ops_metrics",
            ms: 0,
            value: {
              pendingOrders: 0,
              servedOrders: 0,
              openServiceRequests: 0,
            },
          };
        })
      : Promise.resolve({
          label: "ops_metrics",
          ms: 0,
          value: {
            pendingOrders: 0,
            servedOrders: 0,
            openServiceRequests: 0,
          },
        });

    const safeRoleCountsPromise = shouldLoadStaff
      ? measureAsync("profile_role_counts", () => listProfileRoleCounts()).catch((error) => {
          console.error("[admin-reports-page] profile_role_counts failed", error);
          return {
            label: "profile_role_counts",
            ms: 0,
            value: {
              counts: { owner: 0, admin: 0, cashier: 0, kitchen: 0, waiter: 0 },
              usingDemoData: false,
            },
          };
        })
      : Promise.resolve({
          label: "profile_role_counts",
          ms: 0,
          value: {
            counts: { owner: 0, admin: 0, cashier: 0, kitchen: 0, waiter: 0 },
            usingDemoData: false,
          },
        });

    const [salesResult, financialResult, opsResult, roleCountsResult, branchContextResult] = await Promise.all([
      measureAsync("sales_report_summary", () => getSalesReportSummary(days)),
      shouldLoadFinancial
        ? measureAsync("financial_insights", () => getFinancialInsights(days))
        : Promise.resolve({
          label: "financial_insights",
          ms: 0,
          value: {
            usingDemoData: false,
            summary: {
              grossSales: 0,
              refunds: 0,
              netSales: 0,
              discountTotal: 0,
              serviceFeeTotal: 0,
              paidOrderCount: 0,
              averageTicket: 0,
              outstandingReceivables: 0,
              cancelledCount: 0,
            },
            methodBreakdown: [] as Array<{ method: string; sales: number; refunds: number; net: number }>,
            hourlySales: [] as Array<{ hour: string; sales: number }>,
            topProducts: [] as Array<{ productName: string; qty: number; revenue: number }>,
            recentPayments: [] as Array<{
              id: string;
              order_id: string;
              payment_type: string;
              method: string;
              amount: number;
              note: string | null;
              created_at: string;
            }>,
          },
        }),
      safeOpsPromise,
      safeRoleCountsPromise,
      measureAsync("list_branches", () => listBranches()),
    ]);
    const { rows, usingDemoData } = salesResult.value;
    const financial = financialResult.value;
    const ops = opsResult.value;
    const { counts: roleCounts } = roleCountsResult.value;
    const branchContext = branchContextResult.value;
    logServerPerf("/admin/reports", [featureAccessResult, salesResult, financialResult, opsResult, roleCountsResult, branchContextResult]);
  const branchLabel =
    branchContext.activeBranchId === ALL_BRANCHES_VALUE
      ? translateUiText("Tum Subeler", locale)
      : branchContext.branches.find((branch) => branch.id === branchContext.activeBranchId)?.name ?? translateUiText("Aktif Sube", locale);

  const totalSales = rows.reduce((sum, row) => sum + row.sales, 0);
  const totalRefunds = rows.reduce((sum, row) => sum + row.refunds, 0);
  const net = totalSales - totalRefunds;
  const average = rows.length > 0 ? net / rows.length : 0;
  const bestDay = rows.reduce((best, row) => (row.net > (best?.net ?? -Infinity) ? row : best), rows[0]);
  const maxNet = Math.max(1, ...rows.map((row) => row.net));
    return (
    <BackofficePage
      title={translateUiText("Raporlar", locale)}
      description={translateUiText("Satis ritmi, iade etkisi ve net performansi hizli okumak icin tasarlandi", locale)}
      sidebar={
        <SidebarPanel title={translateUiText("Filtreler", locale)} description={translateUiText("Donem ve gorunum secimi", locale)}>
          <div className="grid gap-2 sm:grid-cols-2">
            <FilterButton>{translateUiText("Donem", locale)}</FilterButton>
            <FilterButton active>{translateUiText("Tarih", locale)}</FilterButton>
          </div>

          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-800">{translateUiText("Tarih Araligi", locale)}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <FilterButton>{translateUiText("Bugun", locale)}</FilterButton>
              <FilterButton>{translateUiText("Dun", locale)}</FilterButton>
              <FilterButton active>{translateUiText("Son 7 Gun", locale)}</FilterButton>
              <FilterButton>{translateUiText("Son 30 Gun", locale)}</FilterButton>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-800">{translateUiText("Satis Kanali", locale)}</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{translateUiText("Tum Kanallar", locale)}</div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-[#fbfbfc] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Hizli Ozet", locale)}</p>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-white px-3 py-3">
                <span>{translateUiText("Net Satis", locale)}</span>
                <span className="font-semibold text-emerald-700">{net.toFixed(2)} TL</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-3 py-3">
                <span>{translateUiText("En Iyi Gun", locale)}</span>
                <span className="font-semibold text-slate-900">{bestDay ? dayLabel(bestDay.day) : "-"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-3 py-3">
                <span>{translateUiText("Ortalama", locale)}</span>
                <span className="font-semibold text-slate-900">{average.toFixed(2)} TL</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button type="button" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
              {translateUiText("Filtreleri Uygula", locale)}
            </button>
            <button type="button" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              {translateUiText("Sifirla", locale)}
            </button>
          </div>
        </SidebarPanel>
      }
      actions={
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-center">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">
              {new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            <p className="text-sm text-slate-500">{branchLabel}</p>
          </div>
          <a href={`/api/reports/sales.csv?days=${days}`} className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            {translateUiText("Excel", locale)}
          </a>
          <Link href={`/admin/finance?days=${days}`} className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            {translateUiText("Finans", locale)}
          </Link>
        </>
      }
    >
      <SegmentedTabs
        tabs={[
          { label: translateUiText("Genel", locale), active: activeTab === "general", href: `/admin/reports?tab=general&days=${days}` },
          { label: translateUiText("Cari", locale), active: activeTab === "cari", href: `/admin/reports?tab=cari&days=${days}` },
          { label: translateUiText("Detay", locale), active: activeTab === "detail", href: `/admin/reports?tab=detail&days=${days}` },
          { label: translateUiText("Personel", locale), active: activeTab === "staff", href: `/admin/reports?tab=staff&days=${days}` },
        ]}
      />

      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {translateUiText("Demo modda rapor verisi sinirlidir.", locale)}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label={translateUiText("Brut Satis", locale)} value={`${totalSales.toFixed(2)} TL`} hint={translateUiText("Toplam giren satis", locale)} tone="accent" />
        <SummaryCard label={translateUiText("Iade", locale)} value={`${totalRefunds.toFixed(2)} TL`} hint={translateUiText("Donemsel cikan tutar", locale)} tone="danger" />
        <SummaryCard label={translateUiText("Net Satis", locale)} value={`${net.toFixed(2)} TL`} hint={translateUiText("Gercek donem sonucu", locale)} tone="success" />
        <SummaryCard label={translateUiText("Gunluk Ort", locale)} value={`${average.toFixed(2)} TL`} hint={translateUiText("7 gunluk net ortalama", locale)} />
      </section>

      {activeTab === "general" ? (
        <>
      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <ContentCard title={translateUiText("Net Satis Grafigi", locale)}>
          {rows.length === 0 ? (
            <EmptyPanel title={translateUiText("Kayit Yok", locale)} description={translateUiText("Secilen filtrelerde rapor verisi bulunamadi.", locale)} />
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <svg viewBox="0 0 720 260" className="h-[260px] w-full">
                <defs>
                  <linearGradient id="report-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ff5a34" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2cb67d" stopOpacity="0.05" />
                  </linearGradient>
                  <linearGradient id="report-line" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#ff5a34" />
                    <stop offset="50%" stopColor="#f0b14f" />
                    <stop offset="100%" stopColor="#2cb67d" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3].map((line) => (
                  <line key={line} x1="0" x2="720" y1={40 + line * 55} y2={40 + line * 55} stroke="#dbe1ea" strokeDasharray="6 8" />
                ))}
                <polygon points={buildAreaPoints(rows.map((row) => row.net), 720, 220)} fill="url(#report-area)" transform="translate(0,20)" />
                <polyline
                  points={buildPolylinePoints(rows.map((row) => row.net), 720, 220)}
                  fill="none"
                  stroke="url(#report-line)"
                  strokeWidth="6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  transform="translate(0,20)"
                />
                {rows.map((row, index) => {
                  const x = rows.length === 1 ? 0 : (720 / (rows.length - 1)) * index;
                  const y = 20 + (220 - (Math.max(0, row.net) / maxNet) * 220);
                  return (
                    <g key={row.day}>
                      <circle cx={x} cy={y} r="7" fill="#ffffff" stroke="#ff5a34" strokeWidth="4" />
                      <text x={x} y="254" textAnchor="middle" fontSize="14" fill="#64748b">
                        {dayLabel(row.day)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </ContentCard>

        <ContentCard title={translateUiText("Performans Notlari", locale)}>
          <div className="space-y-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("En Iyi Gun", locale)}</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                {bestDay ? `${dayLabel(bestDay.day)} - ${bestDay.net.toFixed(2)} TL` : translateUiText("Kayit yok", locale)}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Iade Etkisi", locale)}</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-rose-700">
                %{totalSales > 0 ? ((totalRefunds / totalSales) * 100).toFixed(1) : "0.0"}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Net Momentum", locale)}</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                {rows.length >= 2 && rows[rows.length - 1].net >= rows[rows.length - 2].net ? translateUiText("Yukselen", locale) : translateUiText("Dalgalanan", locale)}
              </p>
            </div>
          </div>
        </ContentCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ContentCard title={translateUiText("Gun Bazli Dagilim", locale)}>
          {rows.length === 0 ? (
            <EmptyPanel title={translateUiText("Kayit Yok", locale)} description={translateUiText("Gun bazli tablo gosterilemiyor.", locale)} />
          ) : (
            <div className="responsive-table-shell rounded-[22px] border border-slate-200">
              <table className="responsive-table w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">{translateUiText("Gun", locale)}</th>
                    <th className="px-4 py-4 font-semibold">{translateUiText("Satis", locale)}</th>
                    <th className="px-4 py-4 font-semibold">{translateUiText("Iade", locale)}</th>
                    <th className="px-4 py-4 font-semibold">{translateUiText("Net", locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.day} className="border-t border-slate-100">
                      <td className="px-4 py-4 font-medium text-slate-900">{dayLabel(row.day)}</td>
                      <td className="px-4 py-4 text-slate-700">{row.sales.toFixed(2)} TL</td>
                      <td className="px-4 py-4 text-rose-600">{row.refunds.toFixed(2)} TL</td>
                      <td className="px-4 py-4 font-semibold text-emerald-700">{row.net.toFixed(2)} TL</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ContentCard>

        <ContentCard title={translateUiText("Hizli Yorum", locale)}>
          <div className="grid gap-3">
            {rows.map((row) => (
              <div key={row.day} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{dayLabel(row.day)}</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{row.net.toFixed(2)} TL net</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.net >= average ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {row.net >= average ? translateUiText("Ortalama Ustu", locale) : translateUiText("Ortalama Alti", locale)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ContentCard>
      </section>
        </>
      ) : null}

      {activeTab === "cari" ? (
        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <ContentCard title={translateUiText("Cari Odeme Dagilimi", locale)}>
            {financial.methodBreakdown.length === 0 ? (
              <EmptyPanel title={translateUiText("Cari Veri Yok", locale)} description={translateUiText("Secilen aralikta tahsilat hareketi bulunmuyor.", locale)} />
            ) : (
              <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
                <DonutChart
                  centerLabel={translateUiText("Cari Net", locale)}
                  centerValue={`${financial.summary.netSales.toFixed(0)} TL`}
                  segments={financial.methodBreakdown.map((row, index) => ({
                    label: paymentTypeLabel(row.method),
                    value: Math.max(0, row.net),
                    color: index === 0 ? "#ff6a3d" : index === 1 ? "#0f766e" : "#475569",
                  }))}
                />
                <div className="space-y-3">
                  {financial.methodBreakdown.map((row, index) => {
                    const totalNet = Math.max(1, financial.methodBreakdown.reduce((sum, item) => sum + Math.max(0, item.net), 0));
                    const width = Math.max(8, (Math.max(0, row.net) / totalNet) * 100);
                    return (
                      <div key={row.method} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">{paymentTypeLabel(row.method)}</p>
                            <p className="mt-1 text-sm text-slate-500">{translateUiText("Gelir / iade / net bakiye", locale)}</p>
                          </div>
                          <p className="font-display font-numeric text-xl font-semibold text-slate-900">{row.net.toFixed(2)} TL</p>
                        </div>
                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                          <div
                            className={`h-3 rounded-full ${index % 2 === 0 ? "bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f]" : "bg-gradient-to-r from-[#0f766e] to-[#34d399]"}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                          <span>{translateUiText("Gelir", locale)} <span className="font-numeric font-semibold text-emerald-700">{row.sales.toFixed(2)}</span></span>
                          <span>{translateUiText("Iade", locale)} <span className="font-numeric font-semibold text-rose-700">{row.refunds.toFixed(2)}</span></span>
                          <span>{translateUiText("Net", locale)} <span className="font-numeric font-semibold text-slate-900">{row.net.toFixed(2)}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ContentCard>

          <ContentCard title={translateUiText("Tahsilat Hareketleri", locale)}>
            {financial.recentPayments.length === 0 ? (
              <EmptyPanel title={translateUiText("Hareket Yok", locale)} description={translateUiText("Cari sekmesi icin listelenecek son hareket bulunmuyor.", locale)} />
            ) : (
              <div className="responsive-table-shell max-h-[520px] overflow-y-auto rounded-[22px] border border-slate-200">
                <table className="responsive-table w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">{translateUiText("Saat", locale)}</th>
                      <th className="px-4 py-4 font-semibold">{translateUiText("Tip", locale)}</th>
                      <th className="px-4 py-4 font-semibold">{translateUiText("Yontem", locale)}</th>
                      <th className="px-4 py-4 font-semibold">{translateUiText("Tutar", locale)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financial.recentPayments.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="font-numeric px-4 py-4 text-slate-700">{new Date(row.created_at).toLocaleString("tr-TR")}</td>
                        <td className="px-4 py-4 text-slate-700">{row.payment_type}</td>
                        <td className="px-4 py-4 text-slate-700">{paymentTypeLabel(row.method)}</td>
                        <td className={`font-display font-numeric px-4 py-4 font-semibold ${row.payment_type === "refund" ? "text-rose-700" : "text-emerald-700"}`}>
                          {row.amount.toFixed(2)} TL
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ContentCard>
        </section>
      ) : null}

      {activeTab === "detail" ? (
        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <ContentCard title={translateUiText("Urun Performansi", locale)}>
            {financial.topProducts.length === 0 ? (
              <EmptyPanel title={translateUiText("Detay Veri Yok", locale)} description={translateUiText("Top urun performansi icin veri bulunmuyor.", locale)} />
            ) : (
              <div className="space-y-3">
                {financial.topProducts.map((row, index) => {
                  const maxRevenue = Math.max(1, ...financial.topProducts.map((item) => item.revenue));
                  return (
                    <div key={row.productName} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{row.productName}</p>
                          <p className="mt-1 text-sm text-slate-500">{row.qty} {translateUiText("adet satis", locale)}</p>
                        </div>
                        <p className="font-display font-numeric text-lg font-semibold text-emerald-700">{row.revenue.toFixed(2)} TL</p>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-2 rounded-full ${index % 2 === 0 ? "bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f]" : "bg-gradient-to-r from-[#0f766e] to-[#34d399]"}`}
                          style={{ width: `${Math.max(8, (row.revenue / maxRevenue) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ContentCard>

          <ContentCard title={translateUiText("Gun Bazli Detay", locale)}>
            {rows.length === 0 ? (
              <EmptyPanel title={translateUiText("Gunluk Detay Yok", locale)} description={translateUiText("Gun bazli detay tablosu gosterilemiyor.", locale)} />
            ) : (
              <div className="responsive-table-shell rounded-[22px] border border-slate-200">
                <table className="responsive-table w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">{translateUiText("Gun", locale)}</th>
                      <th className="px-4 py-4 font-semibold">{translateUiText("Satis", locale)}</th>
                      <th className="px-4 py-4 font-semibold">{translateUiText("Iade", locale)}</th>
                      <th className="px-4 py-4 font-semibold">{translateUiText("Net", locale)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.day} className="border-t border-slate-100">
                        <td className="px-4 py-4 font-medium text-slate-900">{dayLabel(row.day)}</td>
                        <td className="font-numeric px-4 py-4 text-slate-700">{row.sales.toFixed(2)} TL</td>
                        <td className="font-numeric px-4 py-4 text-rose-600">{row.refunds.toFixed(2)} TL</td>
                        <td className="font-display font-numeric px-4 py-4 font-semibold text-emerald-700">{row.net.toFixed(2)} TL</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ContentCard>
        </section>
      ) : null}

      {activeTab === "staff" ? (
        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <ContentCard title={translateUiText("Personel Dagilimi", locale)}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard label={translateUiText("Patron", locale)} value={String(roleCounts.owner)} hint={translateUiText("Tum subeler", locale)} tone="accent" />
              <SummaryCard label={translateUiText("Yonetici", locale)} value={String(roleCounts.admin)} hint={translateUiText("Atanmis sube", locale)} />
              <SummaryCard label={translateUiText("Kasa", locale)} value={String(roleCounts.cashier)} hint={translateUiText("Tahsilat", locale)} />
              <SummaryCard label={translateUiText("Mutfak", locale)} value={String(roleCounts.kitchen)} hint={translateUiText("Hazirlama", locale)} tone="danger" />
              <SummaryCard label={translateUiText("Servis", locale)} value={String(roleCounts.waiter)} hint={translateUiText("Masa operasyonu", locale)} tone="success" />
            </div>
          </ContentCard>

          <ContentCard title={translateUiText("Operasyon Yuku", locale)}>
            <div className="grid gap-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Mutfak Bekleyen", locale)}</p>
                <p className="font-display font-numeric mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{ops.pendingOrders}</p>
                <p className="mt-2 text-sm text-slate-500">{translateUiText("Vardiyada mutfaga bekleyen is", locale)}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Kasada Bekleyen", locale)}</p>
                <p className="font-display font-numeric mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{ops.servedOrders}</p>
                <p className="mt-2 text-sm text-slate-500">{translateUiText("Tahsilat bekleyen adisyon", locale)}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Masa Talepleri", locale)}</p>
                <p className="font-display font-numeric mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{ops.openServiceRequests}</p>
                <p className="mt-2 text-sm text-slate-500">{translateUiText("Garson ve hesap talepleri", locale)}</p>
              </div>
            </div>
          </ContentCard>
        </section>
      ) : null}
    </BackofficePage>
    );
  } catch (error) {
    console.error("[admin-reports-page] failed", error);
    return (
      <BackofficePage title="Raporlar" description="Satis, cari ve personel performansi">
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {translateUiText("Rapor verileri yuklenemedi. Lutfen biraz sonra tekrar deneyin.", "tr")}
        </div>
      </BackofficePage>
    );
  }
}
