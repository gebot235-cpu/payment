-- ============================================================
-- LEOBOT — SKEMA DATABASE LENGKAP
-- ============================================================
-- File ini berisi SELURUH tabel yang dibutuhkan proyek ini,
-- dikumpulkan dari membaca semua kode sumber (bukan tebakan).
-- Aman dijalankan dari kosong (database baru) MAUPUN di atas
-- database yang sudah ada — semua pakai IF NOT EXISTS / kondisi
-- aman, jadi tidak akan menghapus data yang sudah ada.
--
-- Jalankan seluruh file ini sekali di Supabase SQL Editor.
-- Ini MENGGANTIKAN migrations/0001, 0002, 0003 — kalau kamu sudah
-- pernah menjalankan migrasi-migrasi itu sebelumnya, file ini
-- tetap aman dijalankan ulang (idempotent).
-- ============================================================


-- ------------------------------------------------------------
-- 1) admins — siapa saja yang boleh akses /admin di bot
-- ------------------------------------------------------------
-- Tidak ada alur di dalam bot untuk mendaftarkan admin pertama —
-- kamu HARUS insert manual minimal 1 baris di sini sebelum /admin
-- bisa dipakai sama sekali. Contoh di paling bawah file ini.
create table if not exists admins (
  id bigserial primary key,
  telegram_id bigint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_admins_telegram_id
  on admins (telegram_id);


-- ------------------------------------------------------------
-- 2) products — produk VIP (akses channel) & DIGITAL (file/link)
-- ------------------------------------------------------------
create table if not exists products (
  id bigserial primary key,
  name text not null,
  description text,
  price numeric not null check (price > 0),
  type text not null check (type in ('VIP', 'DIGITAL')),

  -- Khusus VIP. NULL = "Selamanya / Tanpa Batas".
  -- Khusus DIGITAL: selalu NULL, tidak dipakai.
  duration_days integer,

  -- Khusus DIGITAL. Untuk media Telegram: file_id asli Telegram.
  -- Untuk konten link/teks: isi link/teks itu sendiri, dengan
  -- file_type = 'link'.
  -- Khusus VIP: selalu NULL, tidak dipakai.
  file_id text,
  file_type text check (
    file_type is null or file_type in (
      'document', 'photo', 'video', 'audio', 'voice',
      'animation', 'video_note', 'sticker', 'link'
    )
  ),

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_active
  on products (is_active);

create index if not exists idx_products_type
  on products (type);


-- ------------------------------------------------------------
-- 3) vip_channels — channel/grup Telegram yang bisa dijual aksesnya
-- ------------------------------------------------------------
create table if not exists vip_channels (
  id bigserial primary key,

  -- ID chat Telegram asli (angka negatif untuk channel/grup).
  channel_id bigint not null,

  name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_vip_channels_channel_id
  on vip_channels (channel_id);


-- ------------------------------------------------------------
-- 4) product_channels — produk VIP mana terhubung ke channel mana
-- ------------------------------------------------------------
-- PENTING: channel_id di sini merujuk ke vip_channels.id (primary
-- key tabel di atas), BUKAN ID chat Telegram secara langsung.
create table if not exists product_channels (
  id bigserial primary key,
  product_id bigint not null references products (id) on delete cascade,
  channel_id bigint not null references vip_channels (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_product_channels_unique
  on product_channels (product_id, channel_id);

create index if not exists idx_product_channels_product
  on product_channels (product_id);

create index if not exists idx_product_channels_channel
  on product_channels (channel_id);


-- ------------------------------------------------------------
-- 5) orders — setiap transaksi/pesanan
-- ------------------------------------------------------------
create table if not exists orders (
  id bigserial primary key,
  order_code text not null,

  -- ID Telegram pembeli (bukan foreign key — customer tidak
  -- punya tabel sendiri).
  telegram_id bigint not null,

  product_id bigint references products (id),
  amount numeric not null check (amount > 0),
  first_name text,

  status text not null default 'PENDING' check (status in (
    'PENDING',          -- menunggu pembayaran
    'PAID',             -- terbayar, sedang/segera dikirim
    'DELIVERED',        -- produk berhasil terkirim
    'DELIVERY_FAILED',  -- terbayar tapi gagal terkirim (perlu admin)
    'EXPIRED',          -- QR kadaluwarsa tanpa dibayar
    'FAILED',           -- gagal buat QRIS / gagal dari gateway
    'PAYMENT_MISMATCH'  -- nominal yang diterima tidak sesuai
  )),

  -- ID transaksi dari BuatQris.
  payment_id text,

  qr_url text,
  qr_expires_at timestamptz,
  paid_at timestamptz,

  -- ID pesan Telegram yang berisi QRIS, supaya bisa dihapus
  -- otomatis setelah bayar sukses / saat expired.
  payment_message_id bigint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_orders_order_code
  on orders (order_code);

create index if not exists idx_orders_payment_id
  on orders (payment_id);

create index if not exists idx_orders_status
  on orders (status);

create index if not exists idx_orders_telegram_id
  on orders (telegram_id);

create index if not exists idx_orders_qr_expires
  on orders (qr_expires_at)
  where status = 'PENDING';


-- ------------------------------------------------------------
-- 6) vip_memberships — status akses VIP tiap customer per channel
-- ------------------------------------------------------------
-- Baris dibuat SAAT invite link dikirim (joined_at & expires_at
-- masih NULL). joined_at terisi begitu customer benar-benar join
-- channel (lewat update `chat_member` dari Telegram). expires_at
-- terisi mengikuti duration_days produk saat itu — TETAP NULL
-- selamanya untuk produk VIP "Selamanya/Tanpa Batas".
create table if not exists vip_memberships (
  id bigserial primary key,

  telegram_id bigint not null,

  -- ID chat Telegram asli channel (BUKAN vip_channels.id — beda
  -- dengan product_channels.channel_id di atas).
  channel_id bigint not null,

  product_id bigint references products (id),
  order_id bigint references orders (id),

  invite_link text,

  joined_at timestamptz,
  expires_at timestamptz,
  reminded_at timestamptz,
  kicked_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists idx_vip_memberships_telegram
  on vip_memberships (telegram_id);

create index if not exists idx_vip_memberships_channel
  on vip_memberships (channel_id);

create index if not exists idx_vip_memberships_order
  on vip_memberships (order_id);

-- Dipakai cron untuk cari member yang perlu di-kick / diingatkan.
create index if not exists idx_vip_memberships_expiry
  on vip_memberships (expires_at)
  where kicked_at is null;

-- Dipakai handleChatMemberUpdate untuk cari membership yang
-- menunggu diaktifkan (belum join).
create index if not exists idx_vip_memberships_pending_join
  on vip_memberships (telegram_id, channel_id)
  where joined_at is null;


-- ------------------------------------------------------------
-- 7) settings — key-value generik (pengaturan, template pesan,
--    kredensial pembayaran terenkripsi, state wizard admin, dst)
-- ------------------------------------------------------------
-- Dipakai untuk BANYAK hal berbeda lewat prefix key:
--   payment_*   → pengaturan gateway pembayaran
--   message_*   → template pesan bot yang bisa diedit admin
--   setting_*   → pengaturan tampilan toko (banner, CS, dst)
--   admin_state_<telegram_id> → state wizard admin yang sedang
--                                berjalan (sementara)
create table if not exists settings (
  id bigserial primary key,
  key text not null,
  value text,
  updated_at timestamptz not null default now()
);

-- WAJIB unique — ini yang membuat upsert (PATCH-lalu-POST di
-- kode) bekerja benar dan mencegah baris "key" dobel yang bisa
-- bikin pengaturan kebaca acak.
create unique index if not exists idx_settings_key
  on settings (key);


-- ============================================================
-- CATATAN KEAMANAN: Row Level Security (RLS)
-- ============================================================
-- Bot mengakses Supabase pakai SERVICE ROLE KEY (bukan anon key),
-- yang otomatis melewati RLS — jadi bot akan tetap berfungsi
-- normal walau RLS diaktifkan atau tidak.
--
-- TAPI: kalau RLS tidak diaktifkan, dan proyek Supabase-mu juga
-- punya anon/public API key yang beredar (mis. dipakai project
-- lain, atau pernah ter-commit ke repo publik), siapa pun yang
-- pegang anon key itu bisa baca/tulis SEMUA tabel di atas —
-- termasuk kredensial pembayaran (walau sudah terenkripsi di
-- level aplikasi, tetap sebaiknya tidak mudah diakses), data
-- pembeli, dan status membership VIP.
--
-- Rekomendasi aman: aktifkan RLS di semua tabel dan JANGAN buat
-- policy apa pun (artinya: hanya service_role yang bisa akses,
-- yang mana itu persis yang dipakai bot). Jalankan ini:

alter table admins enable row level security;
alter table products enable row level security;
alter table vip_channels enable row level security;
alter table product_channels enable row level security;
alter table orders enable row level security;
alter table vip_memberships enable row level security;
alter table settings enable row level security;

-- Tidak ada CREATE POLICY di bawah ini dengan sengaja — tanpa
-- policy, RLS otomatis menolak SEMUA akses dari anon/authenticated
-- key, dan HANYA service_role (dipakai bot) yang tetap bisa akses
-- penuh. Ini paling aman untuk proyek yang seluruh aksesnya lewat
-- backend (Cloudflare Worker), bukan langsung dari client/browser.


-- ============================================================
-- LANGKAH SETELAH MENJALANKAN FILE INI
-- ============================================================
-- 1. Insert admin pertama (WAJIB, ganti angka di bawah dengan
--    Telegram user ID kamu sendiri — bisa dicek lewat bot seperti
--    @userinfobot):
--
-- insert into admins (telegram_id, is_active) values (123456789, true);
--
-- 2. (Opsional) Kalau kamu upgrade dari versi lama yang masih
--    pakai migrations/0001-0003 terpisah, tidak perlu jalankan
--    apa-apa lagi — file ini sudah mencakup semuanya dan aman
--    dijalankan ulang di atas skema yang sudah ada.
