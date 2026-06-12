import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth";
import { createMediaAsset, uploadMediaFile } from "@/lib/data";
import { getPlatformAccessByEmail, getStudioAccessByEmail, hasPlatformPermission } from "@/lib/domains/support";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import { getDirectPlatformOwnerEmails } from "@/lib/platform-owner";
import type { MediaAsset } from "@/lib/types";

function resolveMediaKind(value: string): MediaAsset["kind"] {
  if (value === "document" || value === "video" || value === "other") {
    return value;
  }
  return "image";
}

async function hasStudioWriteAccess() {
  const auth = await getCurrentUserWithRole();
  if (auth.usingDemoData) {
    return { ok: false as const, status: 503, message: "Demo modda medya yukleme kapali." };
  }

  if (!auth.user?.email) {
    return { ok: false as const, status: 401, message: "Yetkisiz" };
  }

  const email = auth.user.email.toLowerCase();
  if (getDirectPlatformOwnerEmails().has(email)) {
    return { ok: true as const };
  }

  const platformAccess = await getPlatformAccessByEmail(email);
  if (platformAccess.hasAccess && hasPlatformPermission(platformAccess, "studio.write")) {
    return { ok: true as const };
  }

  const studioAccess = await getStudioAccessByEmail(email);
  if (!studioAccess.hasAccess) {
    return { ok: false as const, status: 403, message: "Studio erisimi yok." };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) =>
    withCorrelationId(NextResponse.json(body, init), correlationId);
  const access = await hasStudioWriteAccess();
  if (!access.ok) {
    logApiEvent("warn", "studio.media.upload.forbidden", { correlationId, status: access.status });
    return json({ ok: false, error: access.message }, { status: access.status });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    logApiEvent("warn", "studio.media.upload.invalid_file", { correlationId });
    return json({ ok: false, error: "Gecerli dosya gerekli." }, { status: 400 });
  }

  const uploadResult = await uploadMediaFile(file);
  if (!uploadResult.ok) {
    logApiEvent("warn", "studio.media.upload.storage_rejected", { correlationId, error: uploadResult.error });
    return json({ ok: false, error: uploadResult.error }, { status: 400 });
  }
  const fileUrl = uploadResult.fileUrl;
  const mediaUploadLogContext = {
    correlationId,
    storageBucket: uploadResult.storageBucket ?? null,
    storagePath: uploadResult.storagePath ?? null,
  };
  if (!fileUrl) {
    logApiEvent("error", "studio.media.upload.missing_url", mediaUploadLogContext);
    return json({ ok: false, error: "Dosya URL oluşturulamadı." }, { status: 500 });
  }

  const titleInput = String(formData.get("title") ?? "").trim();
  const altText = String(formData.get("altText") ?? "").trim();
  const kind = resolveMediaKind(String(formData.get("kind") ?? "image").trim());
  const title = titleInput || uploadResult.title || "Yeni medya";

  const createResult = await createMediaAsset({
    title,
    fileUrl,
    altText,
    kind,
    storageBucket: uploadResult.storageBucket ?? null,
    storagePath: uploadResult.storagePath ?? null,
  });

  if (!createResult.ok) {
    logApiEvent("error", "studio.media.upload.create_failed", {
      ...mediaUploadLogContext,
      error: createResult.error ?? "unknown",
    });
    return json({ ok: false, error: createResult.error ?? "Medya kaydı oluşturulamadı." }, { status: 500 });
  }

  logApiEvent("info", "studio.media.upload.success", {
    ...mediaUploadLogContext,
    kind,
  });

  return json({
    ok: true,
    fileUrl,
    storageBucket: uploadResult.storageBucket ?? null,
    storagePath: uploadResult.storagePath ?? null,
    title,
    altText,
  });
}
