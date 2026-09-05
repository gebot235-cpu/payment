import {
  editMessage,
  deleteMessage,
} from "../telegram.js";

import {
  saveState,
  deleteState,
} from "../state.js";

import {
  getShopSettings,
  setShopSetting,
  resetShopSetting,
  isDefaultValue,
} from "../settings.js";

/*
 * Sebelumnya menu "⚙️ PENGATURAN" cuma placeholder ("belum
 * tersedia"). Sekarang berisi hal-hal yang mempengaruhi tampilan
 * toko ke customer, semua bisa diubah langsung dari bot:
 *  - foto banner welcome
 *  - kontak CS
 *  - format harga (pemisah ribuan + prefix mata uang)
 *  - label tombol BAYAR / KEMBALI
 *
 * Nama toko & isi pesan sambutan itu sendiri sudah bisa diedit
 * lewat menu "✏️ PESAN BOT" > "👋 WELCOME" yang sudah ada — jadi
 * tidak diduplikasi di sini.
 */

const FIELD_LABELS = {
  welcome_photo: "🖼️ Foto Banner Welcome",
  cs_contact: "📞 Kontak CS",
  price_currency: "💰 Prefix Mata Uang",
  btn_pay_label: "🔘 Label Tombol BAYAR",
  btn_back_label: "🔘 Label Tombol KEMBALI",
  invite_link_hours: "🔗 Durasi Invite Link (jam)",
};

export async function showSettingsMenu(
  env,
  chatId,
  messageId
) {
  const settings =
    await getShopSettings(env);

  const text =
`⚙️ PENGATURAN TOKO

🖼️ Banner Welcome: ${
      settings.welcome_photo
        ? "✅ terpasang"
        : "— belum ada"
    }
📞 Kontak CS: ${
      settings.cs_contact || "— belum diisi"
    }
💰 Format Harga: contoh ${settings.price_currency}1${settings.price_separator}000${settings.price_separator}000
🔘 Tombol: "${settings.btn_pay_label}" / "${settings.btn_back_label}"
🔗 Durasi Invite Link: ${settings.invite_link_hours} jam

Pilih yang mau diubah:`;

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    [
      [
        {
          text: "🖼️ FOTO BANNER",
          callback_data: "admin:setting:field:welcome_photo",
        },
      ],
      [
        {
          text: "📞 KONTAK CS",
          callback_data: "admin:setting:field:cs_contact",
        },
      ],
      [
        {
          text: "💰 FORMAT HARGA",
          callback_data: "admin:setting:price",
        },
      ],
      [
        {
          text: "🔘 LABEL TOMBOL",
          callback_data: "admin:setting:buttons",
        },
      ],
      [
        {
          text: "🔗 DURASI INVITE LINK",
          callback_data: "admin:setting:field:invite_link_hours",
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data: "admin:menu",
        },
      ],
    ]
  );
}

export async function showPriceFormatMenu(
  env,
  chatId,
  messageId
) {
  const settings =
    await getShopSettings(env);

  return editMessage(
    env,
    chatId,
    messageId,
`💰 FORMAT HARGA

Contoh tampilan saat ini:
${settings.price_currency}1${settings.price_separator}000${settings.price_separator}000

Prefix mata uang: "${settings.price_currency}"
Pemisah ribuan: "${settings.price_separator}"`,
    [
      [
        {
          text:
            settings.price_separator === "."
              ? "✅ Titik (1.000.000)"
              : "Titik (1.000.000)",
          callback_data: "admin:setting:price:sep:.",
        },
      ],
      [
        {
          text:
            settings.price_separator === ","
              ? "✅ Koma (1,000,000)"
              : "Koma (1,000,000)",
          callback_data: "admin:setting:price:sep:,",
        },
      ],
      [
        {
          text: "✏️ UBAH PREFIX MATA UANG",
          callback_data: "admin:setting:field:price_currency",
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data: "admin:settings",
        },
      ],
    ]
  );
}

export async function setPriceSeparator(
  env,
  chatId,
  messageId,
  separator
) {
  if (separator !== "." && separator !== ",") {
    return;
  }

  await setShopSetting(
    env,
    "price_separator",
    separator
  );

  return showPriceFormatMenu(
    env,
    chatId,
    messageId
  );
}

export async function showButtonLabelsMenu(
  env,
  chatId,
  messageId
) {
  const settings =
    await getShopSettings(env);

  return editMessage(
    env,
    chatId,
    messageId,
`🔘 LABEL TOMBOL

Tombol saat ini:
💳 Bayar: "${settings.btn_pay_label}"
◀️ Kembali: "${settings.btn_back_label}"

Pilih yang mau diubah:`,
    [
      [
        {
          text: "✏️ LABEL TOMBOL BAYAR",
          callback_data: "admin:setting:field:btn_pay_label",
        },
      ],
      [
        {
          text: "✏️ LABEL TOMBOL KEMBALI",
          callback_data: "admin:setting:field:btn_back_label",
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data: "admin:settings",
        },
      ],
    ]
  );
}

/**
 * Titik masuk edit satu field. `field` salah satu dari
 * FIELD_LABELS di atas. welcome_photo minta media, sisanya minta
 * teks.
 */
export async function startFieldEdit(
  env,
  chatId,
  messageId,
  field
) {
  const label = FIELD_LABELS[field];

  if (!label) {
    return;
  }

  const settings =
    await getShopSettings(env);

  const currentValue =
    settings[field] || "— belum diisi";

  const isPhoto = field === "welcome_photo";

  await saveState(
    env,
    chatId,
    {
      type: "EDIT_SETTING",
      field,
      message_id: messageId,
    }
  );

  const buttons = [
    [
      {
        text: "❌ BATAL",
        callback_data: `admin:setting:cancel:${field}`,
      },
    ],
  ];

  if (!isDefaultValue(field, settings[field])) {
    buttons.unshift([
      {
        text: "🔄 RESET KE DEFAULT",
        callback_data: `admin:setting:reset:${field}`,
      },
    ]);
  }

  return editMessage(
    env,
    chatId,
    messageId,
    isPhoto
      ?
`${label}

Saat ini: ${settings.welcome_photo ? "✅ terpasang" : "— belum ada"}

Kirim foto baru untuk mengganti banner welcome (dikirim bersama pesan /start).`
      : field === "invite_link_hours"
      ?
`${label}

Nilai saat ini: ${currentValue} jam

Kirim angka jumlah jam sebelum invite link VIP otomatis kadaluwarsa (kalau belum dipakai). Contoh: 5`
      :
`${label}

Nilai saat ini:
${currentValue}

Kirim teks baru untuk mengganti nilai ini.`,
    buttons
  );
}

export async function handleFieldInput(
  env,
  message,
  state
) {
  const field = state.field;
  const isPhoto = field === "welcome_photo";

  let newValue = null;

  if (isPhoto) {
    const fileId =
      message.photo?.length
        ? message.photo.at(-1)?.file_id
        : null;

    if (!fileId) {
      await editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Itu bukan foto.

Kirim foto (bukan dokumen/file) untuk banner welcome.`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data: `admin:setting:cancel:${field}`,
            },
          ],
        ]
      );

      return true;
    }

    newValue = fileId;
  } else {
    newValue = (message.text || "").trim();

    if (!newValue) {
      return true;
    }

    if (field === "invite_link_hours") {
      const hours = Number(newValue);

      if (
        !Number.isFinite(hours) ||
        hours <= 0 ||
        hours > 720
      ) {
        await editMessage(
          env,
          message.chat.id,
          state.message_id,
`❌ Angka tidak valid.

Kirim angka jam antara 1-720 (maksimal 30 hari), contoh: 5`,
          [
            [
              {
                text: "❌ BATAL",
                callback_data: `admin:setting:cancel:${field}`,
              },
            ],
          ]
        );

        return true;
      }

      newValue = String(hours);
    }
  }

  await setShopSetting(
    env,
    field,
    newValue
  );

  await deleteState(
    env,
    message.chat.id
  );

  await deleteMessage(
    env,
    message.chat.id,
    message.message_id
  );

  return showSettingsMenu(
    env,
    message.chat.id,
    state.message_id
  );
}

export async function cancelFieldEdit(
  env,
  chatId,
  messageId
) {
  await deleteState(
    env,
    chatId
  );

  return showSettingsMenu(
    env,
    chatId,
    messageId
  );
}

export async function resetField(
  env,
  chatId,
  messageId,
  field
) {
  await resetShopSetting(
    env,
    field
  );

  await deleteState(
    env,
    chatId
  );

  return showSettingsMenu(
    env,
    chatId,
    messageId
  );
}
