import type { ReactNode } from "react";
import { Alert } from "./alert";

export function DashboardShell({
  title,
  greeting,
  error,
  children,
}: {
  title: string;
  greeting?: string | null;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-brand-900">{title}</h1>
      {greeting && <p className="mt-1 text-slate-600">{greeting}</p>}
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}
