# Ringkasan Perbaikan LeoBot

## ⚠️ WAJIB: jalankan migrasi database dulu

Sebelum deploy, jalankan `migrations/0001_fulfillment_and_cron.sql`
di Supabase SQL Editor. Tanpa ini, pengiriman produk otomatis dan
cron VIP akan error karena kolom/tabel yang dipakai belum ada.

## 1. Pengiriman produk otomatis setelah bayar (fitur yang hilang total)

**Sebelumnya:** `processPaymentSuccess()` di `payment.js` cuma
mengubah status order jadi `PAID`, lalu berhenti. Tidak ada file
digital yang dikirim, tidak ada invite link VIP yang dibuat.
Customer bayar tapi tidak menerima apa pun kecuali admin kirim
manual.

**Sekarang:** file baru `src/fulfillment.js` menangani pengiriman:
- **Produk Digital** → file dikirim ulang ke customer memakai method
  Telegram yang sesuai jenis medianya (foto tetap `sendPhoto`, video
  tetap `sendVideo`, dst — bukan cuma `file_id` mentah lewat satu
  method). Makanya ada kolom baru `products.file_type` yang direkam
  otomatis setiap kali admin upload/ganti file produk digital.
- **Produk VIP** → dibuatkan invite link sekali-pakai
  (`member_limit: 1`) untuk tiap channel yang terhubung ke produk
  itu, dikirim ke customer, dan dicatat di tabel baru
  `vip_memberships` (dipakai cron untuk reminder & auto-kick).
- Template pesan yang admin edit di menu "✏️ PESAN BOT"
  (Pembayaran Berhasil, Produk Digital Terkirim, VIP Aktif) sekarang
  benar-benar terpakai, bukan cuma tersimpan di database tanpa
  fungsi.
- Kalau pengiriman gagal (mis. bot bukan admin channel lagi), order
  ditandai `DELIVERY_FAILED` supaya kelihatan di data, bukan diam-diam
  hilang.

## 2. Cron job (sebelumnya tidak ada sama sekali)

File baru `src/cron.js` + `scheduled` export baru di `index.js` +
`[triggers] crons = ["*/10 * * * *"]` di `wrangler.toml`:
- Order `PENDING` yang QR-nya sudah kedaluwarsa tapi tidak pernah
  dibayar → otomatis jadi `EXPIRED` (sebelumnya nyangkut selamanya).
- Member VIP yang masa aktifnya akan habis dalam 24 jam → dikirim
  reminder sekali.
- Member VIP yang masa aktifnya sudah habis → otomatis di-kick
  (ban+unban) dari channel dan diberi tahu lewat DM.

## 3. Bug upsert Supabase (race condition state admin)

**Sebelumnya:** semua fungsi `saveState`/`setSetting` di 5 file
berbeda memakai `POST` + `Prefer: resolution=merge-duplicates`
**tanpa** `?on_conflict=key`. Kalau kolom `key` di tabel `settings`
bukan primary key, ini bisa gagal (409) atau bikin baris dobel —
dan karena pembacaan state pakai `limit=1` tanpa `order by`, hasil
bisa jadi baris yang salah/lama.

**Sekarang:** `upsertSetting()` baru di `supabase.js` mencoba
`PATCH` (update) dulu berdasarkan `key`; kalau tidak ada baris yang
cocok, baru `POST` (insert). Ini aman untuk skema apa pun, dengan
atau tanpa unique constraint di kolom `key`.

Sekaligus dirapikan: `saveState`/`getState`/`deleteState` yang
tadinya diduplikasi terpisah di `channel.js`, `messages.js`,
`digital.js`, `products.js`, dan `payment.js` sekarang satu sumber
di `src/state.js`.

## 4. Menu admin yang tidak konsisten

**Sebelumnya:** perintah `/admin` menampilkan menu dengan tombol
"PESAN BOT" tapi tanpa "PENGATURAN". Tombol "◀️ KEMBALI" dari dalam
panel (`admin:menu`) menampilkan menu sebaliknya — ada "PENGATURAN",
tidak ada "PESAN BOT". Begitu admin masuk lewat `/admin` lalu pindah
menu dan tekan kembali, fitur edit pesan bot jadi tidak bisa diakses
lagi tanpa ketik `/admin` ulang.

**Sekarang:** satu keyboard menu (`buildAdminMenuKeyboard` di
`admin/menu.js`) dipakai di kedua jalur masuk — berisi PRODUK,
PEMBAYARAN, CHANNEL VIP, PESAN BOT, dan PENGATURAN.

## 5. Kondisi balapan (race condition) di pemrosesan webhook

**Sebelumnya:** `processPaymentSuccess` fetch order dulu, cek
statusnya di JavaScript, baru update — ada celah waktu antara cek
dan update yang secara teori bisa membuat webhook duplikat (retry
dari payment gateway) memproses pembayaran & mengirim produk dua
kali.

**Sekarang:** update memakai kondisi `status=eq.PENDING` langsung di
query PATCH (atomik di level database). Webhook kedua yang datang
untuk order yang sama tidak akan menemukan baris PENDING lagi,
otomatis berhenti tanpa efek samping.

## 6. Menu "⚙️ PENGATURAN" sekarang berfungsi (sebelumnya placeholder kosong)

Semua ini bisa diatur langsung dari bot, tanpa ubah kode, dan
langsung berlaku di tampilan customer:

- **🖼️ Foto Banner Welcome** — kirim foto ke bot, otomatis
  terpasang sebagai banner yang muncul bersama pesan `/start`.
  (Catatan: Telegram tidak bisa mengubah pesan teks jadi pesan
  foto, jadi banner cuma tampil saat mengirim pesan baru — bukan
  saat customer tekan tombol "◀️ KEMBALI" ke menu yang sudah ada.)
- **📞 Kontak CS** — begitu diisi, tombol "📞 HUBUNGI CS" otomatis
  muncul di menu utama.
- **💰 Format Harga** — pilih pemisah ribuan (titik/koma) dan ubah
  prefix mata uang. Langsung berlaku di semua tampilan harga yang
  dilihat customer.
- **🔘 Label Tombol** — ubah teks tombol "BAYAR" dan "KEMBALI"
  sesuka hati (termasuk emoji-nya).

Nama toko & isi pesan sambutan sendiri sebenarnya sudah bisa
diedit sebelumnya lewat menu "✏️ PESAN BOT" → "👋 WELCOME" — jadi
tidak dibuat pengaturan terpisah supaya tidak ada dua tempat yang
mengatur hal yang sama.

Bonus fix: pesan **"🧾 DETAIL PRODUK"** di menu PESAN BOT ternyata
sebelumnya tidak pernah benar-benar dipakai — `showProduct` menulis
teksnya sendiri secara hardcoded. Sekarang benar-benar memakai
template itu, jadi mengedit pesan itu di bot sungguhan mengubah apa
yang dilihat customer.

Tidak butuh migrasi database tambahan untuk fitur ini — semua
numpang di tabel `settings` yang sudah ada.

## 7. Kredensial pembayaran tersimpan plaintext + tidak bisa dihapus

**Sebelumnya:** `secret_token` (dipakai untuk memanggil API BuatQris)
dan `webhook_secret` (dipakai untuk **validasi tanda tangan
webhook**) tersimpan polos di tabel `settings`. Ini serius: kalau
`webhook_secret` bocor (mis. lewat akses Supabase yang tidak
seharusnya, backup yang ke-expose, dsb), orang bisa memalsukan
webhook `payment.success` dan **dapat produk/VIP tanpa bayar**.
Selain itu, tidak ada tombol untuk menghapus kredensial — cuma bisa
ditimpa dengan nilai baru.

**Sekarang:**
- File baru `src/crypto.js` — enkripsi AES-256-GCM pakai Web Crypto
  API bawaan Cloudflare Workers (tidak perlu library tambahan).
  `secret_token` dan `webhook_secret` dienkripsi sebelum disimpan,
  didekripsi saat dipakai. **Butuh secret baru:**
  `wrangler secret put ENCRYPTION_KEY` (isi bebas, string acak
  panjang — bisa pakai `openssl rand -base64 32`).
- `account_id` sengaja TIDAK dienkripsi — ini cuma identifier akun
  (mirip username), bukan kredensial rahasia yang bisa dipakai
  langsung untuk transaksi/validasi. Kalau kamu mau ikut dienkripsi
  juga, tinggal bilang, gampang ditambahkan.
- Tombol **"🗑️ HAPUS NILAI INI"** sekarang muncul di layar edit
  Account ID / Secret Token / Webhook Secret (kalau nilainya sudah
  diisi), dengan layar konfirmasi yang menjelaskan konsekuensinya
  sebelum benar-benar dihapus.
- Kalau `ENCRYPTION_KEY` belum diset atau salah, bot tidak crash —
  kredensial akan terbaca sebagai "belum diatur" (fail-safe, bukan
  fail-open) dan errornya tercatat di log Cloudflare Worker.

## Belum dikerjakan (di luar scope kali ini, FYI)

- Menu "⚙️ PENGATURAN" di admin panel masih placeholder ("belum
  tersedia") — ini bukan bug baru, memang belum pernah dibangun.
- Tidak ada retry otomatis untuk order berstatus `DELIVERY_FAILED`
  (perlu dikirim ulang manual oleh admin untuk saat ini).

---

# Sesi Perbaikan Lanjutan (setelah kamu edit sendiri alurnya)

⚠️ **Jalankan `migrations/0002_join_based_vip_and_cleanup.sql` juga**
sebelum deploy versi ini — ada kolom baru yang dipakai kode
(`orders.payment_message_id`, `vip_memberships.joined_at`,
`vip_memberships.invite_link`).

## 8. Bug kritis: cron tidak pernah benar-benar jalan

**Penyebab:** di `cron.js`, beberapa query memakai string biasa
(`"..."`) padahal isinya ada `${...}` yang seharusnya diproses
(interpolasi) — cuma bisa jalan dengan template literal (backtick
`` ` ``). Akibatnya teks `${encodeURIComponent(nowIso)}` terkirim
**mentah sebagai teks**, bukan tanggal sungguhan. Supabase menolak
query itu, errornya ketangkep `try/catch` dan cuma masuk log tanpa
kelihatan dari luar.

**Dampaknya, sejak perubahan itu masuk:**
- Order yang tidak dibayar **tidak pernah** otomatis jadi EXPIRED
- Reminder VIP H-24 jam **tidak pernah** terkirim
- Member VIP yang masa aktifnya habis **tidak pernah** di-kick
  otomatis dari channel

Cron tetap "sukses" jalan tiap 10 menit (tidak ada crash yang
terlihat), jadi bug ini bisa gampang tidak disadari. Sekarang sudah
dibenahi total — `cron.js` ditulis ulang dengan template literal
yang benar di semua query.

## 9. Pesan QRIS dihapus otomatis

- **Setelah pembayaran berhasil** (baik produk digital terkirim
  atau link invite VIP terkirim) — pesan QRIS langsung dihapus,
  tidak perlu nunggu apa pun.
- **Saat order expired** (QR kadaluwarsa tanpa dibayar) — sudah ada
  dari editanmu sendiri, saya pastikan tetap jalan sekarang setelah
  bug cron dibenahi.
- **Kalau sebagian channel VIP gagal diproses** — pesan QRIS tetap
  dihapus juga (customer sudah dapat link yang berhasil), bukan
  cuma di jalur sukses penuh.

## 10. Link invite VIP auto-revoke 5 jam

Ini sudah ada dari editanmu (kolom `expire_date` di
`createSingleUseInviteLink`) — saya cuma verifikasi ini benar dan
memang cara yang tepat: Telegram sendiri yang otomatis menonaktifkan
link setelah `expire_date` lewat, tidak perlu kerja tambahan di
cron. Tidak ada perubahan di bagian ini.

## 11. Regresi: kegagalan 1 channel VIP dulu menggagalkan semuanya

Saat proses edit alur sebelumnya, penanganan per-channel yang tadinya
saya buat (supaya kalau 1 dari beberapa channel VIP gagal, channel
lain yang berhasil tetap terkirim ke customer) sempat hilang.
Sudah saya kembalikan: sekarang tiap channel diproses dengan
try/catch sendiri-sendiri, customer tetap dapat link yang berhasil,
dan cuma gagal total kalau **semua** channel gagal.

## 12. Fitur baru: 📊 STATISTIK

Menu admin baru menampilkan (dihitung langsung dari data
`orders`/`vip_memberships`, jadi selalu terkini):
- Pendapatan hari ini / minggu ini / bulan ini / total (+ jumlah
  order masing-masing)
- Breakdown status order (pending, terkirim, gagal kirim, expired,
  nominal salah)
- Jumlah member VIP aktif (sudah join) vs menunggu join
- Top 3 produk terlaris

Catatan: untuk toko dengan volume order sangat besar (ribuan+),
perhitungan ini bisa mulai terasa lambat karena dihitung di
JavaScript (REST Supabase tidak mendukung SUM/GROUP BY langsung
untuk kasus ini). Untuk skala LeoBot saat ini seharusnya masih
cepat.

## Masih perlu kamu verifikasi sendiri

- **Kick VIP**: sekarang query-nya sudah benar, tapi saya belum
  bisa menjalankan Cloudflare Worker sungguhan dari sini. Setelah
  deploy, cara paling gampang untuk tes: ubah manual `expires_at`
  salah satu baris di `vip_memberships` jadi waktu lampau lewat
  Supabase, tunggu maksimal 10 menit (siklus cron), cek apakah
  member itu ke-kick dari channel dan dapat pesan `message_vip_expired`.

---

# Sesi Perbaikan: Fee, Produk Link, Durasi Selamanya

⚠️ **Jalankan `migrations/0003_fee_link_lifetime.sql` juga** sebelum
deploy versi ini — memastikan `products.duration_days` dan
`vip_memberships.expires_at` boleh NULL (dibutuhkan fitur baru).

## 13. Fee: dari "persen/nominal" jadi "ditanggung siapa"

**Sebelumnya:** admin mengatur fee dengan format bebas
("persen 10" / "nominal 500") yang ditambahkan begitu saja ke
nominal QRIS.

**Sekarang:** menu "📊 ATUR FEE" diubah total —
- Admin atur **persentase fee** gateway (misal 0.7%)
- Admin pilih **siapa yang menanggung**: 🙋 PEMBELI (nominal QRIS
  dinaikkan sebesar fee, toko tetap terima harga produk penuh) atau
  🏪 TOKO (customer bayar persis harga produk, toko yang menanggung
  potongan fee)
- Toggle instan tanpa perlu ketik teks, plus contoh nominal
  langsung ditampilkan di menu

Catatan jujur: kalau nominal masih sering tidak cocok
(`PAYMENT_MISMATCH`) setelah ini, kemungkinan penyebabnya bukan di
sini — banyak provider QRIS/pengecekan mutasi bank menambahkan
"kode unik" acak (1-3 digit) ke nominal supaya transaksi bisa
dibedakan, dan BuatQris mungkin melakukan hal serupa. Kode saat ini
belum membaca nominal final yang mungkin dikembalikan BuatQris saat
create-QRIS (cuma baca `transaction_id`/`qr_url`/`expires_at`). Kalau
mismatch masih terjadi, kirim saya contoh payload webhook asli yang
gagal supaya saya bisa perbaiki dengan tepat (bukan menebak nama
field-nya).

## 14. Produk digital: bisa berupa link, bukan cuma media

Sekarang di wizard tambah produk maupun edit produk yang sudah ada,
admin bisa kirim **link/teks biasa** (URL Google Drive, kode redeem,
lisensi, dll) sebagai pengganti upload media Telegram. Disimpan di
kolom `file_id` yang sama (`file_type = "link"`), jadi tidak perlu
kolom database baru. Saat dikirim ke customer, otomatis dikirim
sebagai pesan teks — bukan dipaksa lewat `sendDocument` yang pasti
gagal untuk string URL.

## 15. Channel VIP: durasi "Selamanya (Tanpa Batas)"

Tombol "♾️ SELAMANYA" sekarang tersedia di:
- Wizard tambah produk VIP baru (langkah durasi)
- Edit durasi untuk produk VIP yang sudah ada

Disimpan sebagai `duration_days = NULL`. Ditampilkan sebagai
"♾️ Selamanya" di semua tempat (daftar admin, detail produk
customer, konfirmasi).

**Bug kritis yang ikut ketemu & dibenahi saat mengerjakan ini:**
`handleChatMemberUpdate` di `index.js` (yang mengaktifkan VIP saat
member join channel) sebelumnya menganggap `duration_days` yang
tidak valid (termasuk `NULL`, yang jadi `0` setelah `Number(null)`)
sebagai ERROR dan **melewatkan aktivasi member sama sekali** —
kalau kamu sempat menambahkan produk VIP lifetime sebelum perbaikan
ini, member yang beli produk itu tidak akan pernah ter-aktivasi
walau sudah join channel. Sekarang lifetime ditangani secara
eksplisit: `joined_at` tetap diisi saat join, `expires_at` sengaja
dibiarkan `NULL` selamanya (cron reminder & auto-kick otomatis
skip member begini karena keduanya sudah difilter berdasar
`expires_at` yang terisi).

---

# Skema Database Lengkap

File baru **`migrations/schema.sql`** berisi SELURUH skema yang
dibutuhkan proyek ini dalam satu file — dikumpulkan dengan membaca
ulang semua kode sumber (bukan dari ingatan/tebakan), supaya nama
tabel dan kolomnya dijamin cocok dengan yang benar-benar dipakai
kode.

**Aman dijalankan kapan saja** — baik di database yang benar-benar
kosong, maupun di atas database yang sudah pernah menjalankan
`migrations/0001`, `0002`, `0003` sebelumnya (semua pakai
`IF NOT EXISTS`, tidak akan menghapus data yang sudah ada).

Isinya:
- 7 tabel: `admins`, `products`, `vip_channels`, `product_channels`,
  `orders`, `vip_memberships`, `settings`
- Constraint yang masuk akal (`check` untuk status/type/harga
  positif, `unique` index di tempat yang seharusnya unik seperti
  `settings.key` dan `orders.order_code`)
- Index untuk query yang sering dipakai cron (expiry, status)
- **Row Level Security diaktifkan di semua tabel, tanpa policy** —
  ini mengunci akses hanya untuk `service_role` key (yang dipakai
  bot). Kalau kamu punya `anon key` Supabase yang beredar di tempat
  lain, tanpa RLS siapa pun yang pegang key itu bisa baca/tulis
  semua tabel di atas termasuk data pembeli dan kredensial
  pembayaran.
- Catatan di bagian akhir: kamu **wajib** insert admin pertama
  secara manual, contoh query-nya sudah disediakan.

Kalau proyekmu masih baru/belum ada data sama sekali, **cukup
jalankan `migrations/schema.sql` saja** — tidak perlu jalankan
0001/0002/0003 lagi satu-satu.

---

# Sesi Perbaikan: Callback URL, Durasi Invite Link, Audit Multi-Channel, Grant Manual

Tidak ada migrasi SQL tambahan untuk sesi ini — semua numpang di
skema yang sudah ada (`settings` untuk pengaturan baru, kolom
`vip_memberships.order_id` yang sudah nullable dari sebelumnya).

## 16. CALLBACK_URL dipindah ke environment variable

**Sebelumnya:** URL webhook (`https://leobot.gebot235.workers.dev/webhook/buatqris`)
hardcode langsung di `src/payment.js` — spesifik ke deployment
Cloudflare Worker tertentu, gampang lupa diubah kalau nama
worker/domain berubah.

**Sekarang:** dibaca dari `env.CALLBACK_URL`, diset di
`wrangler.toml` bagian `[vars]`. **Wajib kamu ganti** nilainya
sesuai nama Worker kamu sendiri sebelum deploy. Ditambahkan juga
validasi: kalau `CALLBACK_URL` belum diisi, `createPayment` langsung
melempar error jelas — sebelumnya ini bisa gagal diam-diam (order
dibuat tapi webhook tidak pernah datang karena BuatQris tidak tahu
mau lapor ke mana).

## 17. Durasi invite link bisa diatur dari bot

Sebelumnya hardcode 5 jam di kode (`telegram.js`). Sekarang ada
pengaturan baru **"🔗 DURASI INVITE LINK"** di menu ⚙️ PENGATURAN,
admin bisa ubah kapan saja (1-720 jam / maksimal 30 hari), langsung
berlaku untuk invite link berikutnya yang dibuat — baik dari
pembelian normal maupun pemberian akses manual (poin 19).

## 18. Audit keamanan: 1 produk VIP terhubung ke banyak channel

**Kesimpulan: aman.** Untuk kasus paling umum (1 produk, banyak
channel, 1 kali beli), tiap channel diproses independen — invite
link, status join, dan hitung mundur masa aktifnya terpisah per
channel, tidak ada race condition atau kebocoran data antar channel.

**Tapi ditemukan 1 celah nyata di kasus yang berdekatan**: kalau
DUA PRODUK VIP BERBEDA sama-sama terhubung ke channel yang SAMA
(mis. "VIP Basic" dan "VIP Premium" sama-sama mencakup channel X),
dan durasi salah satu produk habis lebih dulu — sebelum perbaikan
ini, cron akan **meng-kick user dari channel X**, padahal user itu
masih punya akses valid ke channel yang sama lewat produk lainnya
yang belum habis.

**Sudah dibenahi:** `kickExpiredVipMembers` di `cron.js` sekarang
cek dulu (`hasOtherValidMembership`) apakah user masih punya
membership lain yang valid untuk channel yang sama (belum di-kick,
dan baik masih menunggu join, sudah aktif dengan expires_at di masa
depan, ATAU lifetime) sebelum benar-benar mengeksekusi kick. Kalau
ada, baris yang expired itu cuma ditutup (`kicked_at` diisi) tanpa
benar-benar mengeluarkan user dari channel.

Catatan kecil (bukan bug, cuma FYI): kalau user membeli produk VIP
YANG SAMA dua kali sebelum sempat join, kedua pembelian akan aktif
bersamaan di momen yang sama saat user join (bukan terakumulasi
jadi 2x durasi) — ini kasus yang sangat jarang terjadi dan lebih ke
soal keadilan bisnis ketimbang celah keamanan, saya sebutkan saja
biar kamu tahu.

## 19. Admin bisa berikan akses VIP manual ke user

Tombol baru **"🎁 BERIKAN AKSES KE USER"** di layar edit produk VIP
mana pun. Alurnya:
1. Admin buka produk VIP → tekan tombol ini
2. Kirim Telegram User ID target (angka saja)
3. Bot otomatis buat invite link untuk SEMUA channel yang
   terhubung ke produk itu, dengan durasi mengikuti produk
   (termasuk "Selamanya" kalau produknya lifetime)
4. Link + pesan dikirim langsung ke user target; admin dapat
   laporan hasil di chat admin

Dibangun dengan me-refactor logika inti `deliverVipProduct`
(dipakai alur pembayaran) jadi fungsi bersama `createVipInviteLinks`
yang sekarang dipakai KEDUA alur — jadi tidak ada logika yang
diduplikasi, dan perbaikan keamanan di poin 18 otomatis berlaku
juga untuk akses yang diberikan manual (memakai mekanisme
vip_memberships & cron yang sama persis).

**Batasan yang perlu kamu tahu** (bukan bug, batasan Telegram):
kalau user target belum PERNAH mengirim `/start` ke bot ini
sebelumnya, Telegram menolak bot mengirim DM ke mereka duluan. Bot
akan mendeteksi ini dan menampilkan link-nya ke admin supaya bisa
diteruskan manual, bukan gagal diam-diam.
