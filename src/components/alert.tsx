import type { ReactNode } from "react";

const STYLES = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-green-200 bg-green-50 text-green-900",
} as const;

export function Alert({ tone = "info", children }: { tone?: keyof typeof STYLES; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border p-3 text-sm ${STYLES[tone]}`}>
      {children}
    </div>
  );
}
