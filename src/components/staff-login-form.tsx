"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type StaffLoginFormProps = {
  next?: string;
  error?: string;
  labels: {
    email: string;
    emailPlaceholder: string;
    password: string;
    loginCta: string;
    pendingCta: string;
  };
};

export function StaffLoginForm({ next, error, labels }: StaffLoginFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setLocalError(null);
    setSubmitting(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    submitTimeoutRef.current = setTimeout(() => {
      controller.abort();
      setSubmitting(false);
      setLocalError("Giriş isteği zaman asimina ugradi. Lütfen tekrar deneyin.");
    }, 20_000);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("mode", "ajax");
      const response = await fetch("/auth/login", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: {
          "x-cloudpos-login-mode": "ajax",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        setLocalError("Giriş isteği tamamlanamadi. Lütfen tekrar deneyin.");
        return;
      }

      const payload = (await response.json()) as {
        ok?: boolean;
        redirectTo?: string;
        message?: string;
      };

      const redirectTo = typeof payload.redirectTo === "string" && payload.redirectTo.startsWith("/")
        ? payload.redirectTo
        : "/ops";

      if (!payload.ok && payload.message) {
        setLocalError(payload.message);
      }

      window.location.assign(redirectTo);
    } catch (requestError) {
      if ((requestError as { name?: string } | null)?.name === "AbortError") {
        setLocalError("Giriş isteği zaman asimina ugradi. Lütfen tekrar deneyin.");
      } else {
        setLocalError("Giriş isteği tamamlanamadi. Lütfen tekrar deneyin.");
      }
    } finally {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }
      abortControllerRef.current = null;
      setSubmitting(false);
    }
  }

  return (
    <form action="/auth/login" method="post" className="space-y-4" onSubmit={onSubmit}>
      <input type="hidden" name="next" value={next ?? "/ops"} />
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          {labels.email}
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          disabled={submitting}
          placeholder={labels.emailPlaceholder}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          {labels.password}
        </label>
        <input
          id="password"
          type="password"
          name="password"
          required
          disabled={submitting}
          placeholder="********"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? labels.pendingCta : labels.loginCta}
      </button>
      {localError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{localError}</p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
    </form>
  );
}
