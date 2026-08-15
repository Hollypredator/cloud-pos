/**
 * Mutfak istasyon durumu hesabi: sunucu (`/m/kitchen` page.tsx, board
 * sayaclari icin) ve istemci (`MobileKitchenUi`, siralama/gecikme rozeti
 * icin) AYNI saf mantigi kullanir. Daha once bu iki fonksiyon page.tsx'te
 * tanimlanip prop olarak client bilesene geciriliyordu — Next.js sunucu
 * bilesenden istemciye SADECE server action (`"use server"`) fonksiyon
 * gecirmeye izin verir, duz fonksiyonlar degil. Sonuc: `/m/kitchen` her
 * acilista "Functions cannot be passed directly to Client Components"
 * hatasiyla patliyordu. Cozum prop degil, ortak import.
 */

export type KitchenStation = "kitchen" | "bar" | "dessert";
export type StationProgress = "pending" | "preparing" | "served";

export type StationStatusOrder = {
  status: string;
  station_statuses?: Record<string, string> | null;
};

export function resolveStationStatus(order: StationStatusOrder, station: KitchenStation): StationProgress {
  const stationStatus = order.station_statuses?.[station];
  if (stationStatus === "pending" || stationStatus === "preparing" || stationStatus === "served") {
    return stationStatus;
  }
  if (order.status === "pending" || order.status === "preparing") {
    return order.status as StationProgress;
  }
  if (order.status === "ready" || order.status === "served" || order.status === "partially_paid") {
    return "served";
  }
  return "pending";
}

export function getDelayLevel(status: string, createdAt: string) {
  const elapsedMin = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (status === "pending" && elapsedMin >= 15) return { delayed: true, critical: elapsedMin >= 25, elapsedMin };
  if (status === "preparing" && elapsedMin >= 20) return { delayed: true, critical: elapsedMin >= 35, elapsedMin };
  return { delayed: false, critical: false, elapsedMin };
}
