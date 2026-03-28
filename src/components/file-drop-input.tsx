"use client";

import { useRef, useState } from "react";

const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.82;
const MIN_COMPRESSION_GAIN_RATIO = 0.95;

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeFileBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-");
}

async function compressImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    return { file, compressed: false, originalSize: file.size, finalSize: file.size };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const longerSide = Math.max(bitmap.width, bitmap.height);
    const scale = longerSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longerSide : 1;
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { file, compressed: false, originalSize: file.size, finalSize: file.size };
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const webpBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/webp", IMAGE_QUALITY),
    );

    if (!webpBlob || webpBlob.size >= file.size * MIN_COMPRESSION_GAIN_RATIO) {
      return { file, compressed: false, originalSize: file.size, finalSize: file.size };
    }

    const baseName = normalizeFileBaseName(file.name || "image");
    const compressedFile = new File([webpBlob], `${baseName || "image"}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      compressed: true,
      originalSize: file.size,
      finalSize: compressedFile.size,
    };
  } catch {
    return { file, compressed: false, originalSize: file.size, finalSize: file.size };
  } finally {
    bitmap?.close();
  }
}

export function FileDropInput({
  name,
  label,
  helper,
  accept = "image/*",
  className,
}: {
  name: string;
  label: string;
  helper?: string;
  accept?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [uploadMeta, setUploadMeta] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  async function applyFile(file: File | null) {
    if (!file || !inputRef.current) {
      return;
    }
    setIsProcessing(true);
    const optimized = await compressImageFile(file);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(optimized.file);
    inputRef.current.files = dataTransfer.files;
    setSelectedFileName(optimized.file.name);
    setUploadMeta(
      optimized.compressed
        ? `Sikistirildi: ${formatBytes(optimized.originalSize)} -> ${formatBytes(optimized.finalSize)}`
        : `Boyut: ${formatBytes(optimized.finalSize)}`,
    );
    setIsProcessing(false);
  }

  return (
    <div className={className ?? "w-full"}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</label>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          void applyFile(event.dataTransfer.files?.[0] ?? null);
        }}
        className={`rounded-2xl border border-dashed px-4 py-3 text-sm transition ${
          isDragActive ? "border-[#ff5a34] bg-orange-50 text-slate-900" : "border-slate-300 bg-slate-50 text-slate-600"
        }`}
      >
        <input
          ref={inputRef}
          name={name}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            void applyFile(event.target.files?.[0] ?? null);
          }}
        />
        <p className="font-medium text-slate-800">Sürükle bırak veya tiklayip sec</p>
        <p className="mt-1 text-xs text-slate-500">
          {isProcessing ? "Görsel optimize ediliyor..." : selectedFileName || "PNG, JPG, WEBP gibi görsel dosyalari desteklenir."}
        </p>
        {uploadMeta ? <p className="mt-1 text-xs font-medium text-slate-600">{uploadMeta}</p> : null}
      </div>
      {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}
