import Link from "next/link";
import type { ReactNode } from "react";
import { DASHBOARD_NAV } from "@/lib/dashboard/nav";
import type { UserRole } from "@/lib/auth/types";
import { Alert } from "./alert";

export function DashboardShell({
  title,
  greeting,
  error,
  role,
  children,
}: {
  title: string;
  greeting?: string | null;
  error?: string | null;
  role?: UserRole;
  children: ReactNode;
}) {
  const nav = role && role !== "admin" ? DASHBOARD_NAV[role] : [];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {nav.length > 0 && (
        <nav aria-label="Navigasi dashboard" className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
              {item.label}
            </Link>
          ))}
          <Link href="/akun" className="ml-auto rounded px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Akun</Link>
        </nav>
      )}
      <h1 className="text-2xl font-bold text-brand-900">{title}</h1>
      {greeting && <p className="mt-1 text-slate-600">{greeting}</p>}
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}
