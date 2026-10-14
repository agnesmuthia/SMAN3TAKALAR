#!/usr/bin/env bash
# =============================================================================
# Backup database (logis) — data aplikasi sekolah dari Supabase.
#
# Isi backup:
#   * data semua tabel schema public (konten, akun, jadwal, SK, langganan, log)
#   * auth.users & auth.identities (agar akun & login tetap sama setelah pulih)
#   * storage.objects (METADATA file; isi file dibackup terpisah dengan
#     scripts/backup-storage.mjs)
#   * schema public (sebagai referensi; struktur dipulihkan dari migrasi)
# Seluruh data diambil dalam SATU snapshot (pg_dump) sehingga konsisten.
#
# Pemakaian:
#   export SUPABASE_DB_URL='postgresql://postgres.<ref>:<sandi>@<host>:5432/postgres'
#   export BACKUP_PASSPHRASE='<frasa sandi panjang, simpan di pengelola sandi>'
#   ./scripts/backup-db.sh [folder-tujuan]        (bawaan: ./backups)
#
# Tanpa BACKUP_PASSPHRASE backup TIDAK dienkripsi (hanya untuk uji lokal);
# skrip menolak kecuali BACKUP_ALLOW_PLAINTEXT=1.
# Butuh: pg_dump & psql (versi mayor >= versi server), openssl, sha256sum/shasum.
# =============================================================================
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:?Isi SUPABASE_DB_URL (connection string database, bukan URL API).}"
OUT_ROOT="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="db-${STAMP}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

sha() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }

if [ -z "${BACKUP_PASSPHRASE:-}" ] && [ "${BACKUP_ALLOW_PLAINTEXT:-}" != "1" ]; then
  echo "BACKUP_PASSPHRASE belum diisi. Backup berisi data pribadi dan wajib dienkripsi." >&2
  exit 2
fi

mkdir -p "$OUT_ROOT" "$WORK/$NAME"
DIR="$WORK/$NAME"

# Peringatan pg_dump tentang "circular foreign-key constraints" (profiles,
# galeri) wajar: saat pemulihan, pemeriksaan FK dimatikan sementara dengan
# session_replication_role = replica sehingga urutan pemuatan tidak masalah.
echo "→ Mengambil data (satu snapshot)…"
pg_dump "$DB_URL" --data-only --no-owner --no-privileges \
  --table='public.*' --table='auth.users' --table='auth.identities' --table='storage.objects' \
  --file="$DIR/data.sql"

echo "→ Mengambil struktur schema public (referensi)…"
pg_dump "$DB_URL" --schema-only --no-owner --no-privileges --schema=public --file="$DIR/schema-public.sql"

echo "→ Menyusun manifest…"
# Jumlah baris per tabel dihitung dari isi backup itu sendiri (blok COPY).
awk '/^COPY /{t=$2; n=0; next} /^\\\.$/{if (t!="") print t"\t"n; t=""; next} t!=""{n++}' "$DIR/data.sql" > "$DIR/rows.tsv"
{
  echo "dibuat_utc=$STAMP"
  echo "pg_dump=$(pg_dump --version)"
  echo "server=$(psql "$DB_URL" -At -c 'show server_version')"
  echo "migrasi_terakhir=$(psql "$DB_URL" -At -c "select coalesce((select max(version) from supabase_migrations.schema_migrations), 'tidak tercatat')" 2>/dev/null || echo 'tidak tercatat')"
  echo "tabel=$(wc -l < "$DIR/rows.tsv" | tr -d ' ')"
} > "$DIR/manifest.txt"
(cd "$DIR" && sha data.sql schema-public.sql rows.tsv > SHA256SUMS)

tar -C "$WORK" -czf "$WORK/$NAME.tar.gz" "$NAME"
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE \
    -in "$WORK/$NAME.tar.gz" -out "$OUT_ROOT/$NAME.tar.gz.enc"
  FINAL="$OUT_ROOT/$NAME.tar.gz.enc"
else
  cp "$WORK/$NAME.tar.gz" "$OUT_ROOT/$NAME.tar.gz"
  FINAL="$OUT_ROOT/$NAME.tar.gz"
  echo "PERINGATAN: backup TIDAK terenkripsi (BACKUP_ALLOW_PLAINTEXT=1)." >&2
fi
(cd "$(dirname "$FINAL")" && sha "$(basename "$FINAL")" > "$(basename "$FINAL").sha256")

echo "✓ Backup selesai: $FINAL"
echo "  Tabel: $(wc -l < "$DIR/rows.tsv" | tr -d ' ') · Baris total: $(awk -F'\t' '{s+=$2} END{print s+0}' "$DIR/rows.tsv")"
echo "  Simpan juga file .sha256-nya. Ingat: isi file Storage dibackup terpisah (backup-storage.mjs)."
