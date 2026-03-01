"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createTable, deleteTable, moveTableOrder, updateTableDetails } from "@/lib/data";
import { feedbackHref } from "./helpers";

export async function addTableAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const tableNumber = Number(formData.get("tableNumber"));
  const tableName = String(formData.get("tableName") ?? "").trim();
  if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
    redirect(feedbackHref("error", "Yeni masa numarasi pozitif bir tam sayi olmali."));
  }

  try {
    const result = await createTable(tableNumber, tableName);
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Masa olusturulamadi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", "Yeni masa olusturuldu."));
  } catch {
    redirect(feedbackHref("error", "Masa olusturulamadi. Numara zaten kullaniliyor olabilir."));
  }
}

export async function updateTableAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const tableId = String(formData.get("tableId") ?? "");
  const tableNumber = Number(formData.get("tableNumber"));
  const tableName = String(formData.get("tableName") ?? "").trim();
  if (!tableId || !Number.isInteger(tableNumber) || tableNumber <= 0) {
    redirect(feedbackHref("error", "Masa bilgilerini kaydetmek icin gecerli bir masa no girin."));
  }

  try {
    const result = await updateTableDetails({ tableId, tableNumber, name: tableName });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Masa bilgileri guncellenemedi."));
    }
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", "Masa bilgileri guncellendi."));
  } catch {
    redirect(feedbackHref("error", "Masa bilgileri guncellenemedi."));
  }
}

export async function deleteTableAction(formData: FormData) {
  await requireRole(["admin"], "/admin/tables");

  const tableId = formData.get("tableId");
  if (typeof tableId !== "string") {
    redirect(feedbackHref("error", "Silinecek masa bulunamadi."));
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
    redirect(feedbackHref("error", "Adisyonu tasimak icin kaynak ve hedef masa secilmeli."));
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
