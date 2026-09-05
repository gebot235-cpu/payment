import {
  editMessage,
} from "../telegram.js";

import {
  supabase,
} from "../supabase.js";

import {
  getShopSettings,
  formatPrice,
} from "../settings.js";

/*
 * Fitur yang sebelumnya tidak ada sama sekali: admin tidak punya
 * cara melihat pendapatan, jumlah order, atau status member VIP
 * dari dalam bot. Semua angka di sini dihitung langsung dari data
 * `orders` dan `vip_memberships` — bukan dari tabel ringkasan
 * terpisah, jadi selalu terkini tapi untuk toko dengan volume order
 * sangat besar (ribuan+) query ini bisa mulai terasa lambat karena
 * REST Supabase tidak mendukung agregasi SUM/GROUP BY di sisi
 * database untuk kasus ini — perhitungan dilakukan di JavaScript.
 */

const REVENUE_STATUSES =
  "PAID,DELIVERED,DELIVERY_FAILED";

export async function showStats(
  env,
  chatId,
  messageId
) {
  const settings =
    await getShopSettings(env);

  const [
    revenueOrders,
    allOrders,
    activeVip,
    pendingVip,
    products,
  ] = await Promise.all([
    supabase(
      env,
      `orders?status=in.(${REVENUE_STATUSES})&select=id,amount,product_id,paid_at`
    ),
    supabase(
      env,
      `orders?select=id,status`
    ),
    supabase(
      env,
      `vip_memberships?kicked_at=is.null&joined_at=not.is.null&select=id`
    ),
    supabase(
      env,
      `vip_memberships?kicked_at=is.null&joined_at=is.null&select=id`
    ),
    supabase(
      env,
      `products?select=id,name`
    ),
  ]);

  const now = new Date();

  const startOfToday =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

  const startOfWeek =
    new Date(startOfToday);

  startOfWeek.setDate(
    startOfWeek.getDate() -
      startOfWeek.getDay()
  );

  const startOfMonth =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

  let revenueToday = 0;
  let revenueWeek = 0;
  let revenueMonth = 0;
  let revenueTotal = 0;

  let countToday = 0;
  let countWeek = 0;
  let countMonth = 0;
  let countTotal = 0;

  const productCounts = {};

  for (const order of revenueOrders || []) {
    const amount =
      Number(order.amount) || 0;

    const paidAt =
      order.paid_at
        ? new Date(order.paid_at)
        : null;

    revenueTotal += amount;
    countTotal += 1;

    if (order.product_id) {
      const key =
        String(order.product_id);

      productCounts[key] =
        (productCounts[key] || 0) + 1;
    }

    if (paidAt) {
      if (paidAt >= startOfMonth) {
        revenueMonth += amount;
        countMonth += 1;
      }

      if (paidAt >= startOfWeek) {
        revenueWeek += amount;
        countWeek += 1;
      }

      if (paidAt >= startOfToday) {
        revenueToday += amount;
        countToday += 1;
      }
    }
  }

  const statusCounts = {};

  for (const order of allOrders || []) {
    const status =
      order.status || "UNKNOWN";

    statusCounts[status] =
      (statusCounts[status] || 0) + 1;
  }

  const productNameById = {};

  for (const product of products || []) {
    productNameById[
      String(product.id)
    ] = product.name;
  }

  const topProducts =
    Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(
        ([productId, count]) =>
          `• ${
            productNameById[productId] ||
            `Produk #${productId}`
          }: ${count}x`
      );

  const text =
`📊 STATISTIK TOKO

💰 PENDAPATAN
Hari ini: ${formatPrice(revenueToday, settings)} (${countToday} order)
Minggu ini: ${formatPrice(revenueWeek, settings)} (${countWeek} order)
Bulan ini: ${formatPrice(revenueMonth, settings)} (${countMonth} order)
Total: ${formatPrice(revenueTotal, settings)} (${countTotal} order)

📦 STATUS ORDER
⏳ Pending: ${statusCounts.PENDING || 0}
✅ Terkirim: ${statusCounts.DELIVERED || 0}
⚠️ Gagal kirim: ${statusCounts.DELIVERY_FAILED || 0}
⏰ Expired: ${statusCounts.EXPIRED || 0}
🚫 Nominal salah: ${statusCounts.PAYMENT_MISMATCH || 0}

🔐 MEMBER VIP
Aktif (sudah join): ${activeVip?.length || 0}
Menunggu join: ${pendingVip?.length || 0}

🏆 PRODUK TERLARIS
${
  topProducts.length
    ? topProducts.join("\n")
    : "Belum ada data penjualan."
}`;

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    [
      [
        {
          text: "🔄 REFRESH",
          callback_data:
            "admin:stats",
        },
      ],
      [
        {
          text: settings.btn_back_label,
          callback_data:
            "admin:menu",
        },
      ],
    ]
  );
}
