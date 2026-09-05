import {
  editMessage,
  deleteMessage,
} from "../telegram.js";

import {
  supabase,
  upsertSetting,
} from "../supabase.js";

import {
  saveState,
  deleteState,
  getState as getAdminState,
} from "../state.js";


const messageTypes = {
  welcome: {
    name: "👋 WELCOME",
    key: "message_welcome",
    default:
`🦁 Halo {first_name}!

Selamat datang di LeoBot 👋

Silakan pilih produk yang tersedia.`,
  },

  empty_products: {
    name: "📦 PRODUK KOSONG",
    key: "message_empty_products",
    default:
`🦁 LeoBot

Saat ini belum ada produk yang tersedia.`,
  },

  product_detail: {
    name: "🧾 DETAIL PRODUK",
    key: "message_product_detail",
    default:
`📦 {product_name}

{description}

💰 Harga: Rp{price}
{duration}

Silakan lanjutkan pembayaran.`,
  },

  waiting_payment: {
    name: "💳 MENUNGGU BAYAR",
    key: "message_waiting_payment",
    default:
`🧾 ORDER #{order_code}

📦 {product_name}
💰 Rp{price}

Silakan scan QRIS untuk melakukan pembayaran.

⏱️ QRIS berlaku {minutes} menit.`,
  },

  payment_success: {
    name: "✅ PEMBAYARAN BERHASIL",
    key: "message_payment_success",
    default:
`✅ PEMBAYARAN BERHASIL

Terima kasih, {first_name}!

📦 {product_name}
🧾 Order: #{order_code}

🔐 Silakan JOIN channel VIP melalui link/tombol di bawah.`,
  },

  payment_success_digital: {
  name: "✅ PEMBAYARAN DIGITAL BERHASIL",
  key: "message_payment_success_digital",
  default:
`✅ PEMBAYARAN BERHASIL

Terima kasih, {first_name}!

📦 {product_name}
🧾 Order: #{order_code}

📥 Produk digital kamu sudah dikirim di bawah.`,
},
  
  payment_failed: {
    name: "❌ PEMBAYARAN GAGAL",
    key: "message_payment_failed",
    default:
`❌ PEMBAYARAN GAGAL

Pembayaran untuk order #{order_code} tidak berhasil.`,
  },

  vip_active: {
    name: "🔐 VIP AKTIF",
    key: "message_vip_active",
    default:
`🔐 VIP AKTIF

Halo {first_name}!

Akses VIP kamu aktif sampai:
{expires_at}`,
  },

  vip_expired: {
    name: "⏰ VIP BERAKHIR",
    key: "message_vip_expired",
    default:
`⏰ MASA VIP BERAKHIR

Masa aktif VIP kamu telah berakhir.`,
  },

  digital_sent: {
    name: "📦 DIGITAL TERKIRIM",
    key: "message_digital_sent",
    default:
`📦 PRODUK DIGITAL

Halo {first_name}!

Produk kamu sudah dikirim. Terima kasih!`,
  },
};


export async function showMessageMenu(
  env,
  chatId,
  messageId
) {
  return editMessage(
    env,
    chatId,
    messageId,
`✏️ PESAN BOT

Pilih pesan yang ingin diedit:`,

    [
      [
        {
          text: "👋 WELCOME",
          callback_data:
            "admin:message:welcome",
        },
      ],
      [
        {
          text: "📦 PRODUK KOSONG",
          callback_data:
            "admin:message:empty_products",
        },
      ],
      [
        {
          text: "🧾 DETAIL PRODUK",
          callback_data:
            "admin:message:product_detail",
        },
      ],
      [
        {
          text: "💳 MENUNGGU BAYAR",
          callback_data:
            "admin:message:waiting_payment",
        },
      ],
      [
        {
          text: "✅ PEMBAYARAN BERHASIL",
          callback_data:
            "admin:message:payment_success",
        },
      ],
      [
        {
          text: "❌ PEMBAYARAN GAGAL",
          callback_data:
            "admin:message:payment_failed",
        },
      ],
      [
        {
          text: "🔐 VIP AKTIF",
          callback_data:
            "admin:message:vip_active",
        },
      ],
      [
        {
          text: "⏰ VIP BERAKHIR",
          callback_data:
            "admin:message:vip_expired",
        },
      ],
      [
        {
         text: "📥 PEMBAYARAN DIGITAL",
         callback_data:
           "admin:message:payment_success_digital",
        },
      ],
      [
        {
          text: "📦 DIGITAL TERKIRIM",
          callback_data:
            "admin:message:digital_sent",
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:menu",
        },
      ],
    ]
  );
}


export async function showMessageEditor(
  env,
  chatId,
  messageId,
  type
) {
  const config =
    messageTypes[type];

  if (!config) {
    return;
  }

  const current =
    await getMessage(
      env,
      config.key
    );

  return editMessage(
    env,
    chatId,
    messageId,
    `✏️ ${config.name}

Pesan saat ini:

${current}`,

    [
      [
        {
          text: "✏️ EDIT",
          callback_data:
            `admin:message:edit:${type}`,
        },
      ],
      [
        {
          text: "🔄 DEFAULT",
          callback_data:
            `admin:message:default:${type}`,
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:messages",
        },
      ],
    ]
  );
}


export async function startMessageEdit(
  env,
  chatId,
  messageId,
  type
) {
  const config =
    messageTypes[type];

  if (!config) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type: "EDIT_MESSAGE",
      message_type: type,
      message_id: messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT ${config.name}

Kirim pesan baru sekarang.

Placeholder yang tersedia:

{first_name}
{product_name}
{description}
{price}
{duration}
{order_code}
{minutes}
{expires_at}`,

    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:message:cancel:${type}`,
        },
      ],
    ]
  );
}


export async function cancelMessageEdit(
  env,
  chatId,
  messageId,
  type
) {
  await deleteState(
    env,
    chatId
  );

  return showMessageEditor(
    env,
    chatId,
    messageId,
    type
  );
}


export async function handleMessageInput(
  env,
  message,
  state
) {
  const config =
    messageTypes[
      state.message_type
    ];

  if (!config) {
    return false;
  }

  if (!message.text) {
    return true;
  }

  await setMessage(
    env,
    config.key,
    message.text
  );

  await deleteState(
    env,
    message.from.id
  );

  if (message.message_id) {
    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    );
  }

  await showMessageEditor(
    env,
    message.chat.id,
    state.message_id,
    state.message_type
  );

  return true;
}


export async function restoreDefault(
  env,
  chatId,
  messageId,
  type
) {
  const config =
    messageTypes[type];

  if (!config) {
    return;
  }

  await setMessage(
    env,
    config.key,
    config.default
  );

  return showMessageEditor(
    env,
    chatId,
    messageId,
    type
  );
}


/**
 * Diekspor supaya fulfillment.js bisa memakai template pesan yang
 * sama persis dengan yang diedit admin di menu "PESAN BOT"
 * (payment_success, digital_sent, vip_active, dst).
 */
export async function getMessage(
  env,
  key
) {
  const rows =
    await supabase(
      env,
      `settings?key=eq.${encodeURIComponent(key)}&limit=1`
    );

  if (
    rows.length > 0 &&
    rows[0].value
  ) {
    return rows[0].value;
  }

  const config =
    Object.values(messageTypes)
      .find(
        (item) => item.key === key
      );

  return config?.default || "";
}


async function setMessage(
  env,
  key,
  value
) {
  return upsertSetting(
    env,
    key,
    value
  );
}

/**
 * index.js masih mengimpor `getState` dari file ini (dipakai untuk
 * membaca state admin di router utama), jadi kita re-export dari
 * modul state terpusat supaya tidak ada breaking change di index.js.
 */
export const getState =
  getAdminState;
