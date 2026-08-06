"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Save, Undo2 } from "lucide-react";

type FloorPlanTable = {
  id: string;
  table_number: number;
  name?: string | null;
  status: "empty" | "occupied" | "reserved";
  zone_id?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  seat_count?: number | null;
};

type FloorPlanZone = { id: string; name: string };

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

function tableColor(status: FloorPlanTable["status"]) {
  if (status === "occupied") return "border-amber-400 bg-amber-50 text-amber-950";
  if (status === "reserved") return "border-indigo-400 bg-indigo-50 text-indigo-950";
  return "border-emerald-400 bg-emerald-50 text-emerald-950";
}

export function TableFloorPlanEditor({
  tables,
  zones,
  usingDemoData,
}: {
  tables: FloorPlanTable[];
  zones: FloorPlanZone[];
  usingDemoData: boolean;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const initial: Record<string, { x: number; y: number }> = {};
    const byZone = new Map<string, FloorPlanTable[]>();
    for (const table of tables) {
      const zoneKey = table.zone_id ?? UNASSIGNED_ZONE;
      const group = byZone.get(zoneKey) ?? [];
      group.push(table);
      byZone.set(zoneKey, group);
    }
    for (const group of byZone.values()) {
      group.forEach((table, index) => {
        initial[table.id] =
          table.position_x != null && table.position_y != null
            ? { x: table.position_x, y: table.position_y }
            : defaultPosition(index);
      });
    }
    return initial;
  });
  const [seatCounts, setSeatCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    tables.forEach((table) => {
      initial[table.id] = table.seat_count ?? 4;
    });
    return initial;
  });
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const tabs = useMemo(() => {
    const hasUnassigned = tables.some((table) => !table.zone_id);
    const zoneTabs = zones.map((zone) => ({ id: zone.id, name: zone.name }));
    return hasUnassigned ? [...zoneTabs, { id: UNASSIGNED_ZONE, name: "Bölgesiz" }] : zoneTabs;
  }, [tables, zones]);
  const [activeZone, setActiveZone] = useState<string>(() => tabs[0]?.id ?? UNASSIGNED_ZONE);
  const zoneTables = useMemo(
    () => tables.filter((table) => (table.zone_id ?? UNASSIGNED_ZONE) === activeZone),
    [tables, activeZone],
  );

  function updateFromPointer(tableId: string, clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(96, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(94, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    setPositions((prev) => ({ ...prev, [tableId]: { x, y } }));
  }

  function handlePointerDown(tableId: string, event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragIdRef.current = tableId;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const tableId = dragIdRef.current;
    if (!tableId) return;
    updateFromPointer(tableId, event.clientX, event.clientY);
  }

  async function handlePointerUp() {
    const tableId = dragIdRef.current;
    dragIdRef.current = null;
    if (!tableId) return;
    setDirty((prev) => new Set(prev).add(tableId));
    await persistPosition(tableId);
  }

  async function persistPosition(tableId: string) {
    const position = positions[tableId];
    if (!position || usingDemoData) return;
    setSaving((prev) => new Set(prev).add(tableId));
    setError(null);
    try {
      const response = await fetch("/api/ops/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TABLE_POSITION_SET",
          payload: { table_id: tableId, position_x: position.x, position_y: position.y },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result?.result?.message ?? result?.message ?? "Pozisyon kaydedilemedi.");
      } else {
        setDirty((prev) => {
          const next = new Set(prev);
          next.delete(tableId);
          return next;
        });
      }
    } catch {
      setError("Ağ hatası nedeniyle pozisyon kaydedilemedi.");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
    }
  }

  async function persistSeatCount(tableId: string, seatCount: number) {
    setSeatCounts((prev) => ({ ...prev, [tableId]: seatCount }));
    if (usingDemoData) return;
    setSaving((prev) => new Set(prev).add(tableId));
    setError(null);
    try {
      const response = await fetch("/api/ops/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TABLE_SEAT_COUNT_SET",
          payload: { table_id: tableId, seat_count: seatCount },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result?.result?.message ?? result?.message ?? "Kapasite kaydedilemedi.");
      }
    } catch {
      setError("Ağ hatası nedeniyle kapasite kaydedilemedi.");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
    }
  }

  function resetLayout() {
    setPositions((prev) => {
      const next = { ...prev };
      zoneTables.forEach((table, index) => {
        next[table.id] = defaultPosition(index);
      });
      return next;
    });
    setDirty((prev) => {
      const next = new Set(prev);
      zoneTables.forEach((table) => next.add(table.id));
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Salon Krokisi Düzenleyici</h2>
          <p className="mt-1 text-sm text-slate-500">Her bölge (kat/alan) kendi bağımsız krokisine sahiptir. Masaları sürükleyip bırakarak yerleşimi oluşturun, her bırakışta konum otomatik kaydedilir.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty.size > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
              <Save className="h-3.5 w-3.5" /> {dirty.size} masa kaydediliyor
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">Tümü kaydedildi</span>
          )}
          <button
            type="button"
            onClick={resetLayout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Undo2 className="h-3.5 w-3.5" /> Bu Bölgeyi Otomatik Diz
          </button>
          <Link href="/admin/tables" className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
            Masa Listesine Dön
          </Link>
        </div>
      </div>

      {tabs.length > 1 ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveZone(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                activeZone === tab.id ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      ) : null}

      {usingDemoData ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Demo veri modunda kroki pozisyonu kalıcı olarak kaydedilmez.
        </div>
      ) : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <div
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative min-h-[520px] w-full touch-none rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,#f8fafc,#eef2f7)] shadow-inner"
      >
        {zoneTables.length === 0 ? (
          <div className="flex h-full min-h-[520px] items-center justify-center text-sm text-slate-400">Bu bölgede masa yok.</div>
        ) : (
          zoneTables.map((table) => {
            const position = positions[table.id] ?? { x: 10, y: 10 };
            const seatCount = seatCounts[table.id] ?? table.seat_count ?? 4;
            const isSaving = saving.has(table.id);
            return (
              <div
                key={table.id}
                onPointerDown={(event) => handlePointerDown(table.id, event)}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center gap-0.5 border-2 shadow-sm transition-shadow active:cursor-grabbing active:shadow-md ${tableShapeClass(seatCount)} ${tableColor(table.status)} ${isSaving ? "opacity-60" : ""}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">Masa</span>
                <span className="text-lg font-black leading-none">{table.table_number}</span>
                <select
                  value={seatCount}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => persistSeatCount(table.id, Number(event.target.value))}
                  className="cursor-pointer rounded-md border-0 bg-transparent text-[9px] font-semibold opacity-80 focus:outline-none"
                >
                  <option value={2}>2 Kişilik</option>
                  <option value={4}>4 Kişilik</option>
                  <option value={6}>6 Kişilik</option>
                  <option value={8}>8+ Kişilik</option>
                </select>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
