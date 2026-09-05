/**
 * Enkripsi AES-256-GCM untuk kredensial sensitif (secret_token,
 * webhook_secret) sebelum disimpan ke Supabase. Memakai Web Crypto
 * API yang tersedia native di Cloudflare Workers — tidak perlu
 * library tambahan.
 *
 * PENTING: butuh secret baru `ENCRYPTION_KEY` di Cloudflare Worker:
 *   wrangler secret put ENCRYPTION_KEY
 * (isi bebas, string acak yang panjang — mis. hasil dari
 * `openssl rand -base64 32`)
 *
 * Kalau ENCRYPTION_KEY tidak diset, fungsi ini akan throw error
 * yang jelas saat dipakai — sengaja tidak fallback diam-diam ke
 * plaintext.
 */

async function getKey(env) {
  if (!env.ENCRYPTION_KEY) {
    throw new Error(
      "ENCRYPTION_KEY belum diset di Cloudflare Worker secrets. " +
        "Jalankan: wrangler secret put ENCRYPTION_KEY"
    );
  }

  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env.ENCRYPTION_KEY)
  );

  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function toBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Mengembalikan string "iv:ciphertext" (keduanya base64), atau
 * string kosong kalau plaintext-nya kosong (supaya "belum diatur"
 * tetap tersimpan sebagai string kosong, bukan blob terenkripsi
 * dari string kosong).
 */
export async function encryptSecret(env, plaintext) {
  if (!plaintext) {
    return "";
  }

  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  return `${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

/**
 * Kebalikan dari encryptSecret. Mengembalikan "" kalau input
 * kosong/null. Melempar error kalau format tidak valid atau
 * ENCRYPTION_KEY salah — sengaja tidak diam-diam mengembalikan
 * string kosong, supaya admin sadar ada masalah konfigurasi
 * daripada bot berjalan seolah-olah kredensial belum diatur.
 */
export async function decryptSecret(env, stored) {
  if (!stored) {
    return "";
  }

  const [ivB64, dataB64] = String(stored).split(":");

  if (!ivB64 || !dataB64) {
    throw new Error(
      "Format kredensial terenkripsi tidak valid."
    );
  }

  const key = await getKey(env);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivB64) },
    key,
    fromBase64(dataB64)
  );

  return new TextDecoder().decode(plaintext);
}
