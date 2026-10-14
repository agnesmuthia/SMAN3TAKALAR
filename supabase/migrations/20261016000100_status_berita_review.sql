-- Status baru "review" (menunggu persetujuan) untuk alur CMS berita.
-- Dipisah dari migrasi lain karena nilai enum baru tidak boleh dipakai dalam
-- transaksi yang sama dengan pembuatannya.
alter type public.news_status add value if not exists 'review' before 'published';
