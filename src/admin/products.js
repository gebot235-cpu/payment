import {
  editMessage,
  deleteMessage,
} from "../telegram.js";

import {
  supabase,
} from "../supabase.js";

import {
  getState,
  saveState,
  updateState,
  deleteState,
} from "../state.js";

export async function showAdminProducts(
  env,
  chatId,
  messageId
) {
  await deleteState(env, chatId);

  const products = await getAllProducts(env);

  return editMessage(
    env,
    chatId,
    messageId,
`📦 PRODUK

Total produk: ${products.length}`,
    [
      [
        {
          text: "➕ TAMBAH PRODUK",
          callback_data: "admin:product:add",
        },
      ],
      [
        {
          text: "📋 DAFTAR PRODUK",
          callback_data: "admin:product:list",
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

export async function showProductList(
  env,
  chatId,
  messageId
) {
  await deleteState(env, chatId);

  const products = await getAllProducts(env);

  const buttons = products.map((product) => [
    {
      text: `${product.is_active ? "🟢" : "🔴"} ${product.name}`,
      callback_data: `admin:product:view:${product.id}`,
    },
  ]);

  buttons.push([
    {
      text: "➕ TAMBAH",
      callback_data: "admin:product:add",
    },
  ]);

  buttons.push([
    {
      text: "◀️ KEMBALI",
      callback_data: "admin:products",
    },
  ]);

  return editMessage(
    env,
    chatId,
    messageId,
    products.length
      ? "📋 DAFTAR PRODUK\n\nPilih produk:"
      : "📋 DAFTAR PRODUK\n\nBelum ada produk.",
    buttons
  );
}

export async function showProductDetail(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(env, chatId);

  const product = await getProduct(env, productId);

  if (!product) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Produk tidak ditemukan.",
      [
        [
          {
            text: "◀️ KEMBALI",
            callback_data: "admin:product:list",
          },
        ],
      ]
    );
  }

  let text =
`📦 ${product.name}

💰 Rp${Number(product.price || 0).toLocaleString("id-ID")}

🏷️ ${product.type}
🟢 Status: ${product.is_active ? "Aktif" : "Nonaktif"}`;

  if (product.description) {
    text += `\n\n📝 ${product.description}`;
  }

  if (product.type === "VIP") {
    text +=
      product.duration_days
        ? `\n⏳ ${product.duration_days} hari`
        : `\n⏳ ♾️ Selamanya (tanpa batas)`;

    const channels = await getProductChannels(
      env,
      product.id
    );

    if (channels.length) {
      text += "\n\n📢 Channel:";

      for (const channel of channels) {
        text += `\n• ${channel.name || channel.channel_id}`;
      }
    } else {
      text += "\n\n📢 Channel: Belum dipilih";
    }
  }

  if (product.type === "DIGITAL") {
    text += `\n📎 File: ${product.file_id ? "Tersedia" : "Belum ada"}`;
  }

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    [
      [
        {
          text: "✏️ EDIT",
          callback_data: `admin:product:edit:${product.id}`,
        },
      ],
      [
        {
          text: product.is_active
            ? "🔴 NONAKTIFKAN"
            : "🟢 AKTIFKAN",
          callback_data: `admin:product:toggle:${product.id}`,
        },
      ],
      [
        {
          text: "🗑️ HAPUS",
          callback_data: `admin:product:delete:${product.id}`,
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data: "admin:product:list",
        },
      ],
    ]
  );
}

export async function showProductEdit(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(env, chatId);

  const product = await getProduct(env, productId);

  if (!product) {
    return;
  }

  const buttons = [
    [
      {
        text: "📝 NAMA",
        callback_data: `admin:product:field:name:${product.id}`,
      },
    ],
    [
      {
        text: "📄 DESKRIPSI",
        callback_data: `admin:product:field:description:${product.id}`,
      },
    ],
    [
      {
        text: "💰 HARGA",
        callback_data: `admin:product:field:price:${product.id}`,
      },
    ],
  ];

  if (product.type === "VIP") {
    buttons.push([
      {
        text: "⏳ DURASI",
        callback_data: `admin:product:field:duration_days:${product.id}`,
      },
    ]);

    buttons.push([
      {
        text: "📢 CHANNEL",
        callback_data: `admin:product:channels:${product.id}`,
      },
    ]);

    buttons.push([
      {
        text: "🎁 BERIKAN AKSES KE USER",
        callback_data: `admin:product:grant:${product.id}`,
      },
    ]);
  }

  buttons.push([
    {
      text: "◀️ KEMBALI",
      callback_data: `admin:product:view:${product.id}`,
    },
  ]);

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT PRODUK

📦 ${product.name}

Pilih data yang ingin diubah:`,
    buttons
  );
}

export async function startProductFieldEdit(
  env,
  chatId,
  messageId,
  productId,
  field
) {
  const product = await getProduct(env, productId);

  if (!product) {
    return;
  }

  const labels = {
    name: "NAMA",
    description: "DESKRIPSI",
    price: "HARGA",
    duration_days: "DURASI",
  };

  const label = labels[field];

  if (!label) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type: "EDIT_PRODUCT",
      product_id: Number(productId),
      field,
      message_id: messageId,
    }
  );

  const buttons = [];

  if (field === "duration_days") {
    buttons.push([
      {
        text: "♾️ SELAMANYA (TANPA BATAS)",
        callback_data: `admin:product:duration:lifetime:${product.id}`,
      },
    ]);
  }

  buttons.push([
    {
      text: "❌ BATAL",
      callback_data: `admin:product:cancel:${product.id}`,
    },
  ]);

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT ${label}

Produk:
${product.name}
${
      field === "duration_days"
        ? `\nDurasi saat ini: ${
            product.duration_days
              ? `${product.duration_days} hari`
              : "♾️ Selamanya"
          }`
        : ""
    }

Kirim nilai baru:`,
    buttons
  );
}

/**
 * Dipanggil saat admin menekan tombol "♾️ SELAMANYA" saat mengedit
 * durasi produk VIP yang SUDAH ADA (bukan wizard tambah baru).
 * Langsung set duration_days = null tanpa perlu input teks.
 */
export async function setLifetimeDurationForExisting(
  env,
  chatId,
  messageId,
  productId
) {
  await updateProduct(
    env,
    productId,
    {
      duration_days: null,
      updated_at: new Date().toISOString(),
    }
  );

  await deleteState(
    env,
    chatId
  );

  return showProductEdit(
    env,
    chatId,
    messageId,
    productId
  );
}

export async function handleProductInput(
  env,
  message,
  state
) {
  const value = message.text?.trim();

  if (!value) {
    return true;
  }

  const fields = [
    "name",
    "description",
    "price",
    "duration_days",
  ];

  if (!fields.includes(state.field)) {
    return true;
  }

  let finalValue = value;

  if (
    state.field === "price" ||
    state.field === "duration_days"
  ) {
    if (!/^\d+$/.test(value)) {
      await editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Nilai tidak valid.

Kirim angka saja.`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data: `admin:product:cancel:${state.product_id}`,
            },
          ],
        ]
      );

      return true;
    }

    const number = Number(value);

    if (!Number.isSafeInteger(number) || number <= 0) {
      return true;
    }

    finalValue = number;
  }

  await updateProduct(
    env,
    state.product_id,
    {
      [state.field]: finalValue,
      updated_at: new Date().toISOString(),
    }
  );

  await deleteState(
    env,
    message.chat.id
  );

  await deleteInput(
    env,
    message
  );

  return showProductEdit(
    env,
    message.chat.id,
    state.message_id,
    state.product_id
  );
}

export async function startAddProduct(
  env,
  chatId,
  messageId
) {
  await saveState(
    env,
    chatId,
    {
      type: "ADD_PRODUCT",
      step: "TYPE",
      message_id: messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`➕ TAMBAH PRODUK

Pilih jenis produk:`,
    [
      [
        {
          text: "🟢 VIP",
          callback_data: "admin:product:add:type:VIP",
        },
      ],
      [
        {
          text: "📦 DIGITAL",
          callback_data: "admin:product:add:type:DIGITAL",
        },
      ],
      [
        {
          text: "❌ BATAL",
          callback_data: "admin:product:cancel",
        },
      ],
    ]
  );
}

export async function selectAddProductType(
  env,
  chatId,
  messageId,
  type
) {
  if (
    type !== "VIP" &&
    type !== "DIGITAL"
  ) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type: "ADD_PRODUCT",
      step: "NAME",
      product_type: type,
      message_id: messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`➕ TAMBAH ${type}

Langkah 1

Kirim nama produk:`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data: "admin:product:cancel",
        },
      ],
    ]
  );
}

export async function handleAddProductInput(
  env,
  message,
  state
) {
  const value = message.text?.trim();

  if (state.step === "NAME") {
    if (!value) {
      return true;
    }

    const nextState = {
      ...state,
      step: "DESCRIPTION",
      name: value,
    };

    await updateState(
      env,
      message.chat.id,
      nextState
    );

    await deleteInput(
      env,
      message
    );

    return editMessage(
      env,
      message.chat.id,
      state.message_id,
`➕ TAMBAH ${state.product_type}

Langkah 2

Nama:
${value}

Kirim deskripsi produk:`,
      [
        [
          {
            text: "⏭️ LEWATI",
            callback_data: "admin:product:add:skip:description",
          },
        ],
        [
          {
            text: "❌ BATAL",
            callback_data: "admin:product:cancel",
          },
        ],
      ]
    );
  }

  if (state.step === "DESCRIPTION") {
    if (!value) {
      return true;
    }

    const nextState = {
      ...state,
      step: "PRICE",
      description: value,
    };

    await updateState(
      env,
      message.chat.id,
      nextState
    );

    await deleteInput(
      env,
      message
    );

    return editMessage(
      env,
      message.chat.id,
      state.message_id,
`➕ TAMBAH ${state.product_type}

Langkah 3

Kirim harga produk.

Contoh:
50000`,
      [
        [
          {
            text: "❌ BATAL",
            callback_data: "admin:product:cancel",
          },
        ],
      ]
    );
  }

  if (state.step === "PRICE") {
    if (!value || !/^\d+$/.test(value)) {
      return editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Harga tidak valid.

Kirim harga dalam angka.

Contoh:
50000`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data: "admin:product:cancel",
            },
          ],
        ]
      );
    }

    const price = Number(value);

    if (!Number.isSafeInteger(price) || price <= 0) {
      return true;
    }

    const nextState = {
      ...state,
      step:
        state.product_type === "VIP"
          ? "DURATION"
          : "FILE",
      price,
      file_id: state.file_id || null,
    };

    await updateState(
      env,
      message.chat.id,
      nextState
    );

    await deleteInput(
      env,
      message
    );

    if (state.product_type === "VIP") {
      return editMessage(
        env,
        message.chat.id,
        state.message_id,
`➕ TAMBAH VIP

Langkah 4

Kirim masa aktif dalam hari, atau pilih SELAMANYA untuk tanpa batas waktu.

Contoh:
30`,
        [
          [
            {
              text: "♾️ SELAMANYA (TANPA BATAS)",
              callback_data: "admin:product:duration:lifetime",
            },
          ],
          [
            {
              text: "❌ BATAL",
              callback_data: "admin:product:cancel",
            },
          ],
        ]
      );
    }

    return editMessage(
      env,
      message.chat.id,
      state.message_id,
`➕ TAMBAH DIGITAL

Langkah 4

📎 Kirim konten digitalnya sekarang.

Bisa berupa media:
📷 Foto
📄 Dokumen
🎥 Video
🎵 Audio
🎙️ Voice
🎞️ Animation
📹 Video Note
🖼️ Sticker

Atau kirim 🔗 LINK / teks (URL Google Drive, kode redeem, dll) sebagai pesan teks biasa.`,
      [
        [
          {
            text: "❌ BATAL",
            callback_data: "admin:product:cancel",
          },
        ],
      ]
    );
  }

  if (state.step === "FILE") {
    const media = getTelegramFileId(message);

    if (!media) {
      const linkText =
        (message.text || "").trim();

      if (linkText) {
        /*
         * Bukan media Telegram — anggap sebagai konten link/teks
         * (URL Google Drive, kode redeem, lisensi, dll). Disimpan
         * di kolom file_id yang sama dengan media supaya tidak
         * butuh kolom database baru; file_type="link" menandai
         * cara pengirimannya nanti (teks biasa, bukan sendDocument
         * dkk).
         */
        const nextState = {
          ...state,
          step: "CONFIRM",
          file_id: linkText,
          file_type: "link",
        };

        await updateState(
          env,
          message.chat.id,
          nextState
        );

        await deleteInput(
          env,
          message
        );

        return showAddConfirmation(
          env,
          message.chat.id,
          state.message_id,
          nextState
        );
      }

      return editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Konten tidak ditemukan.

Kirim media Telegram yang didukung, atau kirim link/teks sebagai pesan teks biasa:
📷 Foto
📄 Dokumen
🎥 Video
🎵 Audio
🎙️ Voice
🎞️ Animation
📹 Video Note
🖼️ Sticker
🔗 Link/teks`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data: "admin:product:cancel",
            },
          ],
        ]
      );
    }

    const nextState = {
      ...state,
      step: "CONFIRM",
      file_id: media.fileId,
      file_type: media.fileType,
    };

    await updateState(
      env,
      message.chat.id,
      nextState
    );

    await deleteInput(
      env,
      message
    );

    return showAddConfirmation(
      env,
      message.chat.id,
      state.message_id,
      nextState
    );
  }

  if (state.step === "DURATION") {
    if (!value || !/^\d+$/.test(value)) {
      return editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Durasi tidak valid.

Kirim jumlah hari, atau pilih SELAMANYA untuk tanpa batas.

Contoh:
30`,
        [
          [
            {
              text: "♾️ SELAMANYA (TANPA BATAS)",
              callback_data: "admin:product:duration:lifetime",
            },
          ],
          [
            {
              text: "❌ BATAL",
              callback_data: "admin:product:cancel",
            },
          ],
        ]
      );
    }

    const duration = Number(value);

    if (!Number.isSafeInteger(duration) || duration <= 0) {
      return true;
    }

    const nextState = {
      ...state,
      step: "CHANNELS",
      duration_days: duration,
      duration_lifetime: false,
      selected_channels:
        state.selected_channels || [],
    };

    await updateState(
      env,
      message.chat.id,
      nextState
    );

    await deleteInput(
      env,
      message
    );

    return showChannelSelector(
      env,
      message.chat.id,
      state.message_id,
      nextState
    );
  }

  return true;
}

/**
 * Dipanggil saat admin menekan tombol "♾️ SELAMANYA" pada wizard
 * tambah produk VIP — melewati input teks durasi dan langsung
 * lanjut ke pemilihan channel dengan duration_days = null (tanpa
 * batas waktu).
 */
export async function setLifetimeDuration(
  env,
  chatId,
  messageId
) {
  const state = await getState(env, chatId);

  if (
    !state ||
    state.type !== "ADD_PRODUCT" ||
    state.product_type !== "VIP"
  ) {
    return;
  }

  const nextState = {
    ...state,
    step: "CHANNELS",
    duration_days: null,
    duration_lifetime: true,
    selected_channels:
      state.selected_channels || [],
  };

  await updateState(
    env,
    chatId,
    nextState
  );

  return showChannelSelector(
    env,
    chatId,
    messageId,
    nextState
  );
}

export async function skipDescription(
  env,
  chatId,
  messageId
) {
  const state = await getState(env, chatId);

  if (!state) {
    return;
  }

  const nextState = {
    ...state,
    step: "PRICE",
    description: null,
  };

  await updateState(
    env,
    chatId,
    nextState
  );

  return editMessage(
    env,
    chatId,
    messageId,
`➕ TAMBAH ${state.product_type}

Langkah 3

Kirim harga produk.

Contoh:
50000`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data: "admin:product:cancel",
        },
      ],
    ]
  );
}

async function showChannelSelector(
  env,
  chatId,
  messageId,
  state
) {
  const channels = await getChannels(env);

  if (!channels.length) {
    return editMessage(
      env,
      chatId,
      messageId,
`❌ BELUM ADA CHANNEL

Tambahkan channel VIP terlebih dahulu.`,
      [
        [
          {
            text: "📢 CHANNEL VIP",
            callback_data: "admin:channel",
          },
        ],
        [
          {
            text: "❌ BATAL",
            callback_data: "admin:product:cancel",
          },
        ],
      ]
    );
  }

  const nextState = {
    ...state,
    step: "CHANNELS",
    selected_channels:
      state.selected_channels || [],
  };

  await updateState(
    env,
    chatId,
    nextState
  );

  return renderChannelSelector(
    env,
    chatId,
    messageId,
    nextState,
    channels
  );
}

async function renderChannelSelector(
  env,
  chatId,
  messageId,
  state,
  channels
) {
  const selected =
    state.selected_channels || [];

  const buttons = channels.map((channel) => {
    const active =
      selected.includes(Number(channel.id));

    return [
      {
        text:
          `${active ? "☑️" : "☐"} ${channel.name || channel.channel_id}`,
        callback_data:
          `admin:product:channel:toggle:${channel.id}`,
      },
    ];
  });

  buttons.push([
    {
      text: "✅ LANJUT",
      callback_data:
        "admin:product:channels:save",
    },
  ]);

  buttons.push([
    {
      text: "❌ BATAL",
      callback_data:
        "admin:product:cancel",
    },
  ]);

  return editMessage(
    env,
    chatId,
    messageId,
`📢 PILIH CHANNEL

Pilih satu atau beberapa channel untuk produk ini.

Terpilih: ${selected.length}`,
    buttons
  );
}

export async function toggleProductChannel(
  env,
  chatId,
  messageId,
  channelId
) {
  const state = await getState(env, chatId);

  if (!state) {
    return;
  }

  const selected = [
    ...(state.selected_channels || []),
  ];

  const id = Number(channelId);
  const index = selected.indexOf(id);

  if (index === -1) {
    selected.push(id);
  } else {
    selected.splice(index, 1);
  }

  const nextState = {
    ...state,
    step: "CHANNELS",
    selected_channels: selected,
  };

  await updateState(
    env,
    chatId,
    nextState
  );

  const channels = await getChannels(env);

  return renderChannelSelector(
    env,
    chatId,
    messageId,
    nextState,
    channels
  );
}

export async function saveProductChannels(
  env,
  chatId,
  messageId
) {
  const state = await getState(env, chatId);

  if (!state) {
    return;
  }

  if (!state.selected_channels?.length) {
    const channels = await getChannels(env);

    return renderChannelSelector(
      env,
      chatId,
      messageId,
      state,
      channels
    );
  }

  const nextState = {
    ...state,
    step: "CONFIRM",
  };

  await updateState(
    env,
    chatId,
    nextState
  );

  return showAddConfirmation(
    env,
    chatId,
    messageId,
    nextState
  );
}

async function showAddConfirmation(
  env,
  chatId,
  messageId,
  state
) {
  let text =
`➕ KONFIRMASI PRODUK

📦 ${state.name}

🏷️ ${state.product_type}

💰 Rp${Number(state.price || 0).toLocaleString("id-ID")}`;

  if (state.product_type === "VIP") {
    text +=
      state.duration_lifetime
        ? `\n⏳ ♾️ Selamanya (tanpa batas)`
        : `\n⏳ ${state.duration_days} hari`;

    const channels = await getChannelsByIds(
      env,
      state.selected_channels || []
    );

    if (channels.length) {
      text += "\n\n📢 Channel:";

      for (const channel of channels) {
        text += `\n• ${channel.name || channel.channel_id}`;
      }
    }
  }

  if (state.product_type === "DIGITAL") {
    text +=
      state.file_type === "link"
        ? `\n🔗 Link/Teks: ${state.file_id || "Belum ada"}`
        : `\n📎 Media/File: ${state.file_id ? "Tersedia" : "Belum ada"}`;
  }

  if (state.description) {
    text += `\n\n📝 ${state.description}`;
  }

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    [
      [
        {
          text: "✅ SIMPAN",
          callback_data:
            "admin:product:add:save",
        },
      ],
      [
        {
          text: "❌ BATAL",
          callback_data:
            "admin:product:cancel",
        },
      ],
    ]
  );
}

export async function saveNewProduct(
  env,
  chatId,
  messageId
) {
  const state = await getState(env, chatId);

  if (
    !state.name ||
    !state.price ||
    !state.product_type
  ) {
    return;
  }

  if (
    state.product_type === "VIP" &&
    (
      (
        !state.duration_days &&
        !state.duration_lifetime
      ) ||
      !state.selected_channels?.length
    )
  ) {
    return;
  }

  if (
    state.product_type === "DIGITAL" &&
    !state.file_id
  ) {
    return editMessage(
      env,
      chatId,
      messageId,
`❌ File/media digital belum ada.

Silakan upload media/file terlebih dahulu.`,
      [
        [
          {
            text: "❌ BATAL",
            callback_data:
              "admin:product:cancel",
          },
        ],
      ]
    );
  }

  const rows = await supabase(
    env,
    "products",
    "POST",
    {
      name: state.name,
      description:
        state.description || null,
      price: Number(state.price),
      type: state.product_type,
      duration_days:
        state.product_type === "VIP"
          ? (
              state.duration_lifetime
                ? null
                : Number(state.duration_days)
            )
          : null,
      file_id:
        state.product_type === "DIGITAL"
          ? state.file_id
          : null,
      file_type:
        state.product_type === "DIGITAL"
          ? state.file_type
          : null,
      is_active: true,
    },
    {
      Prefer: "return=representation",
    }
  );

  const product = rows?.[0];

  if (!product) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Gagal menyimpan produk.",
      [
        [
          {
            text: "◀️ PRODUK",
            callback_data:
              "admin:products",
          },
        ],
      ]
    );
  }

  if (state.product_type === "VIP") {
    for (const channelId of state.selected_channels) {
      await supabase(
        env,
        "product_channels",
        "POST",
        {
          product_id:
            Number(product.id),
          channel_id:
            Number(channelId),
        }
      );
    }
  }

  await deleteState(
    env,
    chatId
  );

  return editMessage(
    env,
    chatId,
    messageId,
`✅ PRODUK TERSIMPAN

📦 ${state.name}

Produk berhasil ditambahkan.`,
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

export async function showProductChannels(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(env, chatId);

  const product =
    await getProduct(env, productId);

  if (
    !product ||
    product.type !== "VIP"
  ) {
    return;
  }

  const channels =
    await getChannels(env);

  if (!channels.length) {
    return editMessage(
      env,
      chatId,
      messageId,
`❌ BELUM ADA CHANNEL

Tambahkan channel VIP terlebih dahulu.`,
      [
        [
          {
            text: "📢 CHANNEL VIP",
            callback_data:
              "admin:channel",
          },
        ],
        [
          {
            text: "◀️ KEMBALI",
            callback_data:
              `admin:product:edit:${product.id}`,
          },
        ],
      ]
    );
  }

  const selectedRows =
    await getProductChannels(
      env,
      productId
    );

  const selected =
    selectedRows.map(
      (channel) => Number(channel.id)
    );

  return renderEditChannelSelector(
    env,
    chatId,
    messageId,
    product,
    channels,
    selected
  );
}

async function renderEditChannelSelector(
  env,
  chatId,
  messageId,
  product,
  channels,
  selected
) {
  const buttons = channels.map((channel) => {
    const active =
      selected.includes(
        Number(channel.id)
      );

    return [
      {
        text:
          `${active ? "☑️" : "☐"} ${channel.name || channel.channel_id}`,
        callback_data:
          `admin:product:editchannel:toggle:${product.id}:${channel.id}`,
      },
    ];
  });

  buttons.push([
    {
      text: "✅ SIMPAN",
      callback_data:
        `admin:product:editchannel:save:${product.id}`,
    },
  ]);

  buttons.push([
    {
      text: "◀️ BATAL",
      callback_data:
        `admin:product:editchannel:cancel:${product.id}`,
    },
  ]);

  await saveState(
    env,
    chatId,
    {
      type:
        "EDIT_PRODUCT_CHANNELS",
      product_id:
        Number(product.id),
      selected_channels:
        selected.map(Number),
      message_id:
        messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`📢 CHANNEL PRODUK

${product.name}

Pilih satu atau beberapa channel.`,
    buttons
  );
}

export async function toggleEditProductChannel(
  env,
  chatId,
  messageId,
  productId,
  channelId
) {
  const state =
    await getState(
      env,
      chatId
    );

  if (!state) {
    return;
  }

  const selected = [
    ...(state.selected_channels || []),
  ];

  const id =
    Number(channelId);

  const index =
    selected.indexOf(id);

  if (index === -1) {
    selected.push(id);
  } else {
    selected.splice(index, 1);
  }

  const product =
    await getProduct(
      env,
      productId
    );

  if (!product) {
    return;
  }

  const channels =
    await getChannels(env);

  const nextState = {
    ...state,
    selected_channels:
      selected,
  };

  await updateState(
    env,
    chatId,
    nextState
  );

  return renderEditChannelSelector(
    env,
    chatId,
    messageId,
    product,
    channels,
    selected
  );
}

export async function saveEditProductChannels(
  env,
  chatId,
  messageId,
  productId
) {
  const state =
    await getState(
      env,
      chatId
    );

  if (!state) {
    return;
  }

  if (
    !state.selected_channels?.length
  ) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Produk VIP harus memiliki minimal satu channel.",
      [
        [
          {
            text:
              "📢 PILIH CHANNEL",
            callback_data:
              `admin:product:channels:${productId}`,
          },
        ],
        [
          {
            text: "❌ BATAL",
            callback_data:
              `admin:product:editchannel:cancel:${productId}`,
          },
        ],
      ]
    );
  }

  await supabase(
    env,
    `product_channels?product_id=eq.${productId}`,
    "DELETE"
  );

  for (
    const channelId of
    state.selected_channels
  ) {
    await supabase(
      env,
      "product_channels",
      "POST",
      {
        product_id:
          Number(productId),
        channel_id:
          Number(channelId),
      }
    );
  }

  await deleteState(
    env,
    chatId
  );

  return showProductDetail(
    env,
    chatId,
    messageId,
    productId
  );
}

export async function toggleProduct(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(env, chatId);

  const product =
    await getProduct(
      env,
      productId
    );

  if (!product) {
    return;
  }

  await updateProduct(
    env,
    productId,
    {
      is_active:
        !product.is_active,
      updated_at:
        new Date().toISOString(),
    }
  );

  return showProductDetail(
    env,
    chatId,
    messageId,
    productId
  );
}

export async function confirmDeleteProduct(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(env, chatId);

  const product =
    await getProduct(
      env,
      productId
    );

  if (!product) {
    return;
  }

  return editMessage(
    env,
    chatId,
    messageId,
`🗑️ HAPUS PRODUK

${product.name}

Produk akan dihapus permanen.`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:product:view:${product.id}`,
        },
      ],
      [
        {
          text: "🗑️ HAPUS",
          callback_data:
            `admin:product:delete-confirm:${product.id}`,
        },
      ],
    ]
  );
}

export async function deleteProduct(
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
    `product_channels?product_id=eq.${productId}`,
    "DELETE"
  );

  await supabase(
    env,
    `products?id=eq.${productId}`,
    "DELETE"
  );

  return showProductList(
    env,
    chatId,
    messageId
  );
}

export async function cancelProductProcess(
  env,
  chatId,
  messageId,
  productId = null
) {
  await deleteState(
    env,
    chatId
  );

  if (productId) {
    return showProductEdit(
      env,
      chatId,
      messageId,
      productId
    );
  }

  return showAdminProducts(
    env,
    chatId,
    messageId
  );
}

export async function cancelEditProductChannels(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(
    env,
    chatId
  );

  return showProductEdit(
    env,
    chatId,
    messageId,
    productId
  );
}

/**
 * Mengambil file_id + jenis media dari semua jenis media Telegram
 * yang umum memiliki file_id. Jenis medianya dipakai saat pengiriman
 * produk ke customer supaya method Telegram yang dipanggil sesuai
 * (sendPhoto, sendVideo, dst), bukan selalu sendDocument.
 */
function getTelegramFileId(message) {
  if (!message) {
    return null;
  }

  if (message.document?.file_id) {
    return {
      fileId: message.document.file_id,
      fileType: "document",
    };
  }

  if (message.photo?.length) {
    const fileId = message.photo.at(-1)?.file_id;

    return fileId
      ? { fileId, fileType: "photo" }
      : null;
  }

  if (message.video?.file_id) {
    return {
      fileId: message.video.file_id,
      fileType: "video",
    };
  }

  if (message.audio?.file_id) {
    return {
      fileId: message.audio.file_id,
      fileType: "audio",
    };
  }

  if (message.voice?.file_id) {
    return {
      fileId: message.voice.file_id,
      fileType: "voice",
    };
  }

  if (message.animation?.file_id) {
    return {
      fileId: message.animation.file_id,
      fileType: "animation",
    };
  }

  if (message.video_note?.file_id) {
    return {
      fileId: message.video_note.file_id,
      fileType: "video_note",
    };
  }

  if (message.sticker?.file_id) {
    return {
      fileId: message.sticker.file_id,
      fileType: "sticker",
    };
  }

  return null;
}

async function getProduct(
  env,
  productId
) {
  const rows =
    await supabase(
      env,
      `products?id=eq.${productId}&limit=1`
    );

  return rows?.[0] || null;
}

async function getAllProducts(
  env
) {
  return (
    await supabase(
      env,
      "products?order=id.asc"
    )
  ) || [];
}

async function updateProduct(
  env,
  productId,
  data
) {
  return supabase(
    env,
    `products?id=eq.${productId}`,
    "PATCH",
    data
  );
}

async function getChannels(
  env
) {
  return (
    await supabase(
      env,
      "vip_channels?is_active=eq.true&order=id.asc"
    )
  ) || [];
}

async function getChannelsByIds(
  env,
  ids
) {
  if (!ids?.length) {
    return [];
  }

  const cleanIds =
    ids
      .map(Number)
      .filter(
        Number.isSafeInteger
      );

  if (!cleanIds.length) {
    return [];
  }

  return (
    await supabase(
      env,
      `vip_channels?id=in.(${cleanIds.join(",")})&order=id.asc`
    )
  ) || [];
}

async function getProductChannels(
  env,
  productId
) {
  const rows = (
    await supabase(
      env,
      `product_channels?product_id=eq.${productId}`
    )
  ) || [];

  if (!rows.length) {
    return [];
  }

  const ids =
    rows
      .map(
        (row) =>
          Number(row.channel_id)
      )
      .filter(
        Number.isSafeInteger
      );

  return getChannelsByIds(
    env,
    ids
  );
}

async function deleteInput(
  env,
  message
) {
  if (!message?.message_id) {
    return;
  }

  try {
    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    );
  } catch {
  }
}
