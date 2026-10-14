#!/usr/bin/env bash
# Menguji migrasi Supabase + RLS pada klaster PostgreSQL sementara.
# Membutuhkan binari PostgreSQL (initdb, pg_ctl, psql). Tidak menyentuh
# database Supabase sungguhan.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
WORK="$(mktemp -d)"
PORT="${PG_TEST_PORT:-54329}"

RUN=()
if [ "$(id -u)" = "0" ]; then
  # PostgreSQL menolak berjalan sebagai root.
  chown -R postgres "$WORK"
  RUN=(runuser -u postgres --)
fi

cleanup() {
  "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("${RUN[@]}" "$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Menerapkan $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
for f in "$ROOT"/supabase/tests/1*.sql; do
  echo "Menjalankan $(basename "$f")"
  "${PSQL[@]}" -t -f "$f" 2>&1 | grep -E 'OK:|GAGAL|ERROR|lulus' | sed 's/^psql:[^ ]* NOTICE:  /  /'
done
# Kueri baca-saja di panduan database harus valid DAN benar-benar baca-saja:
# dijalankan dalam transaksi READ ONLY (penulisan apa pun akan gagal).
echo "Memeriksa kueri di docs/PANDUAN_DATABASE.md (§9 & §10.7)"
DOC_SQL="$WORK/kueri-panduan.sql"
{
  echo "begin transaction read only;"
  awk '/^## 9\./{s=1} /^## 10\./{s=0} /^### 10\.7/{s=1} /^### 10\.8/{s=0} s' "$ROOT/docs/PANDUAN_DATABASE.md" \
    | awk '/^ *```sql/{c=1; next} /^ *```/{c=0} c'
  echo "rollback;"
} > "$DOC_SQL"
chmod a+r "$DOC_SQL"
"${PSQL[@]}" -f "$DOC_SQL" >/dev/null
echo "Kueri panduan valid ($(grep -c '^ *select' "$DOC_SQL") kueri)."
echo "Memeriksa supabase/seed.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null
echo "Seed valid."
