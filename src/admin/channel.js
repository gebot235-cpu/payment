import {
  editMessage,
  deleteMessage,
  sendMessage,
} from "../telegram.js";

import {
  supabase,
} from "../supabase.js";

import {
  saveState,
  deleteState,
} from "../state.js";


export async function showChannelMenu(
  env,
  chatId,
  messageId
) {
  const channels =
    await getChannels(env);

  const buttons =
    channels.map((channel) => [
      {
        text:
          `${channel.is_active ? "🟢" : "🔴"} ${channel.name || channel.channel_id}`,
        callback_data:
          `admin:channel:view:${channel.id}`,
      },
    ]);

  buttons.push([
    {
      text: "➕ TAMBAH CHANNEL",
      callback_data:
        "admin:channel:add",
    },
  ]);

  buttons.push([
    {
      text: "◀️ KEMBALI",
      callback_data:
        "admin:menu",
    },
  ]);

  return editMessage(
    env,
    chatId,
    messageId,
`📢 CHANNEL VIP

Total channel: ${channels.length}

Pilih channel:`,
    buttons
  );
}


export async function showChannelDetail(
  env,
  chatId,
  messageId,
  channelId
) {
  const channel =
    await getChannel(
      env,
      channelId
    );

  if (!channel) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Channel tidak ditemukan.",
      [
        [
          {
            text: "◀️ KEMBALI",
            callback_data:
              "admin:channel",
          },
        ],
      ]
    );
  }

  return editMessage(
    env,
    chatId,
    messageId,
`📢 CHANNEL VIP

${channel.name || "Channel VIP"}

🆔 ${channel.channel_id}

🟢 Status: ${channel.is_active ? "Aktif" : "Nonaktif"}`,
    [
      [
        {
          text: "✏️ EDIT",
          callback_data:
            `admin:channel:edit:${channel.id}`,
        },
      ],
      [
        {
          text: "🗑️ HAPUS",
          callback_data:
            `admin:channel:delete:${channel.id}`,
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:channel",
        },
      ],
    ]
  );
}


export async function startAddChannel(
  env,
  chatId,
  messageId
) {
  await saveState(
    env,
    chatId,
    {
      type: "ADD_CHANNEL",
      message_id: messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`➕ TAMBAH CHANNEL VIP

Kirim Channel ID.

Contoh:
-1001234567890`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            "admin:channel",
        },
      ],
    ]
  );
}


export async function startEditChannel(
  env,
  chatId,
  messageId,
  channelId
) {
  const channel =
    await getChannel(
      env,
      channelId
    );

  if (!channel) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Channel tidak ditemukan.",
      [
        [
          {
            text: "◀️ KEMBALI",
            callback_data:
              "admin:channel",
          },
        ],
      ]
    );
  }

  await saveState(
    env,
    chatId,
    {
      type: "EDIT_CHANNEL",
      channel_id:
        Number(channel.id),
      message_id:
        messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT CHANNEL

📢 ${channel.name || "Channel VIP"}

🆔 ${channel.channel_id}

Kirim Channel ID baru.

Contoh:
-1001234567890`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:channel:view:${channel.id}`,
        },
      ],
    ]
  );
}


export async function handleChannelInput(
  env,
  message,
  state
) {
  const value =
    message.text?.trim();

  if (!value) {
    return true;
  }

  if (
    state.type ===
    "EDIT_CHANNEL"
  ) {
    return handleEditChannelInput(
      env,
      message,
      state,
      value
    );
  }

  if (!/^-100[0-9]+$/.test(value)) {
    await sendMessage(
      env,
      message.chat.id,
`❌ Channel ID tidak valid.

Contoh:
-1001234567890`
    );

    return true;
  }

  const channelId =
    Number(value);

  const chat =
    await telegramRequest(
      env,
      "getChat",
      {
        chat_id: channelId,
      }
    );

  if (!chat || !chat.ok) {
    await sendMessage(
      env,
      message.chat.id,
`❌ Channel tidak ditemukan.

Pastikan Channel ID benar dan LeoBot sudah menjadi admin channel.`
    );

    return true;
  }

  if (
    !chat.result ||
    chat.result.type !== "channel"
  ) {
    await sendMessage(
      env,
      message.chat.id,
      "❌ ID tersebut bukan channel Telegram."
    );

    return true;
  }

  const me =
    await telegramRequest(
      env,
      "getMe",
      {}
    );

  if (!me || !me.ok) {
    await sendMessage(
      env,
      message.chat.id,
      "❌ Gagal membaca data bot."
    );

    return true;
  }

  const member =
    await telegramRequest(
      env,
      "getChatMember",
      {
        chat_id: channelId,
        user_id:
          me.result.id,
      }
    );

  if (
    !member ||
    !member.ok
  ) {
    await sendMessage(
      env,
      message.chat.id,
`❌ Gagal memeriksa status LeoBot.

Pastikan LeoBot sudah menjadi admin channel.`
    );

    return true;
  }

  const status =
    member.result.status;

  if (
    status !== "administrator" &&
    status !== "creator"
  ) {
    await sendMessage(
      env,
      message.chat.id,
`❌ LeoBot bukan admin channel.

Tambahkan LeoBot sebagai admin terlebih dahulu.`
    );

    return true;
  }

  const existing =
    await supabase(
      env,
      `vip_channels?channel_id=eq.${channelId}&limit=1`
    );

  if (
    existing &&
    existing.length > 0
  ) {
    await deleteState(
      env,
      message.from.id
    );

    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    );

    return editMessage(
      env,
      message.chat.id,
      state.message_id,
`⚠️ CHANNEL SUDAH TERDAFTAR

📢 ${existing[0].name || "Channel VIP"}

🆔 ${existing[0].channel_id}`,
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
            text: "◀️ ADMIN",
            callback_data:
              "admin:menu",
          },
        ],
      ]
    );
  }

  const created =
    await supabase(
      env,
      "vip_channels",
      "POST",
      {
        channel_id:
          channelId,
        name:
          chat.result.title ||
          "Channel VIP",
        is_active: true,
        created_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      }
    );

  if (!created) {
    await sendMessage(
      env,
      message.chat.id,
      "❌ Gagal menyimpan channel."
    );

    return true;
  }

  const saved =
    await supabase(
      env,
      `vip_channels?channel_id=eq.${channelId}&limit=1`
    );

  if (
    !saved ||
    saved.length === 0
  ) {
    await sendMessage(
      env,
      message.chat.id,
      "❌ Channel gagal disimpan."
    );

    return true;
  }

  await deleteState(
    env,
    message.from.id
  );

  await deleteMessage(
    env,
    message.chat.id,
    message.message_id
  );

  return editMessage(
    env,
    message.chat.id,
    state.message_id,
`✅ CHANNEL TERSIMPAN

📢 ${saved[0].name || "Channel VIP"}

🆔 ${saved[0].channel_id}`,
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
          text: "◀️ ADMIN",
          callback_data:
            "admin:menu",
        },
      ],
    ]
  );
}


async function handleEditChannelInput(
  env,
  message,
  state,
  value
) {
  if (!/^-100[0-9]+$/.test(value)) {
    await sendMessage(
      env,
      message.chat.id,
`❌ Channel ID tidak valid.

Contoh:
-1001234567890`
    );

    return true;
  }

  const newChannelId =
    Number(value);

  const oldChannel =
    await getChannel(
      env,
      state.channel_id
    );

  if (!oldChannel) {
    await deleteState(
      env,
      message.from.id
    );

    return editMessage(
      env,
      message.chat.id,
      state.message_id,
      "❌ Channel lama tidak ditemukan.",
      [
        [
          {
            text: "📢 CHANNEL VIP",
            callback_data:
              "admin:channel",
          },
        ],
      ]
    );
  }

  if (
    newChannelId ===
    Number(oldChannel.channel_id)
  ) {
    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    ).catch(() => {});

    await deleteState(
      env,
      message.from.id
    );

    return showChannelDetail(
      env,
      message.chat.id,
      state.message_id,
      state.channel_id
    );
  }

  const existing =
    await supabase(
      env,
      `vip_channels?channel_id=eq.${newChannelId}&limit=1`
    );

  if (
    existing &&
    existing.length > 0
  ) {
    await sendMessage(
      env,
      message.chat.id,
`❌ Channel tersebut sudah terhubung.

📢 ${existing[0].name || "Channel VIP"}

🆔 ${existing[0].channel_id}`
    );

    return true;
  }

  const chat =
    await telegramRequest(
      env,
      "getChat",
      {
        chat_id:
          newChannelId,
      }
    );

  if (
    !chat ||
    !chat.ok ||
    !chat.result ||
    chat.result.type !== "channel"
  ) {
    await sendMessage(
      env,
      message.chat.id,
`❌ Channel tidak ditemukan.

Pastikan Channel ID benar dan LeoBot sudah menjadi admin channel.`
    );

    return true;
  }

  const me =
    await telegramRequest(
      env,
      "getMe",
      {}
    );

  if (!me || !me.ok) {
    await sendMessage(
      env,
      message.chat.id,
      "❌ Gagal membaca data bot."
    );

    return true;
  }

  const member =
    await telegramRequest(
      env,
      "getChatMember",
      {
        chat_id:
          newChannelId,
        user_id:
          me.result.id,
      }
    );

  if (
    !member ||
    !member.ok ||
    (
      member.result.status !==
        "administrator" &&
      member.result.status !==
        "creator"
    )
  ) {
    await sendMessage(
      env,
      message.chat.id,
`❌ LeoBot bukan admin channel.

Tambahkan LeoBot sebagai admin terlebih dahulu.`
    );

    return true;
  }

  const updated =
    await supabase(
      env,
      `vip_channels?id=eq.${state.channel_id}`,
      "PATCH",
      {
        channel_id:
          newChannelId,
        name:
          chat.result.title ||
          "Channel VIP",
        updated_at:
          new Date().toISOString(),
      }
    );

  if (!updated) {
    await sendMessage(
      env,
      message.chat.id,
      "❌ Gagal mengganti channel."
    );

    return true;
  }

  await deleteState(
    env,
    message.from.id
  );

  await deleteMessage(
    env,
    message.chat.id,
    message.message_id
  ).catch(() => {});

  return editMessage(
    env,
    message.chat.id,
    state.message_id,
`✅ CHANNEL BERHASIL DIGANTI

📢 ${chat.result.title || "Channel VIP"}

🆔 ${newChannelId}`,
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
          text: "◀️ ADMIN",
          callback_data:
            "admin:menu",
        },
      ],
    ]
  );
}


export async function confirmDeleteChannel(
  env,
  chatId,
  messageId,
  channelId
) {
  const channel =
    await getChannel(
      env,
      channelId
    );

  if (!channel) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Channel tidak ditemukan.",
      [
        [
          {
            text: "◀️ KEMBALI",
            callback_data:
              "admin:channel",
          },
        ],
      ]
    );
  }

  return editMessage(
    env,
    chatId,
    messageId,
`🗑️ HAPUS CHANNEL

📢 ${channel.name || "Channel VIP"}

🆔 ${channel.channel_id}

Channel ini akan dihapus dari daftar channel terhubung.`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:channel:view:${channel.id}`,
        },
      ],
      [
        {
          text: "🗑️ HAPUS",
          callback_data:
            `admin:channel:delete-confirm:${channel.id}`,
        },
      ],
    ]
  );
}


export async function deleteChannel(
  env,
  chatId,
  messageId,
  channelId
) {
  const channel =
    await getChannel(
      env,
      channelId
    );

  if (!channel) {
    return showChannelMenu(
      env,
      chatId,
      messageId
    );
  }

  /*
   * Hapus hubungan channel dengan produk
   * terlebih dahulu.
   */
  await supabase(
    env,
    `product_channels?channel_id=eq.${channelId}`,
    "DELETE"
  );

  /*
   * Setelah tidak ada relasi,
   * hapus channel terhubung.
   */
  await supabase(
    env,
    `vip_channels?id=eq.${channelId}`,
    "DELETE"
  );

  await deleteState(
    env,
    chatId
  );

  return showChannelMenu(
    env,
    chatId,
    messageId
  );
}


async function getChannel(
  env,
  channelId
) {
  const rows =
    await supabase(
      env,
      `vip_channels?id=eq.${channelId}&limit=1`
    );

  return rows?.[0] || null;
}


async function getChannels(
  env
) {
  return (
    await supabase(
      env,
      "vip_channels?order=id.asc"
    )
  ) || [];
}


async function telegramRequest(
  env,
  method,
  body
) {
  const response =
    await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body:
          JSON.stringify(body),
      }
    );

  return response.json();
    }
