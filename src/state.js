import {
  supabase,
  upsertSetting,
} from "./supabase.js";

/**
 * Modul terpusat untuk menyimpan/membaca/menghapus "state" admin
 * (langkah wizard tambah produk, mode edit field, dll).
 *
 * Sebelumnya setiap file admin (channel.js, messages.js, digital.js,
 * products.js, payment.js) punya salinan sendiri-sendiri dari
 * saveState/getState/deleteState. Selain duplikasi kode, itu juga
 * jadi sumber bug upsert (lihat supabase.js). Sekarang semua file
 * memakai modul ini.
 */

export async function getState(
  env,
  telegramId
) {
  const rows = await supabase(
    env,
    `settings?key=eq.admin_state_${telegramId}&limit=1`
  );

  if (!rows?.length) {
    return null;
  }

  try {
    return JSON.parse(rows[0].value);
  } catch {
    return null;
  }
}

export async function saveState(
  env,
  telegramId,
  state
) {
  return upsertSetting(
    env,
    `admin_state_${telegramId}`,
    JSON.stringify(state)
  );
}

export const updateState = saveState;

export async function deleteState(
  env,
  telegramId
) {
  return supabase(
    env,
    `settings?key=eq.admin_state_${telegramId}`,
    "DELETE"
  );
}
