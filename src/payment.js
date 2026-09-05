import {
  sendPhoto,
  editMessage,
  deleteMessage,
} from "./telegram.js";

import {
  supabase,
  upsertSetting,
} from "./supabase.js";

import {
  saveState,
  deleteState,
} from "./state.js";

import {
  deliverProduct,
} from "./fulfillment.js";

import {
  encryptSecret,
  decryptSecret,
} from "./crypto.js";

import {
  getMessage,
} from "./admin/messages.js";

const BUATQRIS_API =
  "https://app.buatqris.site/api";

export async function showPaymentMenu(
  env,
  chatId,
  messageId
) {
  const settings =
    await getPaymentSettings(env);

  return editMessage(
    env,
    chatId,
    messageId,
`💳 PEMBAYARAN

Status: ${
      settings.enabled
        ? "🟢 AKTIF"
        : "🔴 NONAKTIF"
    }

QRIS: ${
      settings.qris_method
    }

Mode: ${
      settings.test
        ? "TEST"
        : "LIVE"
    }

Fee: ${settings.fee_percent}% — ditanggung ${
      settings.fee_borne_by === "merchant"
        ? "TOKO"
        : "PEMBELI"
    }`,
    [
      [
        {
          text:
            settings.enabled
              ? "🔴 NONAKTIFKAN"
              : "🟢 AKTIFKAN",
          callback_data:
            "admin:payment:toggle",
        },
      ],
      [
        {
          text:
            "⚙️ ATUR PEMBAYARAN",
          callback_data:
            "admin:payment:config",
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

export async function showPaymentConfig(
  env,
  chatId,
  messageId
) {
  const settings =
    await getPaymentSettings(env);

  return editMessage(
    env,
    chatId,
    messageId,
`⚙️ ATUR PEMBAYARAN

Account ID:
${maskValue(settings.account_id)}

Secret Token:
${
      settings.secret_token
        ? "••••••••"
        : "Belum diatur"
    }

Webhook Secret:
${
      settings.webhook_secret
        ? "••••••••"
        : "Belum diatur"
    }

QRIS Method:
${settings.qris_method}

Mode:
${settings.test ? "TEST" : "LIVE"}

Fee:
${settings.fee_percent}% — ditanggung ${
      settings.fee_borne_by === "merchant"
        ? "TOKO"
        : "PEMBELI"
    }`,
    [
      [
        {
          text: "🔑 ACCOUNT ID",
          callback_data:
            "admin:payment:setting:account_id",
        },
      ],
      [
        {
          text: "🔐 SECRET TOKEN",
          callback_data:
            "admin:payment:setting:secret_token",
        },
      ],
      [
        {
          text: "🛡️ WEBHOOK SECRET",
          callback_data:
            "admin:payment:setting:webhook_secret",
        },
      ],
      [
        {
          text: "📊 FEE",
          callback_data:
            "admin:payment:setting:fee",
        },
      ],
      [
        {
          text: "🔄 QRIS METHOD",
          callback_data:
            "admin:payment:setting:qris_method",
        },
      ],
      [
        {
          text: settings.test
            ? "🟢 LIVE MODE"
            : "🧪 TEST MODE",
          callback_data:
            "admin:payment:setting:test",
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:payment",
        },
      ],
    ]
  );
}

export async function showFeeMenu(
  env,
  chatId,
  messageId
) {
  const settings =
    await getPaymentSettings(env);

  const example =
    5000;

  const exampleFee =
    Math.round(
      example *
        Number(
          settings.fee_percent || 0
        ) /
        100
    );

  return editMessage(
    env,
    chatId,
    messageId,
`📊 ATUR FEE

Persentase fee: ${settings.fee_percent}%
Ditanggung: ${
      settings.fee_borne_by === "merchant"
        ? "🏪 TOKO (kamu)"
        : "🙋 PEMBELI"
    }

Contoh untuk produk Rp${example.toLocaleString("id-ID")}:
${
      settings.fee_borne_by === "merchant"
        ? `Customer bayar: Rp${example.toLocaleString("id-ID")} (kamu terima setelah dipotong fee ±Rp${exampleFee.toLocaleString("id-ID")})`
        : `Customer bayar: Rp${(example + exampleFee).toLocaleString("id-ID")} (kamu tetap terima penuh Rp${example.toLocaleString("id-ID")})`
    }`,
    [
      [
        {
          text: "✏️ UBAH PERSENTASE",
          callback_data:
            "admin:payment:setting:fee_percent",
        },
      ],
      [
        {
          text:
            settings.fee_borne_by === "merchant"
              ? "🔄 GANTI: DITANGGUNG PEMBELI"
              : "🔄 GANTI: DITANGGUNG TOKO",
          callback_data:
            "admin:payment:fee:toggle",
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:payment:config",
        },
      ],
    ]
  );
}

export async function toggleFeeBorneBy(
  env,
  chatId,
  messageId
) {
  const settings =
    await getPaymentSettings(env);

  await setSetting(
    env,
    "payment_fee_borne_by",
    settings.fee_borne_by === "merchant"
      ? "buyer"
      : "merchant"
  );

  return showFeeMenu(
    env,
    chatId,
    messageId
  );
}

export async function startPaymentSetting(
  env,
  chatId,
  messageId,
  field
) {
  const settings =
    await getPaymentSettings(env);

  if (
    field === "test"
  ) {
    await setSetting(
      env,
      "payment_test",
      settings.test
        ? "0"
        : "1"
    );

    return showPaymentConfig(
      env,
      chatId,
      messageId
    );
  }

  if (
    field === "qris_method"
  ) {
    const method =
      settings.qris_method ===
      "qris_two"
        ? "qris_one"
        : "qris_two";

    await setSetting(
      env,
      "payment_qris_method",
      method
    );

    return showPaymentConfig(
      env,
      chatId,
      messageId
    );
  }

  if (
    field === "fee"
  ) {
    return showFeeMenu(
      env,
      chatId,
      messageId
    );
  }

  if (
    field === "fee_percent"
  ) {
    await saveState(
      env,
      chatId,
      {
        type:
          "PAYMENT_SETTING",
        field:
          "fee_percent",
        message_id:
          messageId,
      }
    );

    return editMessage(
      env,
      chatId,
      messageId,
`📊 PERSENTASE FEE

Fee saat ini: ${settings.fee_percent}%

Kirim angka persentase fee gateway pembayaran kamu (misalnya QRIS biasanya sekitar 0.7). Kirim tanpa tanda "%".`,
      [
        [
          {
            text: "❌ BATAL",
            callback_data:
              "admin:payment:cancel",
          },
        ],
      ]
    );
  }

  const labels = {
    account_id:
      "ACCOUNT ID",
    secret_token:
      "SECRET TOKEN",
    webhook_secret:
      "WEBHOOK SECRET",
  };

  if (
    !labels[field]
  ) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type:
        "PAYMENT_SETTING",
      field,
      message_id:
        messageId,
    }
  );

  const currentlySet =
    field === "account_id"
      ? Boolean(
          settings.account_id
        )
      : field ===
        "secret_token"
      ? Boolean(
          settings.secret_token
        )
      : Boolean(
          settings.webhook_secret
        );

  const buttons = [
    [
      {
        text: "❌ BATAL",
        callback_data:
          "admin:payment:cancel",
      },
    ],
  ];

  if (
    currentlySet
  ) {
    buttons.unshift([
      {
        text: "🗑️ HAPUS NILAI INI",
        callback_data:
          `admin:payment:setting:clear:${field}`,
      },
    ]);
  }

  return editMessage(
    env,
    chatId,
    messageId,
`🔐 ${labels[field]}

Kirim nilai baru:`,
    buttons
  );
}

export async function confirmClearPaymentSetting(
  env,
  chatId,
  messageId,
  field
) {
  const labels = {
    account_id:
      "ACCOUNT ID",
    secret_token:
      "SECRET TOKEN",
    webhook_secret:
      "WEBHOOK SECRET",
  };

  if (
    !labels[field]
  ) {
    return;
  }

  return editMessage(
    env,
    chatId,
    messageId,
`🗑️ HAPUS ${labels[field]}?

⚠️ Data ini akan dihapus.

Yakin mau hapus?`,
    [
      [
        {
          text:
            "✅ YA, HAPUS",
          callback_data:
            `admin:payment:setting:clear:confirm:${field}`,
        },
      ],
      [
        {
          text:
            "❌ BATAL",
          callback_data:
            `admin:payment:setting:${field}`,
        },
      ],
    ]
  );
}

export async function clearPaymentSetting(
  env,
  chatId,
  messageId,
  field
) {
  const keys = {
    account_id:
      "payment_account_id",
    secret_token:
      "payment_secret_token",
    webhook_secret:
      "payment_webhook_secret",
  };

  if (
    !keys[field]
  ) {
    return;
  }

  await setSetting(
    env,
    keys[field],
    ""
  );

  await deleteState(
    env,
    chatId
  );

  return showPaymentConfig(
    env,
    chatId,
    messageId
  );
}

export async function handlePaymentSettingInput(
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
    state.field ===
    "account_id"
  ) {
    await setSetting(
      env,
      "payment_account_id",
      value
    );
  } else if (
    state.field ===
    "secret_token"
  ) {
    await setSetting(
      env,
      "payment_secret_token",
      await encryptSecret(
        env,
        value
      )
    );
  } else if (
    state.field ===
    "webhook_secret"
  ) {
    await setSetting(
      env,
      "payment_webhook_secret",
      await encryptSecret(
        env,
        value
      )
    );
  } else if (
    state.field ===
    "fee_percent"
  ) {
    const number =
      Number(
        value.replace(
          "%",
          ""
        )
      );

    if (
      !Number.isFinite(
        number
      ) ||
      number < 0 ||
      number > 100
    ) {
      return editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Angka tidak valid.

Kirim angka persentase antara 0-100, contoh: 0.7`,
        [
          [
            {
              text:
                "❌ BATAL",
              callback_data:
                "admin:payment:cancel",
            },
          ],
        ]
      );
    }

    await setSetting(
      env,
      "payment_fee_percent",
      String(number)
    );
  }

  await deleteState(
    env,
    message.chat.id
  );

  return showPaymentConfig(
    env,
    message.chat.id,
    state.message_id
  );
}

export async function savePaymentSetting(
  env,
  chatId,
  messageId
) {
  await deleteState(
    env,
    chatId
  );

  return showPaymentConfig(
    env,
    chatId,
    messageId
  );
}

export async function cancelPaymentSetting(
  env,
  chatId,
  messageId
) {
  await deleteState(
    env,
    chatId
  );

  return showPaymentConfig(
    env,
    chatId,
    messageId
  );
}

export async function togglePayment(
  env,
  chatId,
  messageId
) {
  const settings =
    await getPaymentSettings(env);

  await setSetting(
    env,
    "payment_enabled",
    settings.enabled
      ? "false"
      : "true"
  );

  return showPaymentMenu(
    env,
    chatId,
    messageId
  );
}

export async function createPayment(
  env,
  telegramId,
  product,
  firstName = null
) {
  const settings =
    await getPaymentSettings(env);

  if (
    !settings.enabled
  ) {
    throw new Error(
      "Pembayaran sedang nonaktif."
    );
  }

  if (
    !settings.account_id ||
    !settings.secret_token
  ) {
    throw new Error(
      "Payment gateway belum dikonfigurasi."
    );
  }

  if (!env.CALLBACK_URL) {
    /*
     * Tanpa ini, BuatQris tidak tahu ke mana harus mengirim
     * webhook — pembayaran tidak akan pernah terdeteksi otomatis,
     * dan ini gagal DIAM-DIAM (order tetap PENDING selamanya)
     * kalau tidak dicegat di sini.
     */
    throw new Error(
      "CALLBACK_URL belum diset di environment variable Cloudflare Worker."
    );
  }

  if (
    !settings.webhook_secret
  ) {
    throw new Error(
      "Webhook Secret belum dikonfigurasi."
    );
  }

  const baseAmount =
    Number(
      product.price || 0
    );

  if (
    !Number.isSafeInteger(
      baseAmount
    ) ||
    baseAmount <= 0
  ) {
    throw new Error(
      "Harga produk tidak valid."
    );
  }

  let amount =
    baseAmount;

  const feePercent =
    Number(
      settings.fee_percent || 0
    );

  const feeAmount =
    Math.round(
      baseAmount *
        feePercent /
        100
    );

  if (
    settings.fee_borne_by ===
    "buyer"
  ) {
    /*
     * Fee ditanggung pembeli: nominal yang harus dibayar customer
     * dinaikkan sebesar fee, supaya toko tetap menerima harga
     * produk secara utuh.
     */
    amount =
      baseAmount +
      feeAmount;
  } else {
    /*
     * Fee ditanggung toko: customer bayar persis harga produk,
     * toko yang menanggung potongan fee dari gateway pembayaran.
     */
    amount =
      baseAmount;
  }

  const orderCode =
    `INV-${Date.now()}-${telegramId}`;

  const rows =
    await supabase(
      env,
      "orders",
      "POST",
      {
        order_code:
          orderCode,
        telegram_id:
          Number(
            telegramId
          ),
        product_id:
          Number(
            product.id
          ),
        amount,
        first_name:
          firstName || null,
        status:
          "PENDING",
      },
      {
        Prefer:
          "return=representation",
      }
    );

  const order =
    rows?.[0];

  if (!order) {
    throw new Error(
      "Gagal membuat order."
    );
  }

  const form =
    new URLSearchParams();

  form.set(
    "action",
    "api_create_qris"
  );

  form.set(
    "account_id",
    settings.account_id
  );

  form.set(
    "secret_token",
    settings.secret_token
  );

  form.set(
    "amount",
    String(amount)
  );

  form.set(
    "description",
    `Pembayaran order #${orderCode}`
  );

  form.set(
    "qris_method",
    settings.qris_method
  );

  form.set(
    "test",
    settings.test
      ? "1"
      : "0"
  );

  form.set(
    "callback_url",
    env.CALLBACK_URL || ""
  );

  let response;

  try {
    response =
      await fetch(
        BUATQRIS_API,
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            "User-Agent":
              "Mozilla/5.0",
          },
          body:
            form.toString(),
        }
      );
  } catch (error) {
    console.error(
      "BuatQris request error:",
      error
    );

    await updateOrder(
      env,
      order.id,
      {
        status:
          "FAILED",
      }
    );

    throw new Error(
      "Tidak dapat menghubungi BuatQris."
    );
  }

  let data;

  try {
    data =
      await response.json();
  } catch {
    await updateOrder(
      env,
      order.id,
      {
        status:
          "FAILED",
      }
    );

    throw new Error(
      "Respons BuatQris tidak valid."
    );
  }

  if (
    !response.ok ||
    data?.success === false
  ) {
    console.error(
      "BuatQris create error:",
      data
    );

    await updateOrder(
      env,
      order.id,
      {
        status:
          "FAILED",
      }
    );

    throw new Error(
      data?.message ||
        data?.error ||
        "Gagal membuat QRIS."
    );
  }

  const paymentData =
    data?.data ||
    data;

  const paymentId =
    paymentData?.transaction_id ||
    data?.transaction_id ||
    paymentData?.payment_id ||
    data?.payment_id;

  const qrUrl =
    paymentData?.qr_url ||
    data?.qr_url ||
    paymentData?.qris_image ||
    data?.qris_image ||
    paymentData?.payment_url ||
    data?.payment_url;

  const expiresAt =
    paymentData?.expires_at ||
    data?.expires_at ||
    new Date(
      Date.now() +
        15 * 60 * 1000
    ).toISOString();

  if (!paymentId) {
    await updateOrder(
      env,
      order.id,
      {
        status:
          "FAILED",
      }
    );

    throw new Error(
      "BuatQris tidak mengembalikan transaction_id."
    );
  }

  if (!qrUrl) {
    await updateOrder(
      env,
      order.id,
      {
        status:
          "FAILED",
      }
    );

    throw new Error(
      "BuatQris tidak mengembalikan QRIS."
    );
  }

  await updateOrder(
    env,
    order.id,
    {
      payment_id:
        String(
          paymentId
        ),
      qr_url:
        qrUrl,
      qr_expires_at:
        expiresAt,
    }
  );

  return {
    ...order,
    amount,
    product_name:
      product.name || "",
    payment_id:
      String(
        paymentId
      ),
    qr_url:
      qrUrl,
    qr_expires_at:
      expiresAt,
  };
}

export async function sendPaymentQr(
  env,
  chatId,
  order
) {
  if (
    !order?.qr_url
  ) {
    throw new Error(
      "QRIS tidak tersedia."
    );
  }

  const text =
    await getMessage(
      env,
      "message_waiting_payment"
    );

  const caption =
    String(
      text || ""
    )
      .replaceAll(
        "{order_code}",
        order.order_code || ""
      )
      .replaceAll(
        "{product_name}",
        order.product_name || ""
      )
      .replaceAll(
        "{price}",
        Number(
          order.amount || 0
        ).toLocaleString("id-ID")
      )
      .replaceAll(
        "{minutes}",
        "15"
      );

  const sent =
    await sendPhoto(
      env,
      chatId,
      order.qr_url,
      caption
    );

  const sentMessageId =
    sent?.result?.message_id ||
    sent?.message_id;

  if (
    sentMessageId
  ) {
    await updateOrder(
      env,
      order.id,
      {
        payment_message_id:
          Number(
            sentMessageId
          ),
      }
    );
  }

  return sent;
}

export async function handleBuatQrisWebhook(
  env,
  request
) {
  const body =
    await request.text();

  const signature =
    request.headers.get(
      "X-BuatQris-Signature"
    );

  const eventHeader =
    request.headers.get(
      "X-BuatQris-Event"
    );

  const delivery =
    request.headers.get(
      "X-BuatQris-Delivery"
    );

  const settings =
    await getPaymentSettings(env);

  if (
    !settings.webhook_secret
  ) {
    console.error(
      "Webhook: Webhook Secret belum ada."
    );

    return new Response(
      "Webhook secret belum diatur",
      {
        status: 503,
      }
    );
  }

  const valid =
    await verifySignature(
      body,
      signature,
      settings.webhook_secret
    );

  if (!valid) {
    console.error(
      "Webhook: signature invalid."
    );

    return new Response(
      "Unauthorized",
      {
        status: 401,
      }
    );
  }

  let data;

  try {
    data =
      JSON.parse(body);
  } catch {
    return new Response(
      "Bad Request",
      {
        status: 400,
      }
    );
  }

  const event =
    data?.event ||
    eventHeader ||
    "";

  const transactionId =
    String(
      data?.transaction_id ||
      data?.data?.transaction_id ||
      delivery ||
      ""
    ).trim();

  console.log(
    "BuatQris webhook:",
    JSON.stringify({
      event,
      transactionId,
      status:
        data?.status,
      amount:
        data?.amount,
    })
  );

  if (
    !transactionId
  ) {
    return new Response(
      "OK",
      {
        status: 200,
      }
    );
  }

  if (
    event ===
    "payment.success"
  ) {
    await processPaymentSuccess(
      env,
      transactionId,
      data
    );
  } else if (
    event ===
      "payment.expired" ||
    event ===
      "payment.failed"
  ) {
    await processPaymentFailed(
      env,
      transactionId,
      event
    );
  }

  return new Response(
    "OK",
    {
      status: 200,
    }
  );
}

async function processPaymentSuccess(
  env,
  transactionId,
  data
) {
  const orders =
    (await supabase(
      env,
      `orders?payment_id=eq.${encodeURIComponent(
        transactionId
      )}&limit=1`
    )) || [];

  let order =
    orders?.[0];

  if (!order) {
    const orderCode =
      data?.order_code ||
      data?.description
        ?.match(
          /#(INV-[^\s]+)/i
        )?.[1];

    if (
      orderCode
    ) {
      const fallback =
        (await supabase(
          env,
          `orders?order_code=eq.${encodeURIComponent(
            orderCode
          )}&limit=1`
        )) || [];

      order =
        fallback?.[0];
    }
  }

  if (!order) {
    console.error(
      "Payment success: order tidak ditemukan.",
      transactionId
    );

    return;
  }

  if (
    order.status ===
      "PAID" ||
    order.status ===
      "DELIVERED"
  ) {
    return;
  }

  const paidAmount =
    Number(
      data?.amount ??
      data?.data?.amount ??
      0
    );

  const expectedAmount =
    Number(
      order.amount || 0
    );

  if (
    !Number.isFinite(
      paidAmount
    ) ||
    paidAmount <= 0
  ) {
    console.error(
      "Payment success: amount tidak valid.",
      data
    );

    return;
  }

  if (
    paidAmount !==
    expectedAmount
  ) {
    console.error(
      "Payment success: nominal tidak cocok.",
      {
        order:
          order.id,
        expected:
          expectedAmount,
        received:
          paidAmount,
        transactionId,
      }
    );

    await updateOrder(
      env,
      order.id,
      {
        status:
          "PAYMENT_MISMATCH",
      }
    );

    return;
  }

  const updated =
    await supabase(
      env,
      `orders?payment_id=eq.${encodeURIComponent(
        transactionId
      )}&status=eq.PENDING`,
      "PATCH",
      {
        status:
          "PAID",
        payment_id:
          String(
            transactionId
          ),
        paid_at:
          data?.paid_at ||
          data?.data?.paid_at ||
          new Date().toISOString(),
      },
      {
        Prefer:
          "return=representation",
      }
    );

  let paidOrder =
    updated?.[0];

  if (
    !paidOrder &&
    !order.payment_id
  ) {
    const retry =
      await supabase(
        env,
        `orders?id=eq.${Number(
          order.id
        )}&status=eq.PENDING`,
        "PATCH",
        {
          status:
            "PAID",
          payment_id:
            String(
              transactionId
            ),
          paid_at:
            data?.paid_at ||
            new Date().toISOString(),
        },
        {
          Prefer:
            "return=representation",
        }
      );

    paidOrder =
      retry?.[0];
  }

  if (!paidOrder) {
    return;
  }

  try {
    await deliverProduct(
      env,
      paidOrder
    );

    await updateOrder(
      env,
      paidOrder.id,
      {
        status:
          "DELIVERED",
      }
    );

    /*
     * Hapus pesan QRIS begitu produk berhasil dikirim — tidak
     * perlu menunggu 15 menit / cron expiry, karena begitu bayar
     * sukses QRIS-nya sudah tidak relevan lagi.
     */
    if (
      paidOrder.payment_message_id &&
      paidOrder.telegram_id
    ) {
      try {
        await deleteMessage(
          env,
          paidOrder.telegram_id,
          Number(
            paidOrder.payment_message_id
          )
        );
      } catch (error) {
        console.error(
          `Gagal menghapus pesan QRIS untuk order #${paidOrder.id}:`,
          error
        );
      }
    }

    console.log(
      "Produk berhasil dikirim:",
      paidOrder.id
    );
  } catch (error) {
    console.error(
      "Gagal mengirim produk:",
      error
    );

    /*
     * Meski ada error (mis. sebagian channel VIP gagal), customer
     * mungkin sudah menerima pesan/link yang berhasil sebelum
     * error dilempar — jadi pesan QRIS tetap dihapus di sini juga,
     * bukan cuma di jalur sukses penuh.
     */
    if (
      paidOrder.payment_message_id &&
      paidOrder.telegram_id
    ) {
      try {
        await deleteMessage(
          env,
          paidOrder.telegram_id,
          Number(
            paidOrder.payment_message_id
          )
        );
      } catch (deleteError) {
        console.error(
          `Gagal menghapus pesan QRIS untuk order #${paidOrder.id}:`,
          deleteError
        );
      }
    }

    await updateOrder(
      env,
      paidOrder.id,
      {
        status:
          "DELIVERY_FAILED",
      }
    );
  }
}

async function processPaymentFailed(
  env,
  transactionId,
  event
) {
  const status =
    event ===
      "payment.expired"
      ? "EXPIRED"
      : "FAILED";

  await supabase(
    env,
    `orders?payment_id=eq.${encodeURIComponent(
      transactionId
    )}&status=eq.PENDING`,
    "PATCH",
    {
      status,
    }
  );
}

export async function checkPendingPayments(
  env
) {
  const settings =
    await getPaymentSettings(env);

  if (
    !settings.enabled ||
    !settings.account_id ||
    !settings.secret_token
  ) {
    return;
  }

  const orders =
    (await supabase(
      env,
      "orders?status=eq.PENDING&payment_id=not.is.null&limit=20"
    )) || [];

  for (
    const order of orders
  ) {
    try {
      const status =
        await checkPaymentStatus(
          env,
          settings,
          order.payment_id
        );

      if (
        status ===
        "success"
      ) {
        await processPaymentSuccess(
          env,
          String(
            order.payment_id
          ),
          {
            event:
              "payment.success",
            transaction_id:
              String(
                order.payment_id
              ),
            amount:
              Number(
                order.amount
              ),
            status:
              "success",
            paid_at:
              new Date().toISOString(),
          }
        );
      } else if (
        status ===
        "expired"
      ) {
        await updateOrder(
          env,
          order.id,
          {
            status:
              "EXPIRED",
          }
        );
      } else if (
        status ===
        "failed"
      ) {
        await updateOrder(
          env,
          order.id,
          {
            status:
              "FAILED",
          }
        );
      }
    } catch (error) {
      console.error(
        "Gagal cek status payment:",
        order.id,
        error
      );
    }
  }
}

async function checkPaymentStatus(
  env,
  settings,
  transactionId
) {
  const form =
    new URLSearchParams();

  form.set(
    "action",
    "api_check_status"
  );

  form.set(
    "account_id",
    settings.account_id
  );

  form.set(
    "secret_token",
    settings.secret_token
  );

  form.set(
    "transaction_id",
    String(
      transactionId
    )
  );

  const response =
    await fetch(
      BUATQRIS_API,
      {
        method:
          "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0",
        },
        body:
          form.toString(),
      }
    );

  const json =
    await response.json();

  if (
    !response.ok ||
    json?.success === false
  ) {
    throw new Error(
      json?.message ||
        "Gagal mengecek status transaksi."
    );
  }

  return String(
    json?.data?.status ||
    json?.status ||
    ""
  ).toLowerCase();
}

async function updateOrder(
  env,
  orderId,
  data
) {
  return supabase(
    env,
    `orders?id=eq.${Number(
      orderId
    )}`,
    "PATCH",
    data
  );
}

async function getPaymentSettings(
  env
) {
  const rows =
    await supabase(
      env,
      "settings?key=like.payment_*&order=key.asc"
    );

  const result = {
    enabled:
      true,
    account_id:
      "",
    secret_token:
      "",
    webhook_secret:
      "",
    qris_method:
      "qris_two",
    test:
      false,
    fee_percent:
      0,
    fee_borne_by:
      "buyer",
  };

  let encryptedSecretToken =
    "";

  let encryptedWebhookSecret =
    "";

  for (
    const row of
      rows || []
  ) {
    const key =
      String(
        row.key || ""
      );

    const value =
      row.value;

    if (
      key ===
      "payment_enabled"
    ) {
      result.enabled =
        value === true ||
        value === "true" ||
        value === "1";
    }

    if (
      key ===
      "payment_account_id"
    ) {
      result.account_id =
        value || "";
    }

    if (
      key ===
      "payment_secret_token"
    ) {
      encryptedSecretToken =
        value || "";
    }

    if (
      key ===
      "payment_webhook_secret"
    ) {
      encryptedWebhookSecret =
        value || "";
    }

    if (
      key ===
      "payment_qris_method"
    ) {
      result.qris_method =
        value ||
        "qris_two";
    }

    if (
      key ===
      "payment_test"
    ) {
      result.test =
        value === true ||
        value === "true" ||
        value === "1";
    }

    if (
      key ===
      "payment_fee_percent"
    ) {
      result.fee_percent =
        Number(
          value || 0
        );
    }

    if (
      key ===
      "payment_fee_borne_by"
    ) {
      result.fee_borne_by =
        value === "merchant"
          ? "merchant"
          : "buyer";
    }
  }

  try {
    result.secret_token =
      await decryptSecret(
        env,
        encryptedSecretToken
      );

    result.webhook_secret =
      await decryptSecret(
        env,
        encryptedWebhookSecret
      );
  } catch (error) {
    console.error(
      "Gagal dekripsi payment settings:",
      error
    );

    result.secret_token =
      "";

    result.webhook_secret =
      "";
  }

  return result;
}

async function setSetting(
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

function maskValue(
  value
) {
  if (!value) {
    return "Belum diatur";
  }

  const text =
    String(value);

  if (
    text.length <= 6
  ) {
    return "••••••";
  }

  return (
    text.slice(0, 3) +
    "••••••" +
    text.slice(-3)
  );
}

async function verifySignature(
  body,
  signature,
  secret
) {
  if (
    !signature ||
    !secret
  ) {
    return false;
  }

  const prefix =
    "sha256=";

  if (
    !signature
      .toLowerCase()
      .startsWith(
        prefix
      )
  ) {
    return false;
  }

  const providedHex =
    signature.slice(
      prefix.length
    );

  if (
    !/^[a-f0-9]{64}$/i.test(
      providedHex
    )
  ) {
    return false;
  }

  const encoder =
    new TextEncoder();

  const key =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(
        secret
      ),
      {
        name:
          "HMAC",
        hash:
          "SHA-256",
      },
      false,
      [
        "sign",
      ]
    );

  const signatureBuffer =
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(
        body
      )
    );

  const expectedHex =
    Array.from(
      new Uint8Array(
        signatureBuffer
      )
    )
      .map(
        byte =>
          byte
            .toString(16)
            .padStart(
              2,
              "0"
            )
      )
      .join("");

  return timingSafeEqual(
    providedHex.toLowerCase(),
    expectedHex
  );
}

function timingSafeEqual(
  a,
  b
) {
  if (
    a.length !==
    b.length
  ) {
    return false;
  }

  let result = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}
