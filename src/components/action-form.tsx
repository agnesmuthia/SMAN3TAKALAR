"use client";

import { useActionState, type ReactNode } from "react";

export type ActionFormState = { status: "idle" | "success" | "error"; message: string };

// Formulir generik berbasis server action dengan pesan status yang aksesibel.
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Memproses…",
  className = "space-y-4",
  hideOnSuccess = false,
  submitClassName = "btn-primary w-full",
}: {
  action: (prev: ActionFormState, formData: FormData) => Promise<ActionFormState>;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  hideOnSuccess?: boolean;
  submitClassName?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionFormState, FormData>(action, { status: "idle", message: "" });

  if (hideOnSuccess && state.status === "success") {
    return <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-800">{state.message}</p>;
  }

  return (
    <form action={formAction} className={className}>
      {children}
      {state.status === "error" && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
      {state.status === "success" && <p role="status" className="text-sm text-green-700">{state.message}</p>}
      <button type="submit" className={submitClassName} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
