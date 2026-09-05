import {
  sendMessage,
  sendPhoto,
  editMessage,
} from "../telegram.js";

import {
  getActiveProducts,
  getProduct,
} from "../products/products.js";

import {
  getShopSettings,
  formatPriceDigits,
} from "../settings.js";

import {
  getMessage,
} from "../admin/messages.js";

import {
  supabase,
} from "../supabase.js";

async function hasActiveVipChannel(
  env,
  productId
) {
  const productChannels =
    await supabase(
      env,
      `product_channels?product_id=eq.${Number(
        productId
      )}`
    );

  if (!productChannels?.length) {
    return false;
  }

  const channelIds =
    productChannels
      .map(
        (row) =>
          Number(row.channel_id)
      )
      .filter(
        Number.isSafeInteger
      );

  if (!channelIds.length) {
    return false;
  }

  const channels =
    await supabase(
      env,
      `vip_channels?id=in.(${channelIds.join(
        ","
      )})&is_active=eq.true`
    );

  return Boolean(
    channels?.length
  );
}

export async function showMainMenu(
  env,
  chatId,
  messageId = null,
  firstName = ""
) {
  const [products, settings] =
    await Promise.all([
      getActiveProducts(env),
      getShopSettings(env),
    ]);

  let text = await getMessage(
    env,
    "message_welcome"
  );

  text = String(text || "").replace(
    /\{first_name\}/g,
    firstName
  );

  const buttons = [];

  const vipProducts =
    products.filter(
      (product) =>
        product.type === "VIP"
    );

  let hasVip = false;

  for (
    const product of vipProducts
  ) {
    if (
      await hasActiveVipChannel(
        env,
        product.id
      )
    ) {
      hasVip = true;
      break;
    }
  }

  if (hasVip) {
    buttons.push([
      {
        text:
          "🔐 PRODUK VIP",
        callback_data:
          "user:category:vip",
      },
    ]);
  }

  if (
    products.some(
      (product) =>
        product.type === "DIGITAL"
    )
  ) {
    buttons.push([
      {
        text:
          "📦 PRODUK DIGITAL",
        callback_data:
          "user:category:digital",
      },
    ]);
  }

  if (buttons.length === 0) {
    const emptyText =
`${text}

Saat ini belum ada produk yang tersedia.`;

    if (messageId) {
      return editMessage(
        env,
        chatId,
        messageId,
        emptyText
      );
    }

    return sendMessage(
      env,
      chatId,
      emptyText
    );
  }

  if (messageId) {
    return editMessage(
      env,
      chatId,
      messageId,
      text,
      buttons
    );
  }

  if (settings.welcome_photo) {
    return sendPhoto(
      env,
      chatId,
      settings.welcome_photo,
      text,
      buttons
    );
  }

  return sendMessage(
    env,
    chatId,
    text,
    buttons
  );
}

export async function showProductCategory(
  env,
  chatId,
  messageId,
  type
) {
  const products =
    await getActiveProducts(env);

  const settings =
    await getShopSettings(env);

  const productType =
    type === "vip"
      ? "VIP"
      : "DIGITAL";

  const title =
    productType === "VIP"
      ? "🔐 PRODUK VIP"
      : "📦 PRODUK DIGITAL";

  let filteredProducts =
    products.filter(
      (product) =>
        product.type ===
        productType
    );

  if (productType === "VIP") {
    const availableProducts = [];

    for (
      const product of filteredProducts
    ) {
      if (
        await hasActiveVipChannel(
          env,
          product.id
        )
      ) {
        availableProducts.push(
          product
        );
      }
    }

    filteredProducts =
      availableProducts;
  }

  const buttons =
    filteredProducts.map(
      (product) => [
        {
          text:
            `${
              productType === "VIP"
                ? "🟢"
                : "📦"
            } ${product.name}`,

          callback_data:
            `product:${product.id}`,
        },
      ]
    );

  if (
    filteredProducts.length === 0
  ) {
    buttons.push([
      {
        text:
          settings.btn_back_label,
        callback_data:
          "user:menu",
      },
    ]);

    return editMessage(
      env,
      chatId,
      messageId,
`${title}

Belum ada produk tersedia.`,
      buttons
    );
  }

  buttons.push([
    {
      text:
        settings.btn_back_label,
      callback_data:
        "user:menu",
    },
  ]);

  return editMessage(
    env,
    chatId,
    messageId,
`${title}

Silakan pilih produk:`,
    buttons
  );
}

export async function showCsContact(
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
`📞 KONTAK CS

${
  settings.cs_contact ||
  "Belum ada kontak CS yang diatur."
}`,
    [
      [
        {
          text:
            settings.btn_back_label,
          callback_data:
            "user:menu",
        },
      ],
    ]
  );
}

export async function showProduct(
  env,
  chatId,
  messageId,
  productId
) {
  const [product, settings] =
    await Promise.all([
      getProduct(
        env,
        productId
      ),
      getShopSettings(env),
    ]);

  if (
    !product ||
    !product.is_active
  ) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Produk tidak tersedia.",
      [
        [
          {
            text:
              settings.btn_back_label,
            callback_data:
              "user:menu",
          },
        ],
      ]
    );
  }

  if (
    product.type === "VIP" &&
    !(await hasActiveVipChannel(
      env,
      product.id
    ))
  ) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Produk VIP ini belum tersedia.",
      [
        [
          {
            text:
              settings.btn_back_label,
            callback_data:
              "user:menu",
          },
        ],
      ]
    );
  }

  let text =
    await getMessage(
      env,
      "message_product_detail"
    );

  text = text
    .replaceAll(
      "{product_name}",
      product.name || ""
    )
    .replaceAll(
      "{description}",
      product.description || ""
    )
    .replaceAll(
      "{price}",
      formatPriceDigits(
        product.price,
        settings
      )
    )
    .replaceAll(
      "{duration}",
      product.type === "VIP"
        ? `⏳ Masa aktif: ${
            product.duration_days
              ? `${product.duration_days} hari`
              : "♾️ Selamanya (tanpa batas)"
          }`
        : ""
    );

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    [
      [
        {
          text:
            settings.btn_pay_label,
          callback_data:
            `order:create:${product.id}`,
        },
      ],
      [
        {
          text:
            settings.btn_back_label,
          callback_data:
            "user:menu",
        },
      ],
    ]
  );
}
