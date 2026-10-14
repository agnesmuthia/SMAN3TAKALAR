-- Peran staf baru: Petugas Administrasi (tahun ajaran, jadwal & impor, arsip SK,
-- perpustakaan). Dipisah dari migrasi berikutnya karena nilai enum baru tidak
-- boleh dipakai dalam transaksi yang sama dengan penambahannya.
alter type public.staff_role add value if not exists 'administrasi';
