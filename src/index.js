import {
  sendMessage,
  editMessage,
  answerCallback,
} from "./telegram.js";

import {
  isAdmin,
  showAdminMenu,
  sendAdminMenu,
} from "./admin/menu.js";

import {
  showChannelMenu,
  showChannelDetail,
  startAddChannel,
  startEditChannel,
  confirmDeleteChannel,
  deleteChannel,
  handleChannelInput,
} from "./admin/channel.js";

import {
  showMessageMenu,
  showMessageEditor,
  startMessageEdit,
  handleMessageInput,
  restoreDefault,
  getState,
} from "./admin/messages.js";

import {
  showAdminProducts,
  showProductList,
  showProductDetail,
  showProductEdit,
  startProductFieldEdit,
  handleProductInput,
  startAddProduct,
  selectAddProductType,
  handleAddProductInput,
  skipDescription,
  toggleProductChannel,
  saveProductChannels,
  saveNewProduct,
  showProductChannels,
  toggleEditProductChannel,
  saveEditProductChannels,
  toggleProduct,
  confirmDeleteProduct,
  deleteProduct,
  cancelProductProcess,
  cancelEditProductChannels,
  setLifetimeDuration,
  setLifetimeDurationForExisting,
} from "./admin/products.js";

import {
  startGrantVip,
  cancelGrantVip,
  handleGrantVipInput,
} from "./admin/grant.js";

import {
  showDigitalProduct,
  showDigitalEdit,
  startDigitalFieldEdit,
  handleDigitalFieldInput,
  startDigitalFileEdit,
  handleDigitalFileInput,
  cancelDigitalProcess,
  confirmDeleteDigital,
  deleteDigitalProduct,
} from "./admin/digital.js";

import {
  showPaymentMenu,
  startPaymentSetting,
  handlePaymentSettingInput,
  cancelPaymentSetting,
  savePaymentSetting,
  showPaymentConfig,
  togglePayment,
  createPayment,
  sendPaymentQr,
  confirmClearPaymentSetting,
  clearPaymentSetting,
  toggleFeeBorneBy,
} from "./payment.js";

import {
  showMainMenu,
  showProductCategory,
  showProduct,
  showCsContact,
} from "./user/menu.js";

import {
  supabase,
} from "./supabase.js";

import {
  runCronTasks,
} from "./cron.js";

import {
  showSettingsMenu,
  showPriceFormatMenu,
  setPriceSeparator,
  showButtonLabelsMenu,
  startFieldEdit,
  handleFieldInput as handleSettingFieldInput,
  cancelFieldEdit,
  resetField,
} from "./admin/settings.js";

import {
  getShopSettings,
  formatPriceDigits,
} from "./settings.js";

import {
  showStats,
} from "./admin/stats.js";

import {
  deleteState as deleteAdminState,
} from "./state.js";

export default {
  async fetch(request, env) {
    if (
      request.method === "POST" &&
      new URL(request.url).pathname === "/webhook/buatqris"
    ) {
      const {
        handleBuatQrisWebhook,
      } = await import("./payment.js");

      return handleBuatQrisWebhook(
        env,
        request
      );
    }

    if (request.method !== "POST") {
      return new Response("OK");
    }

    let update;

    try {
      update = await request.json();
    } catch {
      return new Response("Bad Request", {
        status: 400,
      });
    }

    try {
      if (update.callback_query) {
        await handleCallback(
          env,
          update.callback_query
        );
      } else if (update.message) {
        await handleMessage(
          env,
          update.message
        );
      } else if (update.chat_member) {
        await handleChatMemberUpdate(
          env,
          update.chat_member
        );
      }
    } catch (error) {
      console.error(error);
    }

    return new Response("OK");
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runCronTasks(env).catch((error) => {
        console.error("Cron gagal jalan:", error);
      })
    );
  },
};

async function handleChatMemberUpdate(env, update) {
  const chatId =
    update?.chat?.id;

  const userId =
    update?.new_chat_member?.user?.id;

  const newStatus =
    update?.new_chat_member?.status;

  const oldStatus =
    update?.old_chat_member?.status;

  if (
    chatId === undefined ||
    chatId === null ||
    userId === undefined ||
    userId === null
  ) {
    return;
  }

  const joined =
    (
      newStatus === "member" ||
      newStatus === "administrator"
    ) &&
    oldStatus !== "member" &&
    oldStatus !== "administrator";

  if (!joined) {
    return;
  }

  const telegramId =
    Number(userId);

  const channelId =
    Number(chatId);

  if (
    !Number.isSafeInteger(telegramId) ||
    !Number.isSafeInteger(channelId)
  ) {
    return;
  }

  const memberships =
    await supabase(
      env,
      `vip_memberships?telegram_id=eq.${telegramId}&channel_id=eq.${channelId}&joined_at=is.null&expires_at=is.null&order=id.desc`
    );

  if (!Array.isArray(memberships) || !memberships.length) {
    return;
  }

  const activated = [];

  for (const membership of memberships) {
    const membershipId =
      Number(membership?.id);

    const productId =
      Number(membership?.product_id);

    const orderId =
      Number(membership?.order_id);

    if (
      !Number.isSafeInteger(membershipId) ||
      membershipId <= 0
    ) {
      continue;
    }

    if (
      !Number.isSafeInteger(productId) ||
      productId <= 0
    ) {
      console.error(
        "Membership VIP tidak memiliki product_id yang valid:",
        membershipId
      );

      continue;
    }

    const product =
      await getProduct(
        env,
        productId
      );

    if (!product) {
      console.error(
        `Produk #${productId} tidak ditemukan untuk membership #${membershipId}`
      );

      continue;
    }

    const isLifetime =
      product.duration_days === null ||
      product.duration_days === undefined;

    let durationDays = null;

    if (!isLifetime) {
      durationDays =
        Number(product.duration_days);

      if (
        !Number.isFinite(durationDays) ||
        durationDays <= 0
      ) {
        console.error(
          `duration_days tidak valid untuk produk #${productId}`
        );

        continue;
      }
    }

    const joinedAt =
      new Date();

    const expiresAt =
      isLifetime
        ? null
        : new Date(
            joinedAt.getTime() +
              durationDays *
                24 *
                60 *
                60 *
                1000
          );

    const updated =
      await supabase(
        env,
        `vip_memberships?id=eq.${membershipId}&telegram_id=eq.${telegramId}&channel_id=eq.${channelId}&joined_at=is.null&expires_at=is.null`,
        "PATCH",
        {
          joined_at:
            joinedAt.toISOString(),
          expires_at:
            expiresAt
              ? expiresAt.toISOString()
              : null,
        }
      );

    if (
      !Array.isArray(updated) &&
      updated !== undefined &&
      updated !== null
    ) {
      console.error(
        `Gagal mengaktifkan membership #${membershipId}`
      );

      continue;
    }

    activated.push({
      membershipId,
      orderId:
        Number.isSafeInteger(orderId)
          ? orderId
          : null,
      productName:
        product.name || "VIP",
      durationDays,
      expiresAt,
      isLifetime,
    });
  }

  if (!activated.length) {
    return;
  }

  for (const item of activated) {
    try {
      await sendMessage(
        env,
        telegramId,
        `✅ VIP berhasil diaktifkan!\n\n` +
          `📦 ${item.productName}\n` +
          (
            item.isLifetime
              ? `📅 Masa aktif: ♾️ Selamanya (tanpa batas)`
              : `📅 Masa aktif: ${item.durationDays} hari\n` +
                `⏰ Berlaku sampai: ${formatDateId(item.expiresAt)}`
          )
      );
    } catch (error) {
      console.error(
        `Gagal mengirim notifikasi VIP untuk membership #${item.membershipId}:`,
        error
      );
    }

    console.log(
      `VIP aktif: user=${telegramId}, channel=${channelId}, membership=${item.membershipId}, order=${item.orderId ?? "-"}, expires=${item.isLifetime ? "selamanya" : item.expiresAt.toISOString()}`
    );
  }
}

function formatDateId(date) {
  return date.toLocaleDateString(
    "id-ID",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
}

async function handleMessage(
  env,
  message
) {
  const chatId =
    message.chat?.id;

  const text =
    message.text?.trim();

  if (!chatId) {
    return;
  }

  if (text === "/admin") {
    if (!(await isAdmin(env, chatId))) {
      await sendMessage(
        env,
        chatId,
        "❌ Kamu bukan admin."
      );

      return;
    }

    await deleteAdminState(
      env,
      chatId
    );

    await sendAdminMenu(
      env,
      chatId
    );

    return;
  }

  const state =
    await getState(
      env,
      chatId
    );

  if (!state) {
    if (text === "/start") {
      await showMainMenu(
        env,
        chatId,
        null,
        message.from?.first_name || ""
      );
    }

    return;
  }

  if (
    text &&
    text.startsWith("/")
  ) {
    return;
  }

  if (
    state.type ===
    "EDIT_PRODUCT"
  ) {
    await handleProductInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "ADD_PRODUCT"
  ) {
    await handleAddProductInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "ADD_DIGITAL_FILE"
  ) {
    await handleDigitalFileInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "EDIT_DIGITAL"
  ) {
    await handleDigitalFieldInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "EDIT_DIGITAL_FILE"
  ) {
    await handleDigitalFileInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "PAYMENT_SETTING"
  ) {
    await handlePaymentSettingInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "ADD_CHANNEL" ||
    state.type ===
    "EDIT_CHANNEL"
  ) {
    await handleChannelInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "EDIT_MESSAGE"
  ) {
    await handleMessageInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "EDIT_SETTING"
  ) {
    await handleSettingFieldInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "GRANT_VIP"
  ) {
    await handleGrantVipInput(
      env,
      message,
      state
    );

    return;
  }
}

async function handleCallback(
  env,
  callback
) {
  const data =
    callback.data || "";

  const message =
    callback.message;

  const chatId =
    message?.chat?.id;

  const messageId =
    message?.message_id;

  try {
    await answerCallback(
      env,
      callback.id
    );
  } catch {}

  if (
    !chatId ||
    !messageId
  ) {
    return;
  }

  if (
  data ===
  "user:menu"
) {
  await showMainMenu(
    env,
    chatId,
    messageId,
    callback.from?.first_name || ""
);

  return;
}


/* KATEGORI PRODUK */
if (
  data ===
  "user:category:vip"
) {
  await showProductCategory(
    env,
    chatId,
    messageId,
    "vip"
  );

  return;
}

if (
  data ===
  "user:category:digital"
) {
  await showProductCategory(
    env,
    chatId,
    messageId,
    "digital"
  );

  return;
}

  if (
    data ===
    "user:cs"
  ) {
    await showCsContact(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data.startsWith(
      "product:"
    )
  ) {
    const productId =
      data.split(":")[1];

    await showProduct(
      env,
      chatId,
      messageId,
      productId
    );

    return;
  }

  if (
    data.startsWith(
      "order:create:"
    )
  ) {
    const productId =
      data.split(":")[2];

    const product =
      await getProduct(
        env,
        productId
      );

    if (
      !product ||
      !product.is_active
    ) {
      await editMessage(
        env,
        chatId,
        messageId,
        "❌ Produk tidak tersedia.",
        [
          [
            {
              text: "◀️ KEMBALI",
              callback_data:
                "user:menu",
            },
          ],
        ]
      );

      return;
    }

    try {
      await editMessage(
        env,
        chatId,
        messageId,
        "⏳ Membuat pembayaran..."
      );

      const order =
        await createPayment(
          env,
          chatId,
          product,
          callback.from?.first_name || null
        );

      await sendPaymentQr(
        env,
        chatId,
        order
      );
    } catch (error) {
      console.error(error);

      await editMessage(
        env,
        chatId,
        messageId,
        `❌ ${
          error?.message ||
          "Gagal membuat pembayaran."
        }`,
        [
          [
            {
              text: "◀️ KEMBALI",
              callback_data:
                `product:${productId}`,
            },
          ],
        ]
      );
    }

    return;
  }

  if (
    !data.startsWith(
      "admin:"
    )
  ) {
    return;
  }

  if (
    !(await isAdmin(
      env,
      chatId
    ))
  ) {
    return;
  }

  const parts =
    data.split(":");

  if (
    data ===
    "admin:menu"
  ) {
    await deleteAdminState(
      env,
      chatId
    );

    await showAdminMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:payment"
  ) {
    await showPaymentMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:payment:config"
  ) {
    await showPaymentConfig(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:payment:toggle"
  ) {
    await togglePayment(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "payment" &&
    parts[2] === "setting" &&
    parts[3] === "clear" &&
    parts[4] === "confirm"
  ) {
    await clearPaymentSetting(
      env,
      chatId,
      messageId,
      parts[5]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "payment" &&
    parts[2] === "setting" &&
    parts[3] === "clear"
  ) {
    await confirmClearPaymentSetting(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "payment" &&
    parts[2] === "setting"
  ) {
    await startPaymentSetting(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    data ===
    "admin:payment:fee:toggle"
  ) {
    await toggleFeeBorneBy(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:payment:save"
  ) {
    await savePaymentSetting(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:payment:cancel"
  ) {
    await cancelPaymentSetting(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:products"
  ) {
    await showAdminProducts(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:product:list"
  ) {
    await showProductList(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:product:add"
  ) {
    await startAddProduct(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "add" &&
    parts[3] === "type"
  ) {
    await selectAddProductType(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    data ===
    "admin:product:add:skip:description"
  ) {
    await skipDescription(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:product:add:save"
  ) {
    await saveNewProduct(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:product:duration:lifetime"
  ) {
    await setLifetimeDuration(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "duration" &&
    parts[3] === "lifetime"
  ) {
    await setLifetimeDurationForExisting(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "grant" &&
    parts[3] === "cancel"
  ) {
    await cancelGrantVip(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "grant"
  ) {
    await startGrantVip(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "view"
  ) {
    const productId =
      parts[3];

    const product =
      await getProduct(
        env,
        productId
      );

    if (
      product?.type ===
      "DIGITAL"
    ) {
      await showDigitalProduct(
        env,
        chatId,
        messageId,
        productId
      );
    } else {
      await showProductDetail(
        env,
        chatId,
        messageId,
        productId
      );
    }

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "digital" &&
    parts[2] === "view"
  ) {
    await showDigitalProduct(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "digital" &&
    parts[2] === "edit"
  ) {
    await showDigitalEdit(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "digital" &&
    parts[2] === "field"
  ) {
    await startDigitalFieldEdit(
      env,
      chatId,
      messageId,
      parts[4],
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "digital" &&
    parts[2] === "file"
  ) {
    await startDigitalFileEdit(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "digital" &&
    parts[2] === "cancel"
  ) {
    await cancelDigitalProcess(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "digital" &&
    parts[2] === "delete"
  ) {
    await confirmDeleteDigital(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "digital" &&
    parts[2] === "delete-confirm"
  ) {
    await deleteDigitalProduct(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "edit"
  ) {
    await showProductEdit(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "field"
  ) {
    await startProductFieldEdit(
      env,
      chatId,
      messageId,
      parts[4],
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "toggle"
  ) {
    await toggleProduct(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "delete" &&
    parts[3] !== "confirm"
  ) {
    await confirmDeleteProduct(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "delete-confirm"
  ) {
    await deleteProduct(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "cancel"
  ) {
    await cancelProductProcess(
      env,
      chatId,
      messageId,
      parts[3] || null
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "channel" &&
    parts[3] === "toggle"
  ) {
    await toggleProductChannel(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    data ===
    "admin:product:channels:save"
  ) {
    await saveProductChannels(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "channels"
  ) {
    await showProductChannels(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "editchannel" &&
    parts[3] === "toggle"
  ) {
    await toggleEditProductChannel(
      env,
      chatId,
      messageId,
      parts[4],
      parts[5]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "editchannel" &&
    parts[3] === "save"
  ) {
    await saveEditProductChannels(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "editchannel" &&
    parts[3] === "cancel"
  ) {
    await cancelEditProductChannels(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    data ===
    "admin:channel"
  ) {
    await deleteAdminState(
      env,
      chatId
    );

    await showChannelMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:channel:add"
  ) {
    await startAddChannel(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "channel" &&
    parts[2] === "view"
  ) {
    await deleteAdminState(
      env,
      chatId
    );

    await showChannelDetail(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "channel" &&
    parts[2] === "edit"
  ) {
    await startEditChannel(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "channel" &&
    parts[2] === "delete" &&
    parts[3] !== "confirm"
  ) {
    await confirmDeleteChannel(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "channel" &&
    parts[2] === "delete-confirm"
  ) {
    await deleteChannel(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    data ===
    "admin:messages"
  ) {
    await showMessageMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "message" &&
    parts[2] === "cancel"
  ) {
    await deleteAdminState(
      env,
      chatId
    );

    const type =
      parts[3];

    if (type) {
      await showMessageEditor(
        env,
        chatId,
        messageId,
        type
      );
    } else {
      await showMessageMenu(
        env,
        chatId,
        messageId
      );
    }

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "message" &&
    parts[2] === "edit"
  ) {
    await startMessageEdit(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "message" &&
    parts[2] === "default"
  ) {
    await restoreDefault(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "message" &&
    parts.length === 3
  ) {
    await showMessageEditor(
      env,
      chatId,
      messageId,
      parts[2]
    );

    return;
  }

  if (
    data ===
    "admin:settings"
  ) {
    await showSettingsMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:stats"
  ) {
    await showStats(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:setting:price"
  ) {
    await showPriceFormatMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "setting" &&
    parts[2] === "price" &&
    parts[3] === "sep"
  ) {
    await setPriceSeparator(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    data ===
    "admin:setting:buttons"
  ) {
    await showButtonLabelsMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "setting" &&
    parts[2] === "field"
  ) {
    await startFieldEdit(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "setting" &&
    parts[2] === "cancel"
  ) {
    await cancelFieldEdit(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "setting" &&
    parts[2] === "reset"
  ) {
    await resetField(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }
}

async function getProduct(
  env,
  productId
) {
  const id =
    Number(productId);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  const rows =
    await supabase(
      env,
      `products?id=eq.${id}&limit=1`
    );

  return rows?.[0] || null;
}
