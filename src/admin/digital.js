import {
  editMessage,
  deleteMessage,
} from "../telegram.js";

import {
  supabase,
} from "../supabase.js";

import {
  saveState,
  deleteState,
} from "../state.js";

export async function showDigitalProduct(
  env,
  chatId,
  messageId,
  productId
) {
  const product =
    await getProduct(
      env,
      productId
    );

  if (
    !product ||
    product.type !== "DIGITAL"
  ) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Produk digital tidak ditemukan.",
      [
        [
          {
            text: "◀️ PRODUK",
            callback_data:
              "admin:product:list",
          },
        ],
      ]
    );
  }

  await deleteState(
    env,
    chatId
  );

  return editMessage(
    env,
    chatId,
    messageId,
`📦 ${product.name}

💰 Rp${Number(
      product.price || 0
    ).toLocaleString("id-ID")}

🏷️ DIGITAL
🟢 Status: ${
      product.is_active
        ? "Aktif"
        : "Nonaktif"
    }

${product.description || "Tanpa deskripsi"}

📎 File: ${
      product.file_type === "link"
        ? `🔗 ${product.file_id || "Belum ada"}`
        : product.file_id
        ? "Tersedia"
        : "Belum ada"
    }`,
    [
      [
        {
          text: "✏️ EDIT",
          callback_data:
            `admin:digital:edit:${product.id}`,
        },
      ],
      [
        {
          text: product.is_active
            ? "🔴 NONAKTIFKAN"
            : "🟢 AKTIFKAN",
          callback_data:
            `admin:product:toggle:${product.id}`,
        },
      ],
      [
        {
          text: "🗑️ HAPUS",
          callback_data:
            `admin:digital:delete:${product.id}`,
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:product:list",
        },
      ],
    ]
  );
}

export async function showDigitalEdit(
  env,
  chatId,
  messageId,
  productId
) {
  const product =
    await getProduct(
      env,
      productId
    );

  if (
    !product ||
    product.type !== "DIGITAL"
  ) {
    return;
  }

  await deleteState(
    env,
    chatId
  );

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT PRODUK DIGITAL

📦 ${product.name}

Pilih data yang ingin diubah:`,
    [
      [
        {
          text: "📝 NAMA",
          callback_data:
            `admin:digital:field:name:${product.id}`,
        },
      ],
      [
        {
          text: "📄 DESKRIPSI",
          callback_data:
            `admin:digital:field:description:${product.id}`,
        },
      ],
      [
        {
          text: "💰 HARGA",
          callback_data:
            `admin:digital:field:price:${product.id}`,
        },
      ],
      [
        {
          text: "📎 FILE / MEDIA / LINK",
          callback_data:
            `admin:digital:file:${product.id}`,
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            `admin:digital:view:${product.id}`,
        },
      ],
    ]
  );
}

export async function startDigitalFieldEdit(
  env,
  chatId,
  messageId,
  productId,
  field
) {
  const product =
    await getProduct(
      env,
      productId
    );

  if (
    !product ||
    product.type !== "DIGITAL"
  ) {
    return;
  }

  const labels = {
    name: "NAMA",
    description: "DESKRIPSI",
    price: "HARGA",
  };

  const label =
    labels[field];

  if (!label) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type:
        "EDIT_DIGITAL",
      product_id:
        Number(productId),
      field,
      message_id:
        messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT ${label}

Produk:
${product.name}

Kirim nilai baru:`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:digital:cancel:${product.id}`,
        },
      ],
    ]
  );
}

export async function handleDigitalFieldInput(
  env,
  message,
  state
) {
  const value =
    message.text?.trim();

  if (!value) {
    return true;
  }

  const fields = [
    "name",
    "description",
    "price",
  ];

  if (
    !fields.includes(
      state.field
    )
  ) {
    return true;
  }

  let finalValue =
    value;

  if (
    state.field === "price"
  ) {
    if (!/^\d+$/.test(value)) {
      await editMessage(
        env,
        message.chat.id,
        state.message_id,
        `❌ Harga tidak valid.

Kirim angka saja.`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data:
                `admin:digital:cancel:${state.product_id}`,
            },
          ],
        ]
      );

      return true;
    }

    const price =
      Number(value);

    if (
      !Number.isSafeInteger(
        price
      ) ||
      price <= 0
    ) {
      await editMessage(
        env,
        message.chat.id,
        state.message_id,
        `❌ Harga tidak valid.

Kirim angka yang lebih dari 0.`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data:
                `admin:digital:cancel:${state.product_id}`,
            },
          ],
        ]
      );

      return true;
    }

    finalValue =
      price;
  }

  await supabase(
    env,
    `products?id=eq.${Number(
      state.product_id
    )}`,
    "PATCH",
    {
      [state.field]:
        finalValue,
      updated_at:
        new Date().toISOString(),
    }
  );

  await deleteState(
    env,
    message.chat.id
  );

  try {
    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    );
  } catch {}

  return showDigitalEdit(
    env,
    message.chat.id,
    state.message_id,
    state.product_id
  );
}

export async function startDigitalFileEdit(
  env,
  chatId,
  messageId,
  productId
) {
  const product =
    await getProduct(
      env,
      productId
    );

  if (
    !product ||
    product.type !== "DIGITAL"
  ) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type:
        "EDIT_DIGITAL_FILE",
      product_id:
        Number(productId),
      message_id:
        messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`📎 GANTI FILE / MEDIA / LINK

Produk:
${product.name}

Kirim file/media digital, ATAU kirim link/teks sebagai pesan teks biasa (URL Google Drive, kode redeem, dll).

Media bisa berupa:
📷 Foto
📄 Dokumen
🎬 Video
🎵 Audio
🎙️ Voice
🎞️ Animation
🖼️ Sticker
📹 Video Note
dan media Telegram lainnya.`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:digital:cancel:${product.id}`,
        },
      ],
    ]
  );
}

export async function handleDigitalFileInput(
  env,
  message,
  state
) {
  const media =
    getTelegramMediaFileId(
      message
    );

  let fileId = media?.fileId;
  let fileType = media?.fileType;

  if (!media) {
    const linkText =
      (message.text || "").trim();

    if (linkText) {
      /*
       * Bukan media Telegram — anggap sebagai konten link/teks.
       * Disimpan di kolom file_id yang sama, file_type="link"
       * menandai cara pengirimannya nanti.
       */
      fileId = linkText;
      fileType = "link";
    } else {
      await editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ KONTEN TIDAK DITEMUKAN

Kirim media/file Telegram, atau kirim link/teks sebagai pesan teks biasa.`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data:
                `admin:digital:cancel:${state.product_id}`,
            },
          ],
        ]
      );

      return true;
    }
  }

  await supabase(
    env,
    `products?id=eq.${Number(
      state.product_id
    )}`,
    "PATCH",
    {
      file_id:
        fileId,
      file_type:
        fileType,
      updated_at:
        new Date().toISOString(),
    }
  );

  await deleteState(
    env,
    message.chat.id
  );

  try {
    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    );
  } catch {}

  return showDigitalEdit(
    env,
    message.chat.id,
    state.message_id,
    state.product_id
  );
}

/**
 * Ambil file_id + jenis medianya dari seluruh jenis media Telegram
 * yang umum digunakan untuk produk digital. Jenis medianya disimpan
 * supaya saat produk dikirim ke customer, bot memakai method Telegram
 * yang tepat (sendPhoto untuk foto, sendVideo untuk video, dst) —
 * bukan cuma menebak-nebak dari file_id saja.
 */
function getTelegramMediaFileId(
  message
) {
  if (!message) {
    return null;
  }

  if (
    message.document?.file_id
  ) {
    return {
      fileId: message.document.file_id,
      fileType: "document",
    };
  }

  if (
    message.photo?.length
  ) {
    const fileId =
      message.photo.at(-1)?.file_id;

    return fileId
      ? { fileId, fileType: "photo" }
      : null;
  }

  if (
    message.video?.file_id
  ) {
    return {
      fileId: message.video.file_id,
      fileType: "video",
    };
  }

  if (
    message.audio?.file_id
  ) {
    return {
      fileId: message.audio.file_id,
      fileType: "audio",
    };
  }

  if (
    message.voice?.file_id
  ) {
    return {
      fileId: message.voice.file_id,
      fileType: "voice",
    };
  }

  if (
    message.animation?.file_id
  ) {
    return {
      fileId: message.animation.file_id,
      fileType: "animation",
    };
  }

  if (
    message.video_note?.file_id
  ) {
    return {
      fileId: message.video_note.file_id,
      fileType: "video_note",
    };
  }

  if (
    message.sticker?.file_id
  ) {
    return {
      fileId: message.sticker.file_id,
      fileType: "sticker",
    };
  }

  return null;
}

export async function cancelDigitalProcess(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(
    env,
    chatId
  );

  return showDigitalEdit(
    env,
    chatId,
    messageId,
    productId
  );
}

export async function confirmDeleteDigital(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(
    env,
    chatId
  );

  const product =
    await getProduct(
      env,
      productId
    );

  if (
    !product ||
    product.type !== "DIGITAL"
  ) {
    return;
  }

  return editMessage(
    env,
    chatId,
    messageId,
`🗑️ HAPUS PRODUK DIGITAL

${product.name}

Produk akan dihapus permanen.`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:digital:view:${product.id}`,
        },
      ],
      [
        {
          text: "🗑️ HAPUS",
          callback_data:
            `admin:digital:delete-confirm:${product.id}`,
        },
      ],
    ]
  );
}

export async function deleteDigitalProduct(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(
    env,
    chatId
  );

  await supabase(
    env,
    `products?id=eq.${Number(
      productId
    )}`,
    "DELETE"
  );

  return editMessage(
    env,
    chatId,
    messageId,
    "✅ PRODUK DIGITAL DIHAPUS.",
    [
      [
        {
          text: "📦 PRODUK",
          callback_data:
            "admin:products",
        },
      ],
      [
        {
          text: "◀️ ADMIN",
          callback_data:
            "admin:menu",
        },
      ],
    ]
  );
}

async function getProduct(
  env,
  productId
) {
  const rows =
    await supabase(
      env,
      `products?id=eq.${Number(
        productId
      )}&limit=1`
    );

  return rows?.[0] || null;
}


