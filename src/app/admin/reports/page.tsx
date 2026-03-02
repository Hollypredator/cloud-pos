import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getFinancialInsights, getSalesReportSummary, getOpsMetricsSnapshot, listBranches, listProfiles } from "@/lib/data";
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
  await requireRole(["admin"], "/admin/reports");
  const featureAccessResult = await measureAsync("feature_access", () => getFeatureAccess("advanced_reports"));
  const featureAccess = featureAccessResult.value;
  if (!featureAccess.enabled) {
    logServerPerf("/admin/reports", [featureAccessResult]);
    return (
      <BackofficePage title="Raporlar" description="Satis, cari ve personel performansi">
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

  const [salesResult, financialResult, opsResult, profilesResult, branchContextResult] = await Promise.all([
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
    shouldLoadStaff
      ? measureAsync("ops_metrics", () => getOpsMetricsSnapshot())
      : Promise.resolve({
          label: "ops_metrics",
          ms: 0,
          value: {
            pendingOrders: 0,
            servedOrders: 0,
            openServiceRequests: 0,
          },
        }),
    shouldLoadStaff
      ? measureAsync("list_profiles", () => listProfiles())
      : Promise.resolve({
          label: "list_profiles",
          ms: 0,
          value: {
            profiles: [] as Array<{ role: string }>,
            usingDemoData: false,
          },
        }),
    measureAsync("list_branches", () => listBranches()),
  ]);
  const { rows, usingDemoData } = salesResult.value;
  const financial = financialResult.value;
  const ops = opsResult.value;
  const { profiles } = profilesResult.value;
  const branchContext = branchContextResult.value;
  logServerPerf("/admin/reports", [featureAccessResult, salesResult, financialResult, opsResult, profilesResult, branchContextResult]);
  const branchLabel =
    branchContext.activeBranchId === ALL_BRANCHES_VALUE
      ? "Tum Subeler"
      : branchContext.branches.find((branch) => branch.id === branchContext.activeBranchId)?.name ?? "Aktif Sube";

  const totalSales = rows.reduce((sum, row) => sum + row.sales, 0);
  const totalRefunds = rows.reduce((sum, row) => sum + row.refunds, 0);
  const net = totalSales - totalRefunds;
  const average = rows.length > 0 ? net / rows.length : 0;
  const bestDay = rows.reduce((best, row) => (row.net > (best?.net ?? -Infinity) ? row : best), rows[0]);
  const maxNet = Math.max(1, ...rows.map((row) => row.net));
  const roleCounts = {
    owner: profiles.filter((profile) => profile.role === "owner").length,
    admin: profiles.filter((profile) => profile.role === "admin").length,
    cashier: profiles.filter((profile) => profile.role === "cashier").length,
    kitchen: profiles.filter((profile) => profile.role === "kitchen").length,
    waiter: profiles.filter((profile) => profile.role === "waiter").length,
  };

  return (
    <BackofficePage
      title="Raporlar"
      description="Satis ritmi, iade etkisi ve net performansi hizli okumak icin tasarlandi"
      sidebar={
        <SidebarPanel title="Filtreler" description="Donem ve gorunum secimi">
          <div className="grid gap-2 sm:grid-cols-2">
            <FilterButton>Donem</FilterButton>
            <FilterButton active>Tarih</FilterButton>
          </div>

          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-800">Tarih Araligi</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <FilterButton>Bugun</FilterButton>
              <FilterButton>Dun</FilterButton>
              <FilterButton active>Son 7 Gun</FilterButton>
              <FilterButton>Son 30 Gun</FilterButton>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-800">Satis Kanali</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Tum Kanallar</div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-[#fbfbfc] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Hizli Ozet</p>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-white px-3 py-3">
                <span>Net Satis</span>
                <span className="font-semibold text-emerald-700">{net.toFixed(2)} TL</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-3 py-3">
                <span>En Iyi Gun</span>
                <span className="font-semibold text-slate-900">{bestDay ? dayLabel(bestDay.day) : "-"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-3 py-3">
                <span>Ortalama</span>
                <span className="font-semibold text-slate-900">{average.toFixed(2)} TL</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button type="button" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
              Filtreleri Uygula
            </button>
            <button type="button" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              Sifirla
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
            Excel
          </a>
          <Link href={`/admin/finance?days=${days}`} className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            Finans
          </Link>
        </>
      }
    >
      <SegmentedTabs
        tabs={[
          { label: "Genel", active: activeTab === "general", href: `/admin/reports?tab=general&days=${days}` },
          { label: "Cari", active: activeTab === "cari", href: `/admin/reports?tab=cari&days=${days}` },
          { label: "Detay", active: activeTab === "detail", href: `/admin/reports?tab=detail&days=${days}` },
          { label: "Personel", active: activeTab === "staff", href: `/admin/reports?tab=staff&days=${days}` },
        ]}
      />

      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo modda rapor verisi sinirlidir.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Brut Satis" value={`${totalSales.toFixed(2)} TL`} hint="Toplam giren satis" tone="accent" />
        <SummaryCard label="Iade" value={`${totalRefunds.toFixed(2)} TL`} hint="Donemsel cikan tutar" tone="danger" />
        <SummaryCard label="Net Satis" value={`${net.toFixed(2)} TL`} hint="Gercek donem sonucu" tone="success" />
        <SummaryCard label="Gunluk Ort" value={`${average.toFixed(2)} TL`} hint="7 gunluk net ortalama" />
      </section>

      {activeTab === "general" ? (
        <>
      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <ContentCard title="Net Satis Grafigi">
          {rows.length === 0 ? (
            <EmptyPanel title="Kayit Yok" description="Secilen filtrelerde rapor verisi bulunamadi." />
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

        <ContentCard title="Performans Notlari">
          <div className="space-y-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">En Iyi Gun</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                {bestDay ? `${dayLabel(bestDay.day)} - ${bestDay.net.toFixed(2)} TL` : "Kayit yok"}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Iade Etkisi</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-rose-700">
                %{totalSales > 0 ? ((totalRefunds / totalSales) * 100).toFixed(1) : "0.0"}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Net Momentum</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                {rows.length >= 2 && rows[rows.length - 1].net >= rows[rows.length - 2].net ? "Yukselen" : "Dalgalanan"}
              </p>
            </div>
          </div>
        </ContentCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ContentCard title="Gun Bazli Dagilim">
          {rows.length === 0 ? (
            <EmptyPanel title="Kayit Yok" description="Gun bazli tablo gosterilemiyor." />
          ) : (
            <div className="responsive-table-shell rounded-[22px] border border-slate-200">
              <table className="responsive-table w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Gun</th>
                    <th className="px-4 py-4 font-semibold">Satis</th>
                    <th className="px-4 py-4 font-semibold">Iade</th>
                    <th className="px-4 py-4 font-semibold">Net</th>
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

        <ContentCard title="Hizli Yorum">
          <div className="grid gap-3">
            {rows.map((row) => (
              <div key={row.day} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{dayLabel(row.day)}</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{row.net.toFixed(2)} TL net</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.net >= average ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {row.net >= average ? "Ortalama Ustu" : "Ortalama Alti"}
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
          <ContentCard title="Cari Odeme Dagilimi">
            {financial.methodBreakdown.length === 0 ? (
              <EmptyPanel title="Cari Veri Yok" description="Secilen aralikta tahsilat hareketi bulunmuyor." />
            ) : (
              <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
                <DonutChart
                  centerLabel="Cari Net"
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
                            <p className="mt-1 text-sm text-slate-500">Gelir / iade / net bakiye</p>
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
                          <span>Gelir <span className="font-numeric font-semibold text-emerald-700">{row.sales.toFixed(2)}</span></span>
                          <span>Iade <span className="font-numeric font-semibold text-rose-700">{row.refunds.toFixed(2)}</span></span>
                          <span>Net <span className="font-numeric font-semibold text-slate-900">{row.net.toFixed(2)}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ContentCard>

          <ContentCard title="Tahsilat Hareketleri">
            {financial.recentPayments.length === 0 ? (
              <EmptyPanel title="Hareket Yok" description="Cari sekmesi icin listelenecek son hareket bulunmuyor." />
            ) : (
              <div className="responsive-table-shell max-h-[520px] overflow-y-auto rounded-[22px] border border-slate-200">
                <table className="responsive-table w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Saat</th>
                      <th className="px-4 py-4 font-semibold">Tip</th>
                      <th className="px-4 py-4 font-semibold">Yontem</th>
                      <th className="px-4 py-4 font-semibold">Tutar</th>
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
          <ContentCard title="Urun Performansi">
            {financial.topProducts.length === 0 ? (
              <EmptyPanel title="Detay Veri Yok" description="Top urun performansi icin veri bulunmuyor." />
            ) : (
              <div className="space-y-3">
                {financial.topProducts.map((row, index) => {
                  const maxRevenue = Math.max(1, ...financial.topProducts.map((item) => item.revenue));
                  return (
                    <div key={row.productName} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{row.productName}</p>
                          <p className="mt-1 text-sm text-slate-500">{row.qty} adet satis</p>
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

          <ContentCard title="Gun Bazli Detay">
            {rows.length === 0 ? (
              <EmptyPanel title="Gunluk Detay Yok" description="Gun bazli detay tablosu gosterilemiyor." />
            ) : (
              <div className="responsive-table-shell rounded-[22px] border border-slate-200">
                <table className="responsive-table w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Gun</th>
                      <th className="px-4 py-4 font-semibold">Satis</th>
                      <th className="px-4 py-4 font-semibold">Iade</th>
                      <th className="px-4 py-4 font-semibold">Net</th>
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
          <ContentCard title="Personel Dagilimi">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard label="Patron" value={String(roleCounts.owner)} hint="Tum subeler" tone="accent" />
              <SummaryCard label="Yonetici" value={String(roleCounts.admin)} hint="Atanmis sube" />
              <SummaryCard label="Kasa" value={String(roleCounts.cashier)} hint="Tahsilat" />
              <SummaryCard label="Mutfak" value={String(roleCounts.kitchen)} hint="Hazirlama" tone="danger" />
              <SummaryCard label="Servis" value={String(roleCounts.waiter)} hint="Masa operasyonu" tone="success" />
            </div>
          </ContentCard>

          <ContentCard title="Operasyon Yuku">
            <div className="grid gap-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Mutfak Bekleyen</p>
                <p className="font-display font-numeric mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{ops.pendingOrders}</p>
                <p className="mt-2 text-sm text-slate-500">Vardiyada mutfaga bekleyen is</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Kasada Bekleyen</p>
                <p className="font-display font-numeric mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{ops.servedOrders}</p>
                <p className="mt-2 text-sm text-slate-500">Tahsilat bekleyen adisyon</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Masa Talepleri</p>
                <p className="font-display font-numeric mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{ops.openServiceRequests}</p>
                <p className="mt-2 text-sm text-slate-500">Garson ve hesap talepleri</p>
              </div>
            </div>
          </ContentCard>
        </section>
      ) : null}
    </BackofficePage>
  );
}
