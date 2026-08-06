"use client";

import { useMemo, useState } from "react";
import type { DiningTable, TableStatus, TableZone } from "@/lib/types";

const UNASSIGNED_ZONE = "__unassigned__";

function defaultPosition(index: number) {
  const columns = 6;
  const col = index % columns;
  const row = Math.floor(index / columns);
  return { x: 10 + col * 15, y: 12 + row * 20 };
}

function tableShapeClass(seatCount?: number | null) {
  const seats = seatCount ?? 4;
  if (seats <= 2) return "h-16 w-16 rounded-full";
  if (seats <= 4) return "h-20 w-20 rounded-2xl";
  if (seats <= 6) return "h-16 w-28 rounded-2xl";
  return "h-16 w-36 rounded-2xl";
}

function tableColor(status: TableStatus, isSelected: boolean) {
  if (isSelected) return "border-[#ff5a34] bg-orange-50 text-orange-950 ring-2 ring-[#ff5a34]/30";
  if (status === "occupied") return "border-amber-400 bg-amber-50 text-amber-950";
  if (status === "reserved") return "border-sky-400 bg-sky-50 text-sky-950";
  return "border-emerald-400 bg-emerald-50 text-emerald-950";
}

export function TablePickerFloorPlan({
  tables,
  zones,
  selectedTableId,
  onSelect,
}: {
  tables: DiningTable[];
  zones: TableZone[];
  selectedTableId?: string;
  onSelect: (tableId: string) => void;
}) {
  const tabs = useMemo(() => {
    const hasUnassigned = tables.some((table) => !table.zone_id);
    const zoneTabs = zones
      .filter((zone) => tables.some((table) => table.zone_id === zone.id))
      .map((zone) => ({ id: zone.id, name: zone.name }));
    return hasUnassigned ? [...zoneTabs, { id: UNASSIGNED_ZONE, name: "Bölgesiz" }] : zoneTabs;
  }, [tables, zones]);
  const [activeZone, setActiveZone] = useState<string>(() => tabs[0]?.id ?? UNASSIGNED_ZONE);
  const effectiveZone = tabs.some((tab) => tab.id === activeZone) ? activeZone : (tabs[0]?.id ?? UNASSIGNED_ZONE);

  const zoneTables = useMemo(
    () => tables.filter((table) => (table.zone_id ?? UNASSIGNED_ZONE) === effectiveZone),
    [tables, effectiveZone],
  );

  return (
    <div className="space-y-3">
      {tabs.length > 1 ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveZone(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                effectiveZone === tab.id ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative min-h-[420px] w-full rounded-[24px] border border-slate-200 bg-[radial-gradient(circle_at_top,#f8fafc,#eef2f7)] shadow-inner">
        {zoneTables.length === 0 ? (
          <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-slate-400">Bu filtrede masa bulunamadı.</div>
        ) : (
          zoneTables.map((table, index) => {
            const hasPosition = table.position_x != null && table.position_y != null;
            const position = hasPosition
              ? { x: table.position_x as number, y: table.position_y as number }
              : defaultPosition(index);
            const isSelected = table.id === selectedTableId;
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => onSelect(table.id)}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-0.5 border-2 shadow-sm transition-all active:scale-95 ${tableShapeClass(table.seat_count)} ${tableColor(table.status, isSelected)}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">Masa</span>
                <span className="text-lg font-black leading-none">{table.table_number}</span>
                <span className="text-[9px] font-semibold opacity-70">{table.seat_count ?? 4} Kişilik</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
