#!/usr/bin/env bash
# =============================================================================
# Pemulihan backup database ke database TUJUAN yang sudah berisi struktur
# (migrasi sudah diterapkan). Isi tabel tujuan yang ada di backup DIGANTI.
#
# Pemakaian (uji pemulihan, cara yang disarankan):
#   export RESTORE_DB_URL='postgresql://…proyek-UJI…'
#   export BACKUP_PASSPHRASE='…'
#   ./scripts/restore-db.sh backups/db-20261014T020000Z.tar.gz.enc --ya
#
# PENGAMAN PRODUKSI: bila RESTORE_DB_URL sama dengan SUPABASE_DB_URL atau
# memuat PRODUCTION_PROJECT_REF, skrip MENOLAK kecuali diberi --produksi DAN
# petugas mengetik ulang kalimat konfirmasi di terminal. Pemulihan ke produksi
# hanya boleh dengan persetujuan tertulis sekolah (lihat PANDUAN_BACKUP_PEMULIHAN.md).
# =============================================================================
set -euo pipefail

FILE="${1:?Sebutkan file backup (.tar.gz.enc atau .tar.gz).}"
shift || true
YES=0; PROD=0
for arg in "$@"; do
  case "$arg" in
    --ya) YES=1 ;;
    --produksi) PROD=1 ;;
    *) echo "Argumen tidak dikenal: $arg" >&2; exit 2 ;;
  esac
done
TARGET="${RESTORE_DB_URL:?Isi RESTORE_DB_URL (database tujuan pemulihan).}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
sha() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }

# --- Pengaman produksi -------------------------------------------------------
is_production=0
if [ -n "${SUPABASE_DB_URL:-}" ] && [ "$TARGET" = "$SUPABASE_DB_URL" ]; then is_production=1; fi
if [ -n "${PRODUCTION_PROJECT_REF:-}" ] && [[ "$TARGET" == *"$PRODUCTION_PROJECT_REF"* ]]; then is_production=1; fi
if [ "$is_production" = "1" ]; then
  if [ "$PROD" != "1" ]; then
    echo "DITOLAK: tujuan pemulihan adalah database PRODUKSI." >&2
    echo "Pulihkan ke proyek uji. Pemulihan produksi butuh --produksi + persetujuan tertulis sekolah." >&2
    exit 3
  fi
  if [ ! -t 0 ]; then
    echo "DITOLAK: pemulihan produksi harus dijalankan interaktif di terminal." >&2
    exit 3
  fi
  PHRASE="PULIHKAN PRODUKSI ${PRODUCTION_PROJECT_REF:-}"
  echo "PERINGATAN: seluruh data aplikasi di PRODUKSI akan diganti dengan isi backup ini."
  read -r -p "Ketik persis \"$PHRASE\" untuk melanjutkan: " typed
  [ "$typed" = "$PHRASE" ] || { echo "Dibatalkan."; exit 3; }
elif [ "$YES" != "1" ]; then
  if [ ! -t 0 ]; then echo "Tambahkan --ya untuk menjalankan tanpa pertanyaan." >&2; exit 2; fi
  read -r -p "Isi tabel di database tujuan akan diganti. Lanjutkan? (ketik ya): " typed
  [ "$typed" = "ya" ] || { echo "Dibatalkan."; exit 1; }
fi

# --- Buka & periksa backup ---------------------------------------------------
if [ -f "$FILE.sha256" ]; then
  (cd "$(dirname "$FILE")" && sha -c "$(basename "$FILE").sha256" >/dev/null) || { echo "Checksum file backup TIDAK cocok." >&2; exit 4; }
  echo "✓ Checksum file backup cocok."
fi
case "$FILE" in
  *.enc)
    : "${BACKUP_PASSPHRASE:?Isi BACKUP_PASSPHRASE untuk membuka backup terenkripsi.}"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" -out "$WORK/backup.tar.gz" \
      || { echo "Gagal membuka backup (frasa sandi salah atau file rusak)." >&2; exit 4; } ;;
  *) cp "$FILE" "$WORK/backup.tar.gz" ;;
esac
tar -C "$WORK" -xzf "$WORK/backup.tar.gz"
DIR="$(find "$WORK" -mindepth 1 -maxdepth 1 -type d -name 'db-*' | head -1)"
[ -n "$DIR" ] || { echo "Isi backup tidak dikenali." >&2; exit 4; }
(cd "$DIR" && sha -c SHA256SUMS >/dev/null) || { echo "Checksum isi backup TIDAK cocok." >&2; exit 4; }
echo "✓ Isi backup utuh ($(grep dibuat_utc "$DIR/manifest.txt"))."

# --- Prasyarat database tujuan -----------------------------------------------
if [ "$(psql "$TARGET" -At -c "select to_regclass('public.profiles') is not null")" != "t" ]; then
  echo "Database tujuan belum berisi struktur. Terapkan migrasi dulu (supabase db push)." >&2
  exit 5
fi

# --- Pulihkan dalam SATU transaksi -------------------------------------------
TABLES="$(cut -f1 "$DIR/rows.tsv" | paste -sd, -)"
{
  echo "set session_replication_role = replica;"
  echo "truncate table $TABLES cascade;"
} > "$WORK/pre.sql"
echo "→ Memulihkan $(wc -l < "$DIR/rows.tsv" | tr -d ' ') tabel…"
psql "$TARGET" --quiet --single-transaction -v ON_ERROR_STOP=1 -f "$WORK/pre.sql" -f "$DIR/data.sql" >/dev/null

# --- Verifikasi jumlah baris -------------------------------------------------
fail=0
while IFS=$'\t' read -r table expected; do
  actual="$(psql "$TARGET" -At -c "select count(*) from $table")"
  if [ "$actual" != "$expected" ]; then
    echo "✗ $table: backup $expected, hasil $actual"; fail=1
  fi
done < "$DIR/rows.tsv"
if [ "$fail" = "1" ]; then
  echo "Verifikasi GAGAL. Jangan gunakan database tujuan; laporkan ke pengembang." >&2
  exit 6
fi
echo "✓ Pemulihan selesai & terverifikasi: jumlah baris semua tabel sama dengan backup."
echo "  Lanjutkan: pulihkan file Storage (restore-storage.mjs) lalu buka /admin/status."
