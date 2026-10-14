-- Audiens "publik" untuk pengumuman yang boleh dibaca pengunjung tanpa login.
-- Dipisah karena nilai enum baru tidak boleh dipakai dalam transaksi yang sama.
alter type public.announcement_audience add value if not exists 'publik' before 'semua';
