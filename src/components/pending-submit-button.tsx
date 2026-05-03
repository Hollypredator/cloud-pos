"use client";

import { useFormStatus } from "react-dom";
import { toast } from "react-hot-toast";

export function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  disabled = false,
  showToastOnClick = false,
}: {
  idleLabel: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  showToastOnClick?: boolean | string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={() => {
        if (showToastOnClick && !disabled && !pending) {
          const msg = typeof showToastOnClick === "string" ? showToastOnClick : `${idleLabel} işlemi alınıyor...`;
          toast.success(msg, { id: "pending-submit-toast", duration: 2000 });
        }
      }}
      className={`touch-manipulation ${className ?? ""}`}
    >
      {pending ? pendingLabel ?? "Isleniyor..." : idleLabel}
    </button>
  );
}
