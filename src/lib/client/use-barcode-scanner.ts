"use client";

import { useEffect, useRef } from "react";

type UseBarcodeScannerOptions = {
  enabled?: boolean;
  minLength?: number;
  idleMs?: number;
  ignoreFocusedInput?: boolean;
  onScan: (value: string) => void;
};

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function useBarcodeScanner(options: UseBarcodeScannerOptions) {
  const {
    enabled = true,
    minLength = 3,
    idleMs = 120,
    ignoreFocusedInput = true,
    onScan,
  } = options;
  const onScanRef = useRef(onScan);
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      bufferRef.current = "";
      lastKeyAtRef.current = 0;
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (ignoreFocusedInput && isEditableElement(event.target)) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyAtRef.current > idleMs) {
        bufferRef.current = "";
      }
      lastKeyAtRef.current = now;

      if (event.key === "Enter") {
        const value = bufferRef.current.trim();
        bufferRef.current = "";
        if (value.length >= minLength) {
          event.preventDefault();
          onScanRef.current(value);
        }
        return;
      }

      if (event.key.length !== 1) {
        return;
      }
      bufferRef.current += event.key;
    };

    const onWindowBlur = () => {
      bufferRef.current = "";
      lastKeyAtRef.current = 0;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [enabled, idleMs, ignoreFocusedInput, minLength]);
}
