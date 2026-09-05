-- Migrasi tambahan untuk perubahan sesi ini:
-- 1. Masa aktif VIP dihitung sejak member benar-benar JOIN channel
--    (bukan sejak pembayaran), lewat update Telegram `chat_member`.
-- 2. Pesan QRIS dihapus otomatis setelah pembayaran berhasil /
--    invite link terkirim, atau saat order expired.
--
-- Jalankan ini di Supabase SQL Editor SEBELUM deploy.

-- 1) Kolom baru di tabel orders: ID pesan QRIS di Telegram, supaya
--    bisa dihapus otomatis (setelah bayar sukses ATAU saat order
--    expired lewat cron).
alter table orders
  add column if not exists payment_message_id bigint;

-- 2) Kolom baru di tabel vip_memberships: kapan member benar-benar
--    join channel, dan invite link yang dikirim ke customer.
--    expires_at TIDAK diisi lagi saat invite link dibuat — cuma
--    diisi saat member join (lihat handleChatMemberUpdate di
--    index.js). Sebelum join, joined_at & expires_at bernilai NULL.
alter table vip_memberships
  add column if not exists joined_at timestamptz;

alter table vip_memberships
  add column if not exists invite_link text;

-- Kalau baris lama di vip_memberships (dari sebelum perubahan ini)
-- sudah punya expires_at terisi dari versi lama (dihitung sejak
-- pembayaran, bukan sejak join), pertimbangkan mau dibiarkan apa
-- adanya atau di-reset manual — tergantung apakah member itu sudah
-- join atau belum. Cek dulu sebelum ubah data produksi:
-- select id, telegram_id, channel_id, joined_at, expires_at
-- from vip_memberships where kicked_at is null;

-- 3) Status order baru yang dipakai kode: PAYMENT_MISMATCH (nominal
--    yang diterima tidak sama dengan yang seharusnya — indikasi
--    fraud/error, order TIDAK diproses lebih lanjut). Kalau kolom
--    `status` di tabel orders bertipe ENUM, tambahkan value ini juga
--    (menyusul PENDING/PAID/DELIVERED/DELIVERY_FAILED/EXPIRED yang
--    sudah disebut di migrasi sebelumnya):
-- alter type order_status add value if not exists 'PAYMENT_MISMATCH';
