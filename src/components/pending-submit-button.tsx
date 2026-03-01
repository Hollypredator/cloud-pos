"use client";

import { useFormStatus } from "react-dom";

export function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  disabled = false,
}: {
  idleLabel: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? pendingLabel ?? "Isleniyor..." : idleLabel}
    </button>
  );
}
