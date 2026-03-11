import Link from "next/link";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { getTableMap } from "@/lib/domains/tables";

const statusStyles: Record<string, string> = {
  empty: "bg-emerald-100 text-emerald-700",
  occupied: "bg-amber-100 text-amber-800",
  reserved: "bg-sky-100 text-sky-800",
};

export default async function TablesPage() {
  const { tables, usingDemoData } = await getTableMap();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-10 md:py-8">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Takip</p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Masa Durumlari</h1>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <LiveOpsBridge tables={["tables", "orders"]} />
            <Link href="/ops" className="w-full rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white sm:w-auto">
              Panele Don
            </Link>
          </div>
        </header>

        {usingDemoData ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
            Demo veri modu aktif.
          </p>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tables.map((table) => (
            <article key={table.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Masa</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{table.name || `Masa ${table.table_number}`}</p>
              <p className="mt-1 text-sm text-slate-500">No: {table.table_number}</p>
              <p className="mt-3 text-xs text-slate-500">QR</p>
              <p className="text-sm font-medium text-slate-700">{table.qr_code_identifier}</p>
              <span
                className={`mt-4 inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusStyles[table.status]}`}
              >
                {table.status}
              </span>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
