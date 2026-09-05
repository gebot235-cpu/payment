-- Migrasi untuk fitur pengiriman otomatis + cron VIP.
-- Jalankan ini di Supabase SQL Editor SEBELUM deploy kode yang baru.
--
-- Catatan: skema tabel asli tidak ikut ter-upload di repo, jadi
-- statement di bawah pakai IF NOT EXISTS / kolom nullable supaya
-- aman dijalankan berkali-kali dan tidak merusak data yang sudah
-- ada. Sesuaikan tipe data kalau berbeda dari asumsi di sini.

-- 1) Kolom baru di tabel products: jenis media file digital,
--    supaya bot tahu harus kirim pakai sendPhoto / sendVideo /
--    sendDocument / dst — bukan cuma menebak.
alter table products
  add column if not exists file_type text;

-- 2) Kolom baru di tabel orders: nama depan pembeli, dipakai untuk
--    menyapa customer di pesan "Pembayaran Berhasil" / "Produk
--    Terkirim" / "VIP Aktif".
alter table orders
  add column if not exists first_name text;

-- 3) Tabel baru: keanggotaan VIP. Dipakai cron untuk kirim
--    reminder H-24 jam dan auto-kick saat masa aktif habis.
create table if not exists vip_memberships (
  id bigserial primary key,
  telegram_id bigint not null,
  channel_id bigint not null,
  product_id bigint,
  order_id bigint,
  expires_at timestamptz,
  reminded_at timestamptz,
  kicked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_vip_memberships_expiry
  on vip_memberships (expires_at)
  where kicked_at is null;

create index if not exists idx_vip_memberships_telegram
  on vip_memberships (telegram_id);

-- 4) Kolom `key` di tabel settings SEBAIKNYA unique. Cek dulu:
--    select key, count(*) from settings group by key having count(*) > 1;
--    Kalau ada baris dobel, hapus duplikatnya (simpan yang paling
--    baru), lalu jalankan:
-- alter table settings add constraint settings_key_unique unique (key);
--
-- Ini TIDAK wajib untuk kode baru (upsertSetting sekarang sudah
-- aman tanpa bergantung pada constraint ini), tapi tetap
-- direkomendasikan sebagai jaring pengaman tambahan di level DB.

-- 5) Status order yang dipakai kode baru: PENDING, PAID, DELIVERED,
--    DELIVERY_FAILED, EXPIRED, FAILED. Kalau kolom `status` di
--    tabel orders bertipe ENUM (bukan text/varchar), tambahkan
--    value baru dulu, contoh:
-- alter type order_status add value if not exists 'DELIVERED';
-- alter type order_status add value if not exists 'DELIVERY_FAILED';
-- alter type order_status add value if not exists 'EXPIRED';
--    (nama tipe enum menyesuaikan skema asli kamu — kalau `status`
--    bertipe text biasa, baris ini tidak perlu dijalankan sama sekali.)

-- 6) Pengaturan tampilan toko (banner, kontak CS, format harga,
--    label tombol) yang bisa diatur lewat menu ⚙️ PENGATURAN di
--    bot TIDAK butuh tabel/kolom baru — semuanya numpang di tabel
--    `settings` yang sudah ada (key diawali "setting_"), jadi
--    tidak ada migrasi tambahan untuk fitur ini.
