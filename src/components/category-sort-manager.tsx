"use client";

import { useOptimistic, useState, useTransition } from "react";

type CategoryItem = {
  id: string;
  name: string;
  sort_order: number;
  productCount: number;
  prep_station?: "kitchen" | "bar" | "dessert" | null;
};

function reorderItems(items: CategoryItem[], sourceId: string, targetId: string) {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export function CategorySortManager({
  categories,
  onReorder,
  onDelete,
  onStationUpdate,
}: {
  categories: CategoryItem[];
  onReorder: (ids: string[]) => Promise<void>;
  onDelete: (formData: FormData) => void;
  onStationUpdate: (formData: FormData) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimisticCategories, setOptimisticCategories] = useOptimistic(categories);

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }

    const nextOrder = reorderItems(optimisticCategories, draggingId, targetId);
    setDraggingId(null);
    startTransition(async () => {
      setOptimisticCategories(nextOrder);
      await onReorder(nextOrder.map((item) => item.id));
    });
  }

  return (
    <div className="space-y-3">
      {optimisticCategories.map((category) => (
        <article
          key={category.id}
          draggable
          onDragStart={() => setDraggingId(category.id)}
          onDragEnd={() => setDraggingId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => handleDrop(category.id)}
          className={`rounded-[22px] border bg-white px-4 py-4 transition ${
            draggingId === category.id ? "border-[#ff8b73] opacity-60" : "border-slate-200"
          }`}
        >
          <details>
            <summary className="cursor-pointer list-none">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 text-slate-400">::</span>
                  <div>
                    <p className="text-xl font-semibold text-slate-900">{category.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{category.productCount} ürün</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {(category.prep_station === "bar" ? "Bar" : category.prep_station === "dessert" ? "Tatli" : "Mutfak")} Istasyonu
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">#{category.sort_order}</span>
              </div>
            </summary>
            <form action={onStationUpdate} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input type="hidden" name="categoryId" value={category.id} />
              <select name="prepStation" defaultValue={category.prep_station ?? "kitchen"} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <option value="kitchen">Mutfak Istasyonu</option>
                <option value="bar">Bar Istasyonu</option>
                <option value="dessert">Tatli Istasyonu</option>
              </select>
              <button type="submit" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                Istasyonu Kaydet
              </button>
            </form>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                {isPending ? "Sıra güncelleniyor..." : "Sürükle bırak ile yer degistir"}
              </p>
              <form action={onDelete}>
                <input type="hidden" name="categoryId" value={category.id} />
                <button
                  type="submit"
                  disabled={category.productCount > 0 || isPending}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sil
                </button>
              </form>
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}
