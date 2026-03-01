import { getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { getSalesReportSummary } from "@/lib/data";

export async function GET(request: Request) {
  const auth = await getCurrentUserWithRole();
  if (!auth.user || !hasRoleAccess(auth.role, ["admin"])) {
    return new Response("Yetkisiz", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get("days") ?? "7");
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 90) : 7;

  const { rows } = await getSalesReportSummary(days);
  const header = "day,sales,refunds,net";
  const body = rows
    .map((row) => `${row.day},${row.sales.toFixed(2)},${row.refunds.toFixed(2)},${row.net.toFixed(2)}`)
    .join("\n");
  const csv = `${header}\n${body}\n`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-report-${days}d.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
