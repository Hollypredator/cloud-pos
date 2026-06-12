"use client";

import { useMemo, useState } from "react";
import { defaultAdminSidebarOrder, defaultOwnerSidebarOrder, operationLinks, sidebarPresetOrders } from "@/lib/sidebar-config";

type SidebarCustomizerProps = {
  initialAccentColor: string;
  initialOwnerOrder: string[];
  initialAdminOrder: string[];
};

type TargetRole = "owner" | "admin";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = operationLinks.map((item) => ({
  href: item.href,
  label: item.label,
  icon: item.icon,
}));

function ensureOrder(base: readonly string[], fallback: readonly string[]) {
  const seen = new Set<string>();
  const merged = [...base, ...fallback].filter((href) => {
    if (seen.has(href)) return false;
    seen.add(href);
    return navItems.some((item) => item.href === href);
  });
  return merged;
}

function NavOrderList({
  role,
  items,
  onReorder,
}: {
  role: TargetRole;
  items: string[];
  onReorder: (role: TargetRole, next: string[]) => void;
}) {
  const [draggingHref, setDraggingHref] = useState<string | null>(null);

  const orderedItems = items
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));

  return (
    <div className="space-y-2">
      {orderedItems.map((item, index) => (
        <button
          key={`${role}-${item.href}`}
          type="button"
          draggable
          onDragStart={() => setDraggingHref(item.href)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!draggingHref || draggingHref === item.href) return;
            const current = [...items];
            const fromIndex = current.indexOf(draggingHref);
            const toIndex = current.indexOf(item.href);
            if (fromIndex === -1 || toIndex === -1) return;
            current.splice(fromIndex, 1);
            current.splice(toIndex, 0, draggingHref);
            onReorder(role, current);
            setDraggingHref(null);
          }}
          onDragEnd={() => setDraggingHref(null)}
          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
            draggingHref === item.href
              ? "border-[#ff7848] bg-[#fff4ef] text-slate-900"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white">
              {item.icon}
            </span>
            <div>
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="text-xs text-slate-500">Sira {index + 1}</p>
            </div>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sürükle</span>
        </button>
      ))}
    </div>
  );
}

export function SidebarCustomizer({
  initialAccentColor,
  initialOwnerOrder,
  initialAdminOrder,
}: SidebarCustomizerProps) {
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [ownerOrder, setOwnerOrder] = useState(ensureOrder(initialOwnerOrder, defaultOwnerSidebarOrder));
  const [adminOrder, setAdminOrder] = useState(ensureOrder(initialAdminOrder, defaultAdminSidebarOrder));

  const previewStyle = useMemo(
    () => ({
      backgroundImage: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
      boxShadow: `0 14px 24px ${accentColor}44`,
    }),
    [accentColor],
  );

  function handleReorder(role: TargetRole, next: string[]) {
    if (role === "owner") {
      setOwnerOrder(next);
      return;
    }
    setAdminOrder(next);
  }

  function applyPreset(role: TargetRole, preset: "management_first" | "service_first") {
    const next =
      role === "owner"
        ? ensureOrder([...sidebarPresetOrders.owner[preset]], defaultOwnerSidebarOrder)
        : ensureOrder([...sidebarPresetOrders.admin[preset]], defaultAdminSidebarOrder);
    handleReorder(role, next);
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="sidebarAccentColor" value={accentColor} />
      <input type="hidden" name="ownerSidebarOrder" value={JSON.stringify(ownerOrder)} />
      <input type="hidden" name="adminSidebarOrder" value={JSON.stringify(adminOrder)} />

      <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Accent rengi</p>
          <p className="mt-1 text-sm text-slate-500">Aktif menü, vurgu ve kapsül alanlari bu renge göre akar.</p>
          <div className="mt-4 flex items-center gap-4">
            <input
              type="color"
              value={accentColor}
              onChange={(event) => setAccentColor(event.target.value)}
              className="h-14 w-16 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(event) => setAccentColor(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>
          <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Onizleme</p>
            <div className="mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 text-white" style={previewStyle}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xs font-bold">OP</span>
              <div>
                <p className="text-sm font-semibold">Aktif Menü Ogesi</p>
                <p className="text-xs text-white/75">Seçecegin renk burada gorunecek</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Rol bazli presetler</p>
          <p className="mt-1 text-sm text-slate-500">Patron ile şube yöneticisi farkli onceliklerle calisabilir.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Patron presetleri</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => applyPreset("owner", "management_first")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  Yönetim Önce
                </button>
                <button type="button" onClick={() => applyPreset("owner", "service_first")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  Servis Önce
                </button>
              </div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Yönetici presetleri</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => applyPreset("admin", "service_first")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  Servis Önce
                </button>
                <button type="button" onClick={() => applyPreset("admin", "management_first")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  Yönetim Önce
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4">
            <p className="text-lg font-semibold text-slate-900">Patron Sidebar Sirasi</p>
            <p className="mt-1 text-sm text-slate-500">Tüm şubeleri goren kullanicilar için menuyu surukleyip sirala.</p>
          </div>
          <NavOrderList role="owner" items={ownerOrder} onReorder={handleReorder} />
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4">
            <p className="text-lg font-semibold text-slate-900">Yönetici Sidebar Sirasi</p>
            <p className="mt-1 text-sm text-slate-500">Şube yöneticileri için daha operasyon odaklı akışı belirle.</p>
          </div>
          <NavOrderList role="admin" items={adminOrder} onReorder={handleReorder} />
        </div>
      </div>
    </div>
  );
}
