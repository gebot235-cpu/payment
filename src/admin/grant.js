import {
  editMessage,
  sendMessage,
} from "../telegram.js";

import {
  supabase,
} from "../supabase.js";

import {
  saveState,
  deleteState,
} from "../state.js";

import {
  createVipInviteLinks,
} from "../fulfillment.js";

import {
  showProductEdit,
} from "./products.js";

/*
 * Fitur baru: admin bisa memberikan akses VIP ke user tertentu
 * tanpa harus lewat pembayaran — cukup masukkan Telegram ID
 * user-nya, sistem otomatis buatkan invite link untuk SEMUA
 * channel yang terhubung ke produk itu, dengan masa aktif
 * mengikuti durasi produknya (termasuk "Selamanya" kalau
 * produknya memang lifetime).
 *
 * Memakai mekanisme yang SAMA dengan pembelian normal (baris
 * vip_memberships dibuat dengan joined_at/expires_at masih NULL,
 * baru terisi saat user benar-benar join channel) — supaya cron
 * reminder & auto-kick tetap bekerja konsisten tanpa perlu kasus
 * khusus.
 */

export async function startGrantVip(
  env,
  chatId,
  messageId,
  productId
) {
  const product =
    (
      await supabase(
        env,
        `products?id=eq.${Number(productId)}&limit=1`
      )
    )?.[0];

  if (!product || product.type !== "VIP") {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type: "GRANT_VIP",
      product_id: Number(productId),
      message_id: messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`🎁 BERIKAN AKSES VIP

Produk:
${product.name}
${
      product.duration_days
        ? `⏳ Masa aktif: ${product.duration_days} hari`
        : "⏳ Masa aktif: ♾️ Selamanya"
    }

Kirim Telegram User ID target (angka saja).

Catatan: user itu harus SUDAH PERNAH mengirim /start ke bot ini minimal sekali, kalau tidak bot tidak bisa kirim pesan ke mereka (batasan Telegram, bukan bug).`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data: `admin:product:grant:cancel:${product.id}`,
        },
      ],
    ]
  );
}

export async function cancelGrantVip(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(env, chatId);

  return showProductEdit(
    env,
    chatId,
    messageId,
    productId
  );
}

export async function handleGrantVipInput(
  env,
  message,
  state
) {
  const raw =
    (message.text || "").trim();

  if (!/^\d+$/.test(raw)) {
    await editMessage(
      env,
      message.chat.id,
      state.message_id,
`❌ User ID tidak valid.

Kirim angka Telegram User ID saja, contoh: 123456789`,
      [
        [
          {
            text: "❌ BATAL",
            callback_data: `admin:product:grant:cancel:${state.product_id}`,
          },
        ],
      ]
    );

    return true;
  }

  const targetTelegramId =
    Number(raw);

  const product =
    (
      await supabase(
        env,
        `products?id=eq.${Number(state.product_id)}&limit=1`
      )
    )?.[0];

  if (!product || product.type !== "VIP") {
    await deleteState(env, message.chat.id);

    return editMessage(
      env,
      message.chat.id,
      state.message_id,
      "❌ Produk tidak ditemukan atau bukan produk VIP."
    );
  }

  await editMessage(
    env,
    message.chat.id,
    state.message_id,
    "⏳ Membuat invite link..."
  );

  let links = [];
  let failedChannels = [];

  try {
    const result =
      await createVipInviteLinks(
        env,
        product,
        {
          telegramId: targetTelegramId,
          orderId: null,
          linkNamePrefix:
            `manual-${Date.now()}`,
        }
      );

    links = result.links;
    failedChannels = result.failedChannels;
  } catch (error) {
    console.error(
      `Gagal memberikan akses VIP manual ke ${targetTelegramId}:`,
      error
    );

    await deleteState(env, message.chat.id);

    return editMessage(
      env,
      message.chat.id,
      state.message_id,
`❌ Gagal membuat invite link.

${error.message || error}`,
      [
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

  await deleteState(
    env,
    message.chat.id
  );

  if (!links.length) {
    return editMessage(
      env,
      message.chat.id,
      state.message_id,
`❌ Semua channel gagal dibuatkan invite link.

Channel bermasalah: ${failedChannels.join(", ")}

Biasanya karena bot belum dijadikan admin di channel tersebut.`,
      [
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

  const linksText =
    links
      .map(
        (link) => `• ${link.name}: ${link.url}`
      )
      .join("\n");

  const inlineKeyboard =
    links.map((link) => [
      {
        text: "🚀 MASUK CHANNEL",
        url: link.url,
      },
    ]);

  const durationText =
    product.duration_days
      ? `⏳ Masa aktif: ${product.duration_days} hari (dihitung sejak kamu join)`
      : `⏳ Masa aktif: ♾️ Selamanya`;

  let dmFailed = false;

  try {
    await sendMessage(
      env,
      targetTelegramId,
      `🎁 Kamu mendapatkan akses VIP!\n\n` +
        `📦 ${product.name}\n` +
        `${durationText}\n\n` +
        `🔗 Link akses (sekali pakai):\n${linksText}`,
      inlineKeyboard
    );
  } catch (error) {
    console.error(
      `Gagal kirim DM akses VIP manual ke ${targetTelegramId}:`,
      error
    );

    dmFailed = true;
  }

  return editMessage(
    env,
    message.chat.id,
    state.message_id,
`✅ AKSES VIP DIBERIKAN

User: ${targetTelegramId}
Produk: ${product.name}
${durationText}

${
      dmFailed
        ? `⚠️ Gagal mengirim pesan ke user (kemungkinan mereka belum pernah /start bot ini). Kirim manual link di bawah:\n\n${linksText}`
        : "✅ Pesan + link berhasil dikirim ke user."
    }
${
      failedChannels.length
        ? `\n\n⚠️ ${failedChannels.length} channel gagal diproses: ${failedChannels.join(", ")}`
        : ""
    }`,
    [
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
