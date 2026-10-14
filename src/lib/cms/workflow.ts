// Alur status berita (logika murni). Ditegakkan juga oleh RLS di database.

export type NewsStatus = "draft" | "review" | "published" | "archived";
export type DisplayStatus = NewsStatus | "scheduled";
export type NewsIntent = "save" | "submit" | "publish" | "return" | "archive" | "restore";

export const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: "Draf",
  review: "Menunggu persetujuan",
  scheduled: "Terjadwal",
  published: "Terbit",
  archived: "Arsip",
};

export const DISPLAY_STATUS_STYLE: Record<DisplayStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  review: "bg-amber-100 text-amber-900",
  scheduled: "bg-teal-50 text-teal-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-slate-200 text-slate-600",
};

export function displayStatus(status: string, publishedAt: string | null, now: Date = new Date()): DisplayStatus {
  if (status === "published" && publishedAt && new Date(publishedAt).getTime() > now.getTime()) return "scheduled";
  return (["draft", "review", "published", "archived"].includes(status) ? status : "draft") as DisplayStatus;
}

export type Access = { canWrite: boolean; canPublish: boolean };

// Tindakan yang boleh dilakukan pada berita dengan status tertentu.
export function allowedIntents(access: Access, status: NewsStatus | null, isAuthor: boolean): NewsIntent[] {
  if (!access.canWrite) return [];
  if (access.canPublish) {
    switch (status) {
      case null:
        return ["save", "submit", "publish"];
      case "draft":
        return ["save", "submit", "publish", "archive"];
      case "review":
        return ["save", "publish", "return", "archive"];
      case "published":
        return ["save", "archive"];
      case "archived":
        return ["restore"];
    }
  }
  // Editor: hanya berita sendiri yang masih draf/review.
  if (status === null) return ["save", "submit"];
  if (!isAuthor) return [];
  if (status === "draft") return ["save", "submit"];
  if (status === "review") return ["save"];
  return [];
}

// Status tujuan untuk sebuah tindakan.
export function targetStatus(intent: NewsIntent, current: NewsStatus | null): NewsStatus {
  switch (intent) {
    case "submit":
      return "review";
    case "publish":
      return "published";
    case "return":
    case "restore":
      return "draft";
    case "archive":
      return "archived";
    case "save":
      return current ?? "draft";
  }
}
