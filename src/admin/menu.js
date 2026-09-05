import { editMessage, sendMessage } from "../telegram.js";
import { supabase } from "../supabase.js";

export async function isAdmin(env, telegramId) {
  const admins = await supabase(
    env,
    `admins?telegram_id=eq.${telegramId}&is_active=eq.true&limit=1`
  );

  return admins.length > 0;
}

const ADMIN_MENU_TEXT =
`👑 LEOBOT ADMIN

Kelola toko:`;

/*
 * BUG YANG DIPERBAIKI: sebelumnya index.js punya salinan menu
 * admin sendiri (dipakai untuk perintah /admin) yang isinya beda
 * dari menu ini (dipakai tombol "◀️ KEMBALI" / admin:menu) — yang
 * satu punya tombol "PESAN BOT" tapi tidak ada "PENGATURAN", yang
 * satunya sebaliknya. Akibatnya admin bisa kehilangan akses ke
 * menu edit pesan bot begitu berpindah halaman. Sekarang ada satu
 * sumber kebenaran (buildAdminMenuKeyboard) yang dipakai di kedua
 * jalur masuk.
 */
function buildAdminMenuKeyboard() {
  return [
    [
      {
        text: "📦 PRODUK",
        callback_data: "admin:products"
      }
    ],
    [
      {
        text: "💳 PEMBAYARAN",
        callback_data: "admin:payment"
      }
    ],
    [
      {
        text: "📢 CHANNEL VIP",
        callback_data: "admin:channel"
      }
    ],
    [
      {
        text: "📊 STATISTIK",
        callback_data: "admin:stats"
      }
    ],
    [
      {
        text: "✏️ PESAN BOT",
        callback_data: "admin:messages"
      }
    ],
    [
      {
        text: "⚙️ PENGATURAN",
        callback_data: "admin:settings"
      }
    ]
  ];
}

export async function showAdminMenu(
  env,
  chatId,
  messageId
) {
  return editMessage(
    env,
    chatId,
    messageId,
    ADMIN_MENU_TEXT,
    buildAdminMenuKeyboard()
  );
}

/**
 * Dipakai oleh perintah /admin (mengirim pesan baru, bukan edit),
 * dengan keyboard yang identik dengan showAdminMenu di atas.
 */
export async function sendAdminMenu(
  env,
  chatId
) {
  return sendMessage(
    env,
    chatId,
    ADMIN_MENU_TEXT,
    buildAdminMenuKeyboard()
  );
}
