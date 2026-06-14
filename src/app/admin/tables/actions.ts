"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  assignTableZone,
  bulkCreateTables,
  bulkDeleteTablesByIds,
  bulkDeleteTables,
  bulkDeleteTableZones,
  createTable,
  createTableZone,
  deleteTable,
  deleteTableZone,
  moveTableOrder,
  setTableSupervisor,
  updateTableStatus,
  updateTableDetails,
} from "@/lib/domains/tables";
import { feedbackHref } from "./helpers";

function readZoneValue(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw || raw === "__none__") {
    return null;
  }
  return raw;
}

function readZoneScopeValue(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw || raw === "__all__") {
    return undefined;
  }
  if (raw === "__none__") {
    return null;
  }
  return raw;
}

export async function addTableAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const tableNumber = Number(formData.get("tableNumber"));
  const tableName = String(formData.get("tableName") ?? "").trim();
  const zoneId = readZoneValue(formData, "zoneId");
  if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
    redirect(feedbackHref("error", "Yeni masa numarasi pozitif bir tam sayi olmali."));
  }

  try {
    const result = await createTable(tableNumber, tableName, { zoneId });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Masa oluşturulamadı."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", "Yeni masa oluşturuldu."));
  } catch {
    redirect(feedbackHref("error", "Masa oluşturulamadı. Numara zaten kullanılıyor olabilir."));
  }
}

export async function updateTableAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const tableId = String(formData.get("tableId") ?? "");
  const tableNumber = Number(formData.get("tableNumber"));
  const tableName = String(formData.get("tableName") ?? "").trim();
  if (!tableId || !Number.isInteger(tableNumber) || tableNumber <= 0) {
    redirect(feedbackHref("error", "Masa bilgilerini kaydetmek için gecerli bir masa no girin."));
  }

  try {
    const result = await updateTableDetails({ tableId, tableNumber, name: tableName });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Masa bilgileri güncellenemedi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", "Masa bilgileri güncellendi."));
  } catch {
    redirect(feedbackHref("error", "Masa bilgileri güncellenemedi."));
  }
}

export async function updateTableStatusAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const tableId = String(formData.get("tableId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as "empty" | "reserved";
  if (!tableId || (status !== "empty" && status !== "reserved")) {
    redirect(feedbackHref("error", "Masa durumu güncellemek için gecerli alanlar gerekli."));
  }

  try {
    const result = await updateTableStatus({ tableId, status });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Masa durumu güncellenemedi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", status === "reserved" ? "Masa rezerveye alındı." : "Masa boş duruma alındı."));
  } catch {
    redirect(feedbackHref("error", "Masa durumu güncellenemedi."));
  }
}

export async function deleteTableAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const tableId = formData.get("tableId");
  if (typeof tableId !== "string") {
    redirect(feedbackHref("error", "Silinecek masa bulunamadı."));
  }

  try {
    const result = await deleteTable(tableId);
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Masa silinemedi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", "Masa silindi."));
  } catch {
    redirect(feedbackHref("error", "Masa silinemedi. Aktif operasyonu olan masalar silinemez."));
  }
}

export async function moveTableOrderAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const sourceTableId = String(formData.get("sourceTableId") ?? "");
  const targetTableId = String(formData.get("targetTableId") ?? "");
  if (!sourceTableId || !targetTableId) {
    redirect(feedbackHref("error", "Adisyonu taşımak için kaynak ve hedef masa seçilmeli."));
  }

  try {
    const result = await moveTableOrder({ sourceTableId, targetTableId });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Adisyon tasinamadi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    revalidatePath("/cashier");
    redirect(feedbackHref("success", "Adisyon yeni masaya tasindi."));
  } catch {
    redirect(feedbackHref("error", "Adisyon yeni masaya tasinamadi."));
  }
}

export async function createZoneAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const zoneName = String(formData.get("zoneName") ?? "").trim();
  if (zoneName.length < 2) {
    redirect(feedbackHref("error", "Bölge adi en az 2 karakter olmali."));
  }

  try {
    const result = await createTableZone(zoneName);
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Bölge oluşturulamadı."));
    }
    revalidatePath("/admin/tables");
    redirect(feedbackHref("success", "Yeni bölge oluşturuldu."));
  } catch {
    redirect(feedbackHref("error", "Bölge oluşturulamadı."));
  }
}

export async function assignTableZoneAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const tableId = String(formData.get("tableId") ?? "");
  const zoneId = readZoneValue(formData, "zoneId");
  if (!tableId) {
    redirect(feedbackHref("error", "Bölge atamasi için masa bulunamadı."));
  }

  try {
    const result = await assignTableZone({ tableId, zoneId });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Masa bolgesi güncellenemedi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", "Masa bolgesi güncellendi."));
  } catch {
    redirect(feedbackHref("error", "Masa bolgesi güncellenemedi."));
  }
}

export async function setTableSupervisorAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const tableId = String(formData.get("tableId") ?? "").trim();
  const rawProfileId = String(formData.get("profileId") ?? "").trim();
  const profileId = !rawProfileId || rawProfileId === "__none__" ? null : rawProfileId;

  if (!tableId) {
    redirect(feedbackHref("error", "Sorumlu atamasi için masa bulunamadı."));
  }

  try {
    const result = await setTableSupervisor({ tableId, profileId });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Sorumlu garson güncellenemedi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", profileId ? "Sorumlu garson güncellendi." : "Sorumlu garson etiketi kaldirildi."));
  } catch {
    redirect(feedbackHref("error", "Sorumlu garson güncellenemedi."));
  }
}

export async function bulkAddTablesAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const startNumber = Number(formData.get("startNumber"));
  const count = Number(formData.get("count"));
  const namePrefix = String(formData.get("namePrefix") ?? "").trim();
  const zoneId = readZoneValue(formData, "zoneId");

  if (!Number.isInteger(startNumber) || startNumber <= 0) {
    redirect(feedbackHref("error", "Başlangıç masa no pozitif bir tam sayi olmali."));
  }
  if (!Number.isInteger(count) || count <= 0 || count > 200) {
    redirect(feedbackHref("error", "Toplu acilis adedi 1 ile 200 arasinda olmali."));
  }

  try {
    const result = await bulkCreateTables({ startNumber, count, namePrefix, zoneId });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Toplu masa açılışı yapilamadi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(
      feedbackHref(
        "success",
        `${result.createdCount} masa oluşturuldu${result.skippedCount > 0 ? `, ${result.skippedCount} numara atlandi` : ""}.`,
      ),
    );
  } catch {
    redirect(feedbackHref("error", "Toplu masa açılışı yapilamadi."));
  }
}

export async function bulkDeleteTablesAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const startNumber = Number(formData.get("startNumber"));
  const endNumber = Number(formData.get("endNumber"));
  const zoneId = readZoneScopeValue(formData, "zoneId");
  const includeNonEmpty = String(formData.get("includeNonEmpty") ?? "") === "1";

  if (!Number.isInteger(startNumber) || startNumber <= 0) {
    redirect(feedbackHref("error", "Silme başlangıç no pozitif bir tam sayi olmali."));
  }
  if (!Number.isInteger(endNumber) || endNumber <= 0) {
    redirect(feedbackHref("error", "Silme bitiş no pozitif bir tam sayi olmali."));
  }
  if (endNumber < startNumber) {
    redirect(feedbackHref("error", "Silme bitiş no, başlangıç no'dan küçük olamaz."));
  }

  try {
    const result = await bulkDeleteTables({ startNumber, endNumber, zoneId, includeNonEmpty });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Toplu masa silme yapilamadi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(
      feedbackHref(
        "success",
        includeNonEmpty
          ? `${result.deletedCount} masa silindi${result.skippedCount > 0 ? `, ${result.skippedCount} masa atlandi` : ""}.`
          : `${result.deletedCount} masa silindi${result.skippedCount > 0 ? `, ${result.skippedCount} masa (boş olmadigi için) atlandi` : ""}.`,
      ),
    );
  } catch {
    redirect(feedbackHref("error", "Toplu masa silme yapilamadi."));
  }
}

export async function bulkDeleteSelectedTablesAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const tableIds = formData
    .getAll("tableIds")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const includeNonEmpty = String(formData.get("includeNonEmpty") ?? "") === "1";

  if (tableIds.length === 0) {
    redirect(feedbackHref("error", "Toplu silme için en az bir masa seçin."));
  }

  try {
    const result = await bulkDeleteTablesByIds({ tableIds, includeNonEmpty });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Seçili masalar silinemedi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(
      feedbackHref(
        "success",
        includeNonEmpty
          ? `${result.deletedCount} masa silindi${result.skippedCount > 0 ? `, ${result.skippedCount} masa atlandi` : ""}.`
          : `${result.deletedCount} masa silindi${result.skippedCount > 0 ? `, ${result.skippedCount} masa (boş olmadigi için) atlandi` : ""}.`,
      ),
    );
  } catch {
    redirect(feedbackHref("error", "Seçili masalar silinemedi."));
  }
}

export async function deleteZoneAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const zoneId = String(formData.get("zoneId") ?? "").trim();
  if (!zoneId) {
    redirect(feedbackHref("error", "Silinecek bölge bulunamadı."));
  }

  try {
    const result = await deleteTableZone(zoneId);
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Bölge silinemedi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(
      feedbackHref(
        "success",
        `${result.name} bolgesi silindi${result.affectedTableCount > 0 ? `, ${result.affectedTableCount} masa atanmamış duruma alındı` : ""}.`,
      ),
    );
  } catch {
    redirect(feedbackHref("error", "Bölge silinemedi."));
  }
}

export async function bulkDeleteZonesAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const zoneIds = formData
    .getAll("zoneIds")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (zoneIds.length === 0) {
    redirect(feedbackHref("error", "Toplu silme için en az bir bölge seçin."));
  }

  try {
    const result = await bulkDeleteTableZones({ zoneIds });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Toplu bölge silme yapilamadi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(
      feedbackHref(
        "success",
        `${result.deletedCount} bölge silindi${result.skippedCount > 0 ? `, ${result.skippedCount} bölge atlandi` : ""}${result.affectedTableCount > 0 ? `, ${result.affectedTableCount} masa atanmamış duruma alındı` : ""}.`,
      ),
    );
  } catch {
    redirect(feedbackHref("error", "Toplu bölge silme yapilamadi."));
  }
}
