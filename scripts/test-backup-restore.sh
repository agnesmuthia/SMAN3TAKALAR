#!/usr/bin/env bash
# Uji menyeluruh backup → pemulihan pada klaster PostgreSQL SEMENTARA:
#   sumber (migrasi + data fiktif) → backup-db.sh (terenkripsi) →
#   restore-db.sh ke database lain → isi setiap tabel dibandingkan.
# Juga menguji pengaman produksi, frasa sandi salah, dan file rusak.
# Tidak menyentuh Supabase sungguhan.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
export PATH="$PG_BIN:$PATH"
WORK="$(mktemp -d)"
PORT="${PG_TEST_PORT:-54331}"
RUN=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUN=(runuser -u postgres --); fi
cleanup() { "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

url() { echo "postgresql://postgres@/$1?host=$WORK&port=$PORT"; }
q() { psql "$(url "$1")" -v ON_ERROR_STOP=1 -q "${@:2}"; }

export PGOPTIONS="-c client_min_messages=warning"
psql "$(url postgres)" -q -c "create database sumber" >/dev/null
q sumber -f "$ROOT/supabase/tests/00_supabase_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do q sumber -f "$f" >/dev/null; done
# Tujuan = struktur yang sama (stub + semua migrasi), tanpa data uji.
psql "$(url postgres)" -q -c "create database tujuan template sumber" >/dev/null
q sumber -f "$ROOT/supabase/tests/fixtures/data-cadangan.sql" >/dev/null
echo "✓ Dua database uji siap (sumber berisi data fiktif)."

OUT="$WORK/cadangan"; mkdir -p "$OUT"
export BACKUP_PASSPHRASE="frasa-uji-$(date +%s)-bukan-rahasia"
SUPABASE_DB_URL="$(url sumber)" "$ROOT/scripts/backup-db.sh" "$OUT" >/dev/null
FILE="$(ls "$OUT"/db-*.tar.gz.enc)"
echo "✓ Backup terenkripsi dibuat."

expect_exit() {
  local want="$1"; shift
  set +e; "$@" >/dev/null 2>&1; local got=$?; set -e
  [ "$got" = "$want" ] || { echo "✗ diharapkan keluar $want, didapat $got: $*"; exit 1; }
}
# Pengaman produksi: tujuan = SUPABASE_DB_URL → ditolak.
expect_exit 3 env SUPABASE_DB_URL="$(url sumber)" RESTORE_DB_URL="$(url sumber)" "$ROOT/scripts/restore-db.sh" "$FILE" --ya
expect_exit 3 env PRODUCTION_PROJECT_REF="sumber" RESTORE_DB_URL="$(url sumber)" "$ROOT/scripts/restore-db.sh" "$FILE" --ya
# --produksi tanpa terminal interaktif tetap ditolak.
expect_exit 3 env PRODUCTION_PROJECT_REF="sumber" RESTORE_DB_URL="$(url sumber)" "$ROOT/scripts/restore-db.sh" "$FILE" --produksi </dev/null
echo "✓ Pengaman produksi menolak pemulihan ke database sumber."
# Frasa sandi salah & file rusak.
expect_exit 4 env BACKUP_PASSPHRASE="salah" RESTORE_DB_URL="$(url tujuan)" "$ROOT/scripts/restore-db.sh" "$FILE" --ya
cp "$FILE" "$WORK/rusak.tar.gz.enc"; cp "$FILE.sha256" "$WORK/rusak.tar.gz.enc.sha256"
sed -i "s#$(basename "$FILE")#rusak.tar.gz.enc#" "$WORK/rusak.tar.gz.enc.sha256"
printf 'X' | dd of="$WORK/rusak.tar.gz.enc" bs=1 seek=100 conv=notrunc 2>/dev/null
expect_exit 4 env RESTORE_DB_URL="$(url tujuan)" "$ROOT/scripts/restore-db.sh" "$WORK/rusak.tar.gz.enc" --ya
echo "✓ Frasa sandi salah dan file rusak ditolak."
# Backup tanpa enkripsi ditolak kecuali diizinkan eksplisit.
expect_exit 2 env -u BACKUP_PASSPHRASE SUPABASE_DB_URL="$(url sumber)" "$ROOT/scripts/backup-db.sh" "$WORK/polos"
echo "✓ Backup tanpa enkripsi ditolak."

RESTORE_DB_URL="$(url tujuan)" "$ROOT/scripts/restore-db.sh" "$FILE" --ya | tail -1

# Bandingkan isi SETIAP tabel (bukan hanya jumlah baris).
TABLES="$(q sumber -At -c "select format('%I.%I', schemaname, tablename) from pg_tables where schemaname = 'public' union all select 'auth.users' union all select 'storage.objects' order by 1")"
diff=0
for t in $TABLES; do
  a="$(q sumber -At -c "select md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from $t x")"
  b="$(q tujuan -At -c "select md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from $t x")"
  [ "$a" = "$b" ] || { echo "✗ isi berbeda: $t"; diff=1; }
done
[ "$diff" = "0" ] || exit 1
echo "✓ Isi $(echo "$TABLES" | wc -w) tabel identik antara sumber dan hasil pemulihan."
# Sekuens ikut pulih: baris baru tidak bentrok dengan ID lama.
q tujuan -c "insert into public.admin_audit_log (action) values ('uji.setelah_pulih')" >/dev/null
q tujuan -At -c "select count(*) from public.news where title like '%✓%' or title like '%revisi%'" | grep -q '^1$'
echo "✓ Sekuens & teks Unicode pulih dengan benar."
echo "Uji backup & pemulihan lulus."
