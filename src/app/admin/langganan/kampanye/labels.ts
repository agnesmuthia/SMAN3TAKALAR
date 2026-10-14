export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: "Draf (belum disetujui)",
  approved: "Disetujui",
  sending: "Sedang dikirim",
  sent: "Terkirim ke penyedia",
  partially_failed: "Sebagian gagal",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  queued: "Antre",
  sending: "Diproses",
  sent: "Diterima penyedia",
  failed: "Gagal",
  bounced: "Bounce",
  complained: "Dilaporkan spam",
  skipped: "Dilewati",
};
