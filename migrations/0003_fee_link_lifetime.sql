-- Migrasi untuk perubahan sesi ini: fee ditanggung pembeli/toko,
-- produk digital berupa link, dan durasi VIP "selamanya".
--
-- Jalankan ini di Supabase SQL Editor SEBELUM deploy.

-- 1) Fee pembayaran: TIDAK butuh kolom/tabel baru. Pengaturan
--    "payment_fee_percent" dan "payment_fee_borne_by" numpang di
--    tabel `settings` yang sudah ada (menggantikan
--    "payment_fee_type"/"payment_fee_value" yang lama — key lama
--    itu boleh dibiarkan saja di database, tidak dipakai lagi dan
--    tidak mengganggu).

-- 2) Produk digital berupa link: TIDAK butuh kolom baru. Link/teks
--    disimpan di kolom `file_id` yang sudah ada (sama seperti
--    file_id media), ditandai `file_type = 'link'`.

-- 3) Durasi VIP "Selamanya": pastikan kolom `duration_days` di
--    tabel `products` BOLEH NULL (kode lama sudah menyimpan NULL
--    untuk produk DIGITAL, jadi seharusnya sudah nullable — tapi
--    jalankan ini untuk memastikan):
alter table products
  alter column duration_days drop not null;

-- 4) PENTING: kolom `expires_at` di tabel `vip_memberships`
--    SEBELUMNYA didokumentasikan sebagai NOT NULL di migrasi
--    0001 — itu salah untuk alur sekarang (expires_at sengaja NULL
--    sebelum member join, dan TETAP NULL selamanya untuk member
--    VIP lifetime). Kalau tabelmu dibuat dari migrasi 0001 yang
--    lama dan masih ada constraint NOT NULL, jalankan ini:
alter table vip_memberships
  alter column expires_at drop not null;

-- Kalau kedua ALTER di atas mengeluarkan error karena kolomnya
-- memang sudah nullable, itu tidak masalah — abaikan saja errornya.
