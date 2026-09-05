import {
  supabase,
  upsertSetting,
} from "./supabase.js";

/**
 * Modul terpusat untuk pengaturan tampilan toko yang bisa diubah
 * admin langsung dari bot (menu ⚙️ PENGATURAN), tanpa perlu ubah
 * kode. Semua tersimpan di tabel `settings` dengan prefix
 * "setting_" supaya tidak bentrok dengan key lain (admin_state_*,
 * payment_*, message_*).
 */

const PREFIX = "setting_";

const DEFAULTS = {
  welcome_photo: "",
  cs_contact: "",
  price_currency: "Rp",
  price_separator: ".",
  btn_pay_label: "💳 BAYAR",
  btn_back_label: "◀️ KEMBALI",
  invite_link_hours: "5",
};

export async function getShopSettings(env) {
  const rows =
    (await supabase(
      env,
      `settings?key=like.${PREFIX}*`
    )) || [];

  const map = {};

  for (const row of rows) {
    if (!row.key?.startsWith(PREFIX)) {
      continue;
    }

    const key = row.key.slice(PREFIX.length);

    if (row.value !== null && row.value !== "") {
      map[key] = row.value;
    }
  }

  return { ...DEFAULTS, ...map };
}

export async function setShopSetting(
  env,
  key,
  value
) {
  return upsertSetting(
    env,
    `${PREFIX}${key}`,
    value ?? ""
  );
}

export async function resetShopSetting(
  env,
  key
) {
  return supabase(
    env,
    `settings?key=eq.${encodeURIComponent(`${PREFIX}${key}`)}`,
    "DELETE"
  );
}

export function isDefaultValue(key, value) {
  return (value ?? "") === (DEFAULTS[key] ?? "");
}

export function getDefault(key) {
  return DEFAULTS[key] ?? "";
}

/**
 * Format harga sesuai pengaturan pemisah ribuan & prefix mata uang
 * yang diatur admin. Dipakai di semua tampilan harga customer-facing
 * (detail produk, pesan menunggu pembayaran, dll) supaya konsisten.
 */
export function formatPrice(amount, settings) {
  const separator =
    settings?.price_separator || DEFAULTS.price_separator;

  const currency =
    settings?.price_currency ?? DEFAULTS.price_currency;

  const rounded = Math.round(Number(amount) || 0);

  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  return `${currency}${rounded < 0 ? "-" : ""}${digits}`;
}

/**
 * Sama seperti formatPrice tapi tanpa prefix mata uang — dipakai
 * di template pesan yang sudah menuliskan "Rp" secara literal di
 * teksnya (mis. "💰 Rp{price}"), supaya cuma pemisah ribuannya
 * saja yang mengikuti pengaturan admin.
 */
export function formatPriceDigits(amount, settings) {
  const separator =
    settings?.price_separator || DEFAULTS.price_separator;

  const rounded = Math.round(Number(amount) || 0);

  return Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}
