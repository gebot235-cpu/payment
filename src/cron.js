import {
  sendMessage,
  kickChatMember,
  deleteMessage,
} from "./telegram.js";

import {
  supabase,
} from "./supabase.js";

import {
  getMessage,
} from "./admin/messages.js";

import {
  checkPendingPayments,
} from "./payment.js";

/*
 * BUG YANG DIPERBAIKI: versi sebelumnya memakai string biasa
 * ("...") alih-alih template literal (`...`) untuk beberapa query
 * yang berisi `${...}`. Akibatnya teks "${encodeURIComponent(...)}"
 * terkirim MENTAH sebagai bagian dari query, bukan tanggal
 * sungguhan — Supabase menolak query itu, error-nya ketangkep
 * try/catch dan cuma masuk log tanpa terlihat.
 *
 * Efeknya: expirePendingOrders, sendVipReminders, dan
 * kickExpiredVipMembers TIDAK PERNAH benar-benar jalan sejak
 * perubahan itu — order tidak pernah expired otomatis, reminder
 * VIP tidak pernah terkirim, dan member VIP TIDAK PERNAH di-kick
 * otomatis walau cron tetap "sukses" setiap 10 menit.
 *
 * Semua query di bawah sudah dipastikan pakai template literal
 * yang benar.
 */

export async function runCronTasks(env) {
  const results = {
    pendingPayments: 0,
    expiredOrders: 0,
    reminders: 0,
    kicked: 0,
    errors: [],
  };

  try {
    const result =
      await checkPendingPayments(env);

    results.pendingPayments =
      Number.isFinite(result)
        ? result
        : 0;
  } catch (error) {
    console.error(
      "Cron: gagal cek pending payments",
      error
    );

    results.errors.push(
      String(error)
    );
  }

  try {
    results.expiredOrders =
      await expirePendingOrders(env);
  } catch (error) {
    console.error(
      "Cron: gagal expire pending orders",
      error
    );

    results.errors.push(
      String(error)
    );
  }

  try {
    results.reminders =
      await sendVipReminders(env);
  } catch (error) {
    console.error(
      "Cron: gagal kirim reminder VIP",
      error
    );

    results.errors.push(
      String(error)
    );
  }

  try {
    results.kicked =
      await kickExpiredVipMembers(env);
  } catch (error) {
    console.error(
      "Cron: gagal auto-kick VIP expired",
      error
    );

    results.errors.push(
      String(error)
    );
  }

  return results;
}

/**
 * Order PENDING yang QR-nya sudah lewat waktu tapi tidak pernah
 * dibayar akan diubah jadi EXPIRED, dan pesan QRIS-nya dihapus
 * (kalau ID pesannya tercatat) supaya tidak nyampah di chat
 * customer.
 */
async function expirePendingOrders(env) {
  const nowIso =
    new Date().toISOString();

  const rows =
    (await supabase(
      env,
      `orders?status=eq.PENDING&qr_expires_at=lt.${encodeURIComponent(
        nowIso
      )}`
    )) || [];

  let expired = 0;

  for (const order of rows) {
    try {
      if (
        order.payment_message_id &&
        order.telegram_id
      ) {
        try {
          await deleteMessage(
            env,
            order.telegram_id,
            Number(
              order.payment_message_id
            )
          );
        } catch (error) {
          console.error(
            `Gagal menghapus pesan QRIS order #${order.id}:`,
            error
          );
        }
      }

      await supabase(
        env,
        `orders?id=eq.${Number(
          order.id
        )}&status=eq.PENDING`,
        "PATCH",
        {
          status:
            "EXPIRED",
        }
      );

      expired += 1;
    } catch (error) {
      console.error(
        `Gagal expire order #${order.id}:`,
        error
      );
    }
  }

  return expired;
}

const REMINDER_WINDOW_HOURS = 24;

/**
 * Kirim reminder ke member VIP yang masa aktifnya akan habis dalam
 * REMINDER_WINDOW_HOURS jam ke depan. Hanya dikirim sekali per
 * membership (kolom reminded_at).
 */
async function sendVipReminders(env) {
  const now = new Date();

  const windowEnd =
    new Date(
      now.getTime() +
        REMINDER_WINDOW_HOURS *
          60 *
          60 *
          1000
    );

  const rows =
    (await supabase(
      env,
      `vip_memberships?kicked_at=is.null&reminded_at=is.null` +
        `&expires_at=gte.${encodeURIComponent(
          now.toISOString()
        )}` +
        `&expires_at=lte.${encodeURIComponent(
          windowEnd.toISOString()
        )}`
    )) || [];

  let sent = 0;

  for (const membership of rows) {
    try {
      const text =
        `⏰ PENGINGAT\n\n` +
        `Masa aktif VIP kamu akan berakhir dalam waktu kurang dari 24 jam.\n\n` +
        `Perpanjang sekarang supaya tidak terputus.`;

      await sendMessage(
        env,
        membership.telegram_id,
        text
      );

      await supabase(
        env,
        `vip_memberships?id=eq.${Number(
          membership.id
        )}`,
        "PATCH",
        {
          reminded_at:
            new Date().toISOString(),
        }
      );

      sent += 1;
    } catch (error) {
      console.error(
        `Gagal kirim reminder VIP untuk membership #${membership.id}:`,
        error
      );
    }
  }

  return sent;
}

/**
 * Member VIP yang expires_at-nya sudah lewat akan di-kick otomatis
 * (ban lalu unban) dari channel terkait, lalu diberi tahu lewat DM.
 *
 * Catatan: expires_at cuma terisi SETELAH member benar-benar join
 * channel (lihat handleChatMemberUpdate di index.js) — jadi
 * membership yang belum di-join tidak pernah masuk hitungan di
 * sini, sesuai maksudnya.
 *
 * PENGAMANAN MULTI-PRODUK: kalau user punya lebih dari satu produk
 * VIP yang terhubung ke channel yang SAMA (mis. beli "VIP Basic"
 * dan "VIP Premium" yang sama-sama mencakup channel X), dan salah
 * satu produk yang durasinya lebih pendek habis duluan, user TIDAK
 * di-kick selama masih ada membership lain untuk channel yang sama
 * yang masih valid (belum expired / lifetime). Baris yang sudah
 * lewat waktu tetap ditutup (kicked_at diisi) supaya tidak dicek
 * ulang terus oleh cron, tapi tanpa benar-benar mengeluarkan user
 * dari channel.
 */
async function kickExpiredVipMembers(env) {
  const nowIso =
    new Date().toISOString();

  const rows =
    (await supabase(
      env,
      `vip_memberships?kicked_at=is.null&expires_at=lt.${encodeURIComponent(
        nowIso
      )}`
    )) || [];

  let kicked = 0;

  for (const membership of rows) {
    try {
      const stillValid =
        await hasOtherValidMembership(
          env,
          membership
        );

      if (stillValid) {
        /*
         * User masih punya akses valid ke channel ini lewat produk
         * lain — tutup baris ini saja (supaya tidak dicek ulang
         * terus-menerus tiap siklus cron), tapi JANGAN kick dari
         * channel.
         */
        await supabase(
          env,
          `vip_memberships?id=eq.${Number(
            membership.id
          )}`,
          "PATCH",
          {
            kicked_at:
              new Date().toISOString(),
          }
        );

        console.log(
          `Membership #${membership.id} expired tapi user masih punya akses valid lain ke channel ${membership.channel_id} — tidak di-kick.`
        );

        continue;
      }

      await kickChatMember(
        env,
        membership.channel_id,
        membership.telegram_id
      );

      await supabase(
        env,
        `vip_memberships?id=eq.${Number(
          membership.id
        )}`,
        "PATCH",
        {
          kicked_at:
            new Date().toISOString(),
        }
      );

      const template =
        await getMessage(
          env,
          "message_vip_expired"
        );

      await sendMessage(
        env,
        membership.telegram_id,
        template
      );

      kicked += 1;
    } catch (error) {
      console.error(
        `Gagal kick member VIP #${membership.id}:`,
        error
      );
    }
  }

  return kicked;
}

/**
 * Cek apakah telegram_id yang sama punya membership LAIN (bukan
 * baris ini sendiri) untuk channel_id yang sama, yang masih valid:
 * belum di-kick, dan (belum join — masih menunggu — ATAU sudah
 * join dengan expires_at masih di masa depan ATAU lifetime/tanpa
 * batas yaitu expires_at NULL padahal joined_at terisi).
 */
async function hasOtherValidMembership(
  env,
  membership
) {
  const nowIso =
    new Date().toISOString();

  const rows =
    (await supabase(
      env,
      `vip_memberships?telegram_id=eq.${Number(
        membership.telegram_id
      )}&channel_id=eq.${Number(
        membership.channel_id
      )}&id=neq.${Number(
        membership.id
      )}&kicked_at=is.null`
    )) || [];

  return rows.some((row) => {
    if (!row.joined_at) {
      /*
       * Belum join sama sekali (masih pending) — bukan akses
       * aktif SEKARANG, jadi tidak dihitung sebagai alasan untuk
       * membatalkan kick baris yang sedang diproses.
       */
      return false;
    }

    if (!row.expires_at) {
      /*
       * Sudah join, expires_at NULL = lifetime/tanpa batas.
       * Ini akses valid selamanya.
       */
      return true;
    }

    return new Date(row.expires_at) > new Date(nowIso);
  });
}
