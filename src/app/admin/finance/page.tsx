import Link from "next/link";
import { BackofficePage, ContentCard, EmptyPanel, FeatureLockedState, SegmentedTabs, SidebarPanel, SummaryCard } from "@/components/backoffice-ui";
import { ALL_BRANCHES_VALUE } from "@/lib/business";
import { requireRole } from "@/lib/auth";
import { getFinancialInsights } from "@/lib/domains/finance";
import { listBranches } from "@/lib/data";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getFeatureAccess } from "@/lib/plan-access";

export const dynamic = "force-dynamic";

type FinanceView = "overview" | "cashflow" | "sales" | "transactions";
type FilterMode = "period" | "date";

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveDateInputs(days: number, start?: string, end?: string) {
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - Math.max(0, days - 1));

  const parsedStart = parseDateInput(start);
  const parsedEnd = parseDateInput(end);
  if (!parsedStart || !parsedEnd) {
    return {
      startDate: toDateInputValue(defaultStart),
      endDate: toDateInputValue(defaultEnd),
      warning: start || end ? "Tarih formati gecersizdi. Varsayilan aralik uygulandi." : null,
    };
  }

  const maxDays = 366;
  const isReversed = parsedStart.getTime() > parsedEnd.getTime();
  const normalizedStart = isReversed ? parsedEnd : parsedStart;
  const normalizedEnd = isReversed ? parsedStart : parsedEnd;
  const totalDays = Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / 86400000) + 1;

  if (totalDays > maxDays) {
    const clampedEnd = new Date(normalizedStart);
    clampedEnd.setDate(clampedEnd.getDate() + maxDays - 1);
    return {
      startDate: toDateInputValue(normalizedStart),
      endDate: toDateInputValue(clampedEnd),
      warning: "Tarih araligi en fazla 366 gun olabilir. Aralik sinirlandi.",
    };
  }

  return {
    startDate: toDateInputValue(normalizedStart),
    endDate: toDateInputValue(normalizedEnd),
    warning: isReversed ? "Baslangic ve bitis tarihleri yer degistirilerek duzeltildi." : null,
  };
}

function buildFinanceHref(input: {
  days: number;
  view: FinanceView;
  mode: FilterMode;
  start?: string;
  end?: string;
}) {
  const params = new URLSearchParams();
  params.set("days", String(input.days));
  params.set("view", input.view);
  params.set("mode", input.mode);
  if (input.mode === "date" && input.start && input.end) {
    params.set("start", input.start);
    params.set("end", input.end);
  }
  return `/admin/finance?${params.toString()}`;
}

function methodLabel(method: string) {
  if (method === "cash") return "Nakit";
  if (method === "card") return "Kart";
  if (method === "mixed") return "Karma";
  return method;
}

function methodAccent(index: number) {
  const accents = [
    "from-[#ff6a3d] to-[#f2b44f]",
    "from-[#0f766e] to-[#34d399]",
    "from-[#334155] to-[#64748b]",
  ];
  return accents[index % accents.length];
}

function buildPolylinePoints(values: number[], width: number, height: number) {
  if (values.length === 0) return "";
  const max = Math.max(1, ...values);
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height;
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

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; view?: string; mode?: string; start?: string; end?: string }>;
}) {
  try {
    await requireRole(["admin"], "/admin/finance");
    const locale = await getCurrentLocale();
    const featureAccessResult = await measureAsync("feature_access", () => getFeatureAccess("finance_dashboard"));
    const featureAccess = featureAccessResult.value;
    if (!featureAccess.enabled) {
      logServerPerf("/admin/finance", [featureAccessResult]);
      return (
        <BackofficePage title={translateUiText("Gelir/Gider", locale)} description={translateUiText("Nakit akis yonetimi ve finans ozetleri", locale)}>
          <FeatureLockedState
            title={featureAccess.title}
            description={featureAccess.description}
            currentPlan={featureAccess.plan}
            requiredPlan={featureAccess.requiredPlan}
          />
        </BackofficePage>
      );
    }
    const { days: daysParam, view: viewParam, mode: modeParam, start: startParam, end: endParam } = await searchParams;
    const days = Number.isFinite(Number(daysParam)) ? Number(daysParam) : 7;
    const mode: FilterMode = modeParam === "date" ? "date" : "period";
    const { startDate, endDate, warning: dateGuardWarning } = resolveDateInputs(days, startParam, endParam);
    const activeView: FinanceView =
      viewParam === "cashflow" || viewParam === "sales" || viewParam === "transactions" ? viewParam : "overview";
    const [financialResult, branchContextResult] = await Promise.all([
      measureAsync("financial_insights", () =>
        getFinancialInsights(mode === "date" ? { startDate, endDate } : { days }),
      ),
      measureAsync("list_branches", () => listBranches()),
    ]);
    const { summary, methodBreakdown, hourlySales, topProducts, recentPayments, usingDemoData } = financialResult.value;
    const branchContext = branchContextResult.value;
    logServerPerf("/admin/finance", [featureAccessResult, financialResult, branchContextResult]);
  const branchLabel =
    branchContext.activeBranchId === ALL_BRANCHES_VALUE
      ? translateUiText("Tum Subeler", locale)
      : branchContext.branches.find((branch) => branch.id === branchContext.activeBranchId)?.name ?? translateUiText("Aktif Sube", locale);

  const maxHourly = Math.max(1, ...hourlySales.map((row) => row.sales));
  const averageTicket = summary.paidOrderCount > 0 ? summary.grossSales / summary.paidOrderCount : 0;
  const refundRate = summary.grossSales > 0 ? (summary.refunds / summary.grossSales) * 100 : 0;
  const totalMethodNet = Math.max(1, methodBreakdown.reduce((sum, row) => sum + Math.max(0, row.net), 0));
  const topMethod = methodBreakdown.reduce<{ method: string; net: number } | null>((best, row) => {
    if (!best || row.net > best.net) {
      return { method: row.method, net: row.net };
    }
    return best;
  }, null);

    return (
    <BackofficePage
      title={translateUiText("Gelir/Gider", locale)}
      description={translateUiText("Nakit akis yonetimi ve finans ozetleri", locale)}
      sidebar={
        <SidebarPanel title={translateUiText("Filtreler", locale)}>
          <form method="get" className="space-y-4">
            <input type="hidden" name="view" value={activeView} />
            <input type="hidden" name="mode" value={mode} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href={buildFinanceHref({ days, view: activeView, mode: "period" })}
                className={mode === "period" ? "rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-center text-sm font-semibold text-white" : "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700"}
              >
                {translateUiText("Donem Bazli", locale)}
              </Link>
              <Link
                href={buildFinanceHref({ days, view: activeView, mode: "date", start: startDate, end: endDate })}
                className={mode === "date" ? "rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-center text-sm font-semibold text-white" : "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700"}
              >
                {translateUiText("Tarih Bazli", locale)}
              </Link>
            </div>
            {mode === "period" ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">{translateUiText("Donem", locale)}</p>
                <select name="days" defaultValue={String(days)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <option value="1">{translateUiText("Bugun", locale)}</option>
                  <option value="7">{translateUiText("Son 7 gun", locale)}</option>
                  <option value="14">{translateUiText("Son 14 gun", locale)}</option>
                  <option value="30">{translateUiText("Son 30 gun", locale)}</option>
                  <option value="90">{translateUiText("Son 90 gun", locale)}</option>
                </select>
              </div>
            ) : (
              <div className="grid gap-3">
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-800">{translateUiText("Baslangic Tarihi", locale)}</p>
                  <input name="start" type="date" defaultValue={startDate} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-800">{translateUiText("Bitis Tarihi", locale)}</p>
                  <input name="end" type="date" defaultValue={endDate} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                </div>
              </div>
            )}
            <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
              {translateUiText("Verileri Yenile", locale)}
            </button>
            {mode === "date" && dateGuardWarning ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {dateGuardWarning}
              </div>
            ) : null}
          </form>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">{translateUiText("Gorunum", locale)}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Link href={buildFinanceHref({ days, view: "overview", mode, start: startDate, end: endDate })} className={activeView === "overview" ? "rounded-2xl bg-slate-900 px-4 py-3 text-center text-xs font-semibold text-white" : "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-semibold text-slate-700"}>
                {translateUiText("Ozet", locale)}
              </Link>
              <Link href={buildFinanceHref({ days, view: "cashflow", mode, start: startDate, end: endDate })} className={activeView === "cashflow" ? "rounded-2xl bg-slate-900 px-4 py-3 text-center text-xs font-semibold text-white" : "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-semibold text-slate-700"}>
                {translateUiText("Nakit Akisi", locale)}
              </Link>
              <Link href={buildFinanceHref({ days, view: "sales", mode, start: startDate, end: endDate })} className={activeView === "sales" ? "rounded-2xl bg-slate-900 px-4 py-3 text-center text-xs font-semibold text-white" : "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-semibold text-slate-700"}>
                {translateUiText("Satis Analizi", locale)}
              </Link>
              <Link href={buildFinanceHref({ days, view: "transactions", mode, start: startDate, end: endDate })} className={activeView === "transactions" ? "rounded-2xl bg-slate-900 px-4 py-3 text-center text-xs font-semibold text-white" : "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-semibold text-slate-700"}>
                {translateUiText("Hareketler", locale)}
              </Link>
            </div>
          </div>
          {mode === "period" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Link href={buildFinanceHref({ days: 1, view: activeView, mode: "period" })} className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold ${days === 1 ? "bg-[#ff5a34] text-white" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
                {translateUiText("Bugun", locale)}
              </Link>
              <Link href={buildFinanceHref({ days: 7, view: activeView, mode: "period" })} className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold ${days === 7 ? "bg-[#ff5a34] text-white" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
                {translateUiText("7 Gun", locale)}
              </Link>
              <Link href={buildFinanceHref({ days: 30, view: activeView, mode: "period" })} className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold ${days === 30 ? "bg-[#ff5a34] text-white" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
                {translateUiText("30 Gun", locale)}
              </Link>
              <Link href={buildFinanceHref({ days: 90, view: activeView, mode: "period" })} className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold ${days === 90 ? "bg-[#ff5a34] text-white" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
                {translateUiText("90 Gun", locale)}
              </Link>
            </div>
          ) : null}
          <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Hizli Okuma", locale)}</p>
            <div>
              <p className="text-sm text-slate-500">{translateUiText("Ortalama fis", locale)}</p>
              <p className="font-display font-numeric mt-1 text-2xl font-semibold tracking-tight text-slate-900">{averageTicket.toFixed(2)} TL</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{translateUiText("Iade orani", locale)}</p>
              <p className={`font-display font-numeric mt-1 text-2xl font-semibold tracking-tight ${refundRate > 10 ? "text-rose-700" : "text-slate-900"}`}>
                %{refundRate.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{translateUiText("En guclu yontem", locale)}</p>
              <p className="font-display mt-1 text-lg font-semibold text-slate-900">{topMethod ? methodLabel(topMethod.method) : translateUiText("Veri yok", locale)}</p>
            </div>
          </div>
        </SidebarPanel>
      }
      actions={
        <>
          <a href={mode === "date" ? `/api/reports/sales.csv?start=${startDate}&end=${endDate}` : `/api/reports/sales.csv?days=${days}`} className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            {translateUiText("Excel", locale)}
          </a>
          <span className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-center text-sm font-semibold text-slate-700 sm:w-auto">
            {branchLabel}
          </span>
          <a href={mode === "date" ? `/admin/reports?mode=date&start=${startDate}&end=${endDate}` : `/admin/reports?days=${days}&mode=period`} className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            {translateUiText("Raporlara Git", locale)}
          </a>
        </>
      }
    >
      <SegmentedTabs
        tabs={[
          { label: translateUiText("Ozet", locale), active: activeView === "overview", href: buildFinanceHref({ days, view: "overview", mode, start: startDate, end: endDate }) },
          { label: translateUiText("Nakit Akisi", locale), active: activeView === "cashflow", href: buildFinanceHref({ days, view: "cashflow", mode, start: startDate, end: endDate }) },
          { label: translateUiText("Satis Analizi", locale), active: activeView === "sales", href: buildFinanceHref({ days, view: "sales", mode, start: startDate, end: endDate }) },
          { label: translateUiText("Hareketler", locale), active: activeView === "transactions", href: buildFinanceHref({ days, view: "transactions", mode, start: startDate, end: endDate }) },
        ]}
      />

      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {translateUiText("Demo modda finans verisi sinirlidir.", locale)}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label={translateUiText("Gelir", locale)} value={`${summary.grossSales.toFixed(2)} TL`} hint={translateUiText("Brut satis", locale)} tone="success" />
        <SummaryCard label={translateUiText("Gider", locale)} value={`${summary.refunds.toFixed(2)} TL`} hint={translateUiText("Iade / cikis", locale)} tone="danger" />
        <SummaryCard label={translateUiText("Net", locale)} value={`${summary.netSales.toFixed(2)} TL`} hint={translateUiText("Kalan bakiye", locale)} tone="accent" />
        <SummaryCard label={translateUiText("Toplam", locale)} value={`${summary.paidOrderCount}`} hint={translateUiText("Tamamlanan odeme", locale)} />
      </section>

      {activeView === "overview" ? (
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <ContentCard title={translateUiText("Grafik Panorama", locale)}>
          {hourlySales.length === 0 ? (
            <EmptyPanel title={translateUiText("Grafik Verisi Yok", locale)} description={translateUiText("Secilen filtrelerde cizilecek finans akisi yok.", locale)} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <svg viewBox="0 0 720 260" className="h-[260px] w-full">
                  <defs>
                    <linearGradient id="finance-area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#ff6a3d" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity="0.06" />
                    </linearGradient>
                    <linearGradient id="finance-line" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#ff6a3d" />
                      <stop offset="50%" stopColor="#f2b44f" />
                      <stop offset="100%" stopColor="#0f766e" />
                    </linearGradient>
                  </defs>
                  {[0, 1, 2, 3].map((line) => (
                    <line key={line} x1="0" x2="720" y1={40 + line * 55} y2={40 + line * 55} stroke="#dbe1ea" strokeDasharray="6 8" />
                  ))}
                  <polygon points={buildAreaPoints(hourlySales.map((row) => row.sales), 720, 220)} fill="url(#finance-area)" transform="translate(0,20)" />
                  <polyline
                    points={buildPolylinePoints(hourlySales.map((row) => row.sales), 720, 220)}
                    fill="none"
                    stroke="url(#finance-line)"
                    strokeWidth="6"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    transform="translate(0,20)"
                  />
                  {hourlySales.map((row, index) => {
                    const x = hourlySales.length === 1 ? 0 : (720 / (hourlySales.length - 1)) * index;
                    const y = 20 + (220 - (row.sales / maxHourly) * 220);
                    return (
                      <g key={row.hour}>
                        <circle cx={x} cy={y} r="7" fill="#ffffff" stroke="#ff6a3d" strokeWidth="4" />
                        <text x={x} y="254" textAnchor="middle" fontSize="15" fill="#64748b">
                          {row.hour}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="space-y-3">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Net Akis</p>
                  <p className="font-display font-numeric mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{summary.netSales.toFixed(2)} TL</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Saatlik Tepe</p>
                  <p className="font-display mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                    {hourlySales.slice().sort((a, b) => b.sales - a.sales)[0]?.hour ?? "--"}:00
                  </p>
                  <p className="font-numeric mt-2 text-sm text-emerald-700">
                    {hourlySales.slice().sort((a, b) => b.sales - a.sales)[0]?.sales.toFixed(2) ?? "0.00"} TL
                  </p>
                </div>
              </div>
            </div>
          )}
        </ContentCard>

        <ContentCard title={translateUiText("Iade / Tahsilat Dengesi", locale)}>
          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">{translateUiText("Tahsilat", locale)}</span>
                <span className="font-display font-numeric text-lg font-semibold text-emerald-700">{summary.grossSales.toFixed(2)} TL</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                <div className="h-3 rounded-full bg-gradient-to-r from-[#0f766e] to-[#34d399]" style={{ width: "100%" }} />
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">{translateUiText("Iade", locale)}</span>
                <span className="font-display font-numeric text-lg font-semibold text-rose-700">{summary.refunds.toFixed(2)} TL</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-[#fb7185] to-[#f43f5e]"
                  style={{ width: `${Math.max(4, summary.grossSales > 0 ? (summary.refunds / summary.grossSales) * 100 : 4)}%` }}
                />
              </div>
            </div>
          </div>
        </ContentCard>
      </section>
      ) : null}

      {activeView === "overview" ? (
      <section className="grid gap-5 xl:grid-cols-3">
        <ContentCard title={translateUiText("Finans Yorumu", locale)}>
          <div className="grid gap-3">
            <div className="panel-hover rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Net Durum", locale)}</p>
              <p className="font-display font-numeric mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{summary.netSales.toFixed(2)} TL</p>
              <p className="mt-2 text-sm text-slate-500">{translateUiText("Secili aralikta gelir ve iade etkisinin net sonucu.", locale)}</p>
            </div>
            <div className="panel-hover rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Ortalama Fis", locale)}</p>
              <p className="font-display font-numeric mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{averageTicket.toFixed(2)} TL</p>
              <p className="mt-2 text-sm text-slate-500">{translateUiText("Tamamlanmis odeme basina ortalama tahsilat.", locale)}</p>
            </div>
            <div className="panel-hover rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Guclu Kanal", locale)}</p>
              <p className="font-display mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{topMethod ? methodLabel(topMethod.method) : "-"}</p>
              <p className="mt-2 text-sm text-slate-500">{translateUiText("Net tahsilatta one cikan odeme yontemi.", locale)}</p>
            </div>
          </div>
        </ContentCard>

        <ContentCard title={translateUiText("Risk Gostergeleri", locale)}>
          <div className="space-y-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">{translateUiText("Iade Baskisi", locale)}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${refundRate > 10 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  %{refundRate.toFixed(1)}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{translateUiText("Yuksek iade orani marji daraltir. Bu aralikta iade etkisini izle.", locale)}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">{translateUiText("Son Hareket Yogunlugu", locale)}</span>
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">{recentPayments.length}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{translateUiText("Secili aralikta listelenen son odeme ve iade hareketleri.", locale)}</p>
            </div>
          </div>
        </ContentCard>

        <ContentCard title={translateUiText("Saatlik Momentum", locale)}>
          <div className="space-y-3">
            {hourlySales
              .slice()
              .sort((a, b) => b.sales - a.sales)
              .slice(0, 4)
              .map((row) => (
                <div key={row.hour} className="panel-hover flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="font-semibold text-slate-900">{row.hour}:00</span>
                  <span className="font-display font-numeric text-sm font-semibold text-emerald-700">{row.sales.toFixed(2)} TL</span>
                </div>
              ))}
          </div>
        </ContentCard>
      </section>
      ) : null}

      {activeView === "cashflow" ? (
      <section className="grid gap-5 xl:grid-cols-2">
        <ContentCard title={translateUiText("Odeme Dagilimi", locale)}>
          {methodBreakdown.length === 0 ? (
            <EmptyPanel title={translateUiText("Dagilim Yok", locale)} description={translateUiText("Odeme yontemi dagilimini gosterecek veri bulunmuyor.", locale)} />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
              <DonutChart
                centerLabel="Net Tahsilat"
                centerValue={`${summary.netSales.toFixed(0)} TL`}
                segments={methodBreakdown.map((row, index) => ({
                  label: methodLabel(row.method),
                  value: Math.max(0, row.net),
                  color: index === 0 ? "#ff6a3d" : index === 1 ? "#0f766e" : "#475569",
                }))}
              />
              <div className="space-y-4">
                {methodBreakdown.map((row, index) => {
                  const share = Math.max(4, (Math.max(0, row.net) / totalMethodNet) * 100);
                  return (
                    <div key={row.method} className="panel-hover rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-display text-lg font-semibold text-slate-900">{methodLabel(row.method)}</p>
                          <p className="mt-1 text-sm text-slate-500">{translateUiText("Net tahsilat ve iade dengesi", locale)}</p>
                        </div>
                        <p className="font-display font-numeric text-xl font-semibold text-slate-900">{row.net.toFixed(2)} TL</p>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                        <div className={`h-3 rounded-full bg-gradient-to-r ${methodAccent(index)}`} style={{ width: `${share}%` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                        <span>{translateUiText("Gelir", locale)}: <span className="font-numeric font-semibold text-emerald-700">{row.sales.toFixed(2)}</span></span>
                        <span>{translateUiText("Iade", locale)}: <span className="font-numeric font-semibold text-rose-700">{row.refunds.toFixed(2)}</span></span>
                        <span>{translateUiText("Pay", locale)}: <span className="font-numeric font-semibold text-slate-900">%{((Math.max(0, row.net) / totalMethodNet) * 100).toFixed(1)}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ContentCard>

        <ContentCard title={translateUiText("Odeme Tipi", locale)}>
          {methodBreakdown.length === 0 ? (
            <EmptyPanel title={translateUiText("Kayit Bulunamadi", locale)} description={translateUiText("Secili filtrelere uygun odeme kaydi yok.", locale)} />
          ) : (
            <div className="responsive-table-shell rounded-[22px] border border-slate-200">
              <table className="responsive-table w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">{translateUiText("Tip", locale)}</th>
                    <th className="px-4 py-4 font-semibold">{translateUiText("Gelir", locale)}</th>
                    <th className="px-4 py-4 font-semibold">{translateUiText("Gider", locale)}</th>
                    <th className="px-4 py-4 font-semibold">{translateUiText("Kalan", locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {methodBreakdown.map((row) => (
                    <tr key={row.method} className="border-t border-slate-100">
                      <td className="px-4 py-4 font-semibold text-slate-900">{methodLabel(row.method)}</td>
                      <td className="font-numeric px-4 py-4 text-emerald-700">{row.sales.toFixed(2)} TL</td>
                      <td className="font-numeric px-4 py-4 text-rose-700">{row.refunds.toFixed(2)} TL</td>
                      <td className="font-display font-numeric px-4 py-4 font-semibold text-slate-900">{row.net.toFixed(2)} TL</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ContentCard>

        <ContentCard title={translateUiText("Saatlik Satis", locale)}>
          <div className="grid gap-3">
            {hourlySales.map((row) => (
              <div key={row.hour} className="panel-hover grid grid-cols-[56px_1fr_96px] items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <span className="font-display text-slate-600">{row.hour}:00</span>
                <div className="relative h-10 overflow-hidden rounded-2xl bg-white">
                  <div
                    className="absolute inset-y-0 left-0 rounded-2xl bg-gradient-to-r from-[#ff6a3d] via-[#f2b44f] to-[#0f766e]"
                    style={{ width: `${Math.max(6, (row.sales / maxHourly) * 100)}%` }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.25)_40%,transparent_80%)]" />
                </div>
                <span className="font-display font-numeric text-right font-medium text-slate-700">{row.sales.toFixed(2)} TL</span>
              </div>
            ))}
          </div>
        </ContentCard>
      </section>
      ) : null}

      {activeView === "sales" ? (
      <section className="grid gap-5 xl:grid-cols-2">
        <ContentCard title={translateUiText("Saatlik Isi Haritasi", locale)}>
          <div className="grid grid-cols-4 gap-3 md:grid-cols-6 xl:grid-cols-8">
            {hourlySales.map((row) => {
              const intensity = row.sales / maxHourly;
              return (
                <div
                  key={row.hour}
                  className="panel-hover rounded-[20px] border border-slate-200 p-4 text-center"
                  style={{
                    background: `linear-gradient(180deg, rgba(255,106,61,${0.12 + intensity * 0.58}) 0%, rgba(15,118,110,${0.08 + intensity * 0.24}) 100%)`,
                  }}
                >
                  <p className="font-display text-sm font-semibold text-slate-900">{row.hour}:00</p>
                  <p className="font-display font-numeric mt-3 text-lg font-semibold text-slate-900">{row.sales.toFixed(0)}</p>
                  <p className="mt-1 text-xs text-slate-700">TL</p>
                </div>
              );
            })}
          </div>
        </ContentCard>

        <ContentCard title={translateUiText("En Cok Satan Urunler", locale)}>
          {topProducts.length === 0 ? (
            <EmptyPanel title={translateUiText("Kayit Bulunamadi", locale)} description={translateUiText("Secili filtrelerde urun satis verisi yok.", locale)} />
          ) : (
            <div className="space-y-3">
              {topProducts.map((row, index) => {
                const maxRevenue = Math.max(1, ...topProducts.map((item) => item.revenue));
                return (
                  <div key={row.productName} className="panel-hover rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-display text-lg font-semibold text-slate-900">{row.productName}</p>
                        <p className="mt-1 text-sm text-slate-500">{row.qty} {translateUiText("adet satis", locale)}</p>
                      </div>
                      <p className="font-display font-numeric text-lg font-semibold text-emerald-700">{row.revenue.toFixed(2)} TL</p>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                      <div className={`h-2 rounded-full bg-gradient-to-r ${methodAccent(index)}`} style={{ width: `${Math.max(8, (row.revenue / maxRevenue) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ContentCard>

        <ContentCard title={translateUiText("Son Hareketler", locale)}>
          {recentPayments.length === 0 ? (
            <EmptyPanel title={translateUiText("Kayit Bulunamadi", locale)} description={translateUiText("Secili filtrelere uygun hareket yok.", locale)} />
          ) : (
            <div className="responsive-table-shell max-h-[420px] overflow-y-auto rounded-[22px] border border-slate-200">
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
                  {recentPayments.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="font-numeric px-4 py-4 text-slate-700">{new Date(row.created_at).toLocaleString("tr-TR")}</td>
                      <td className="px-4 py-4 text-slate-700">{row.payment_type}</td>
                      <td className="px-4 py-4 text-slate-700">{methodLabel(row.method)}</td>
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

      {activeView === "transactions" ? (
      <section className="grid gap-5">
        <ContentCard title={translateUiText("Son Hareketler", locale)}>
          {recentPayments.length === 0 ? (
            <EmptyPanel title={translateUiText("Kayit Bulunamadi", locale)} description={translateUiText("Secili filtrelere uygun hareket yok.", locale)} />
          ) : (
            <div className="responsive-table-shell max-h-[560px] overflow-y-auto rounded-[22px] border border-slate-200">
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
                  {recentPayments.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="font-numeric px-4 py-4 text-slate-700">{new Date(row.created_at).toLocaleString("tr-TR")}</td>
                      <td className="px-4 py-4 text-slate-700">{row.payment_type}</td>
                      <td className="px-4 py-4 text-slate-700">{methodLabel(row.method)}</td>
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
    </BackofficePage>
    );
  } catch (error) {
    console.error("[admin-finance-page] failed", error);
    return (
      <BackofficePage title="Gelir/Gider" description="Nakit akis yonetimi ve finans ozetleri">
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {translateUiText("Finans verileri yuklenemedi. Lutfen biraz sonra tekrar deneyin.", "tr")}
        </div>
      </BackofficePage>
    );
  }
}
