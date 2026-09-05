export async function supabase(
  env,
  path,
  method = "GET",
  body = null,
  headers = {}
) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/${path}`,
    {
      method,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${error}`);
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

/**
 * Upsert baris key-value pada tabel `settings` TANPA bergantung
 * pada parameter on_conflict / unique constraint di database.
 *
 * Sebelumnya kode lain memakai POST + "Prefer: resolution=merge-duplicates"
 * tanpa "?on_conflict=key". Kalau kolom `key` bukan primary key di tabel,
 * PostgREST akan menolak (409) atau malah insert baris baru — sehingga
 * baris "key" yang sama bisa dobel dan pembacaan berikutnya (limit=1
 * tanpa order by) bisa mengambil baris yang salah/lama.
 *
 * Fix: coba UPDATE (PATCH) dulu berdasarkan key. Kalau tidak ada baris
 * yang cocok (array kosong), baru INSERT (POST). Ini aman untuk skema
 * apa pun, dengan atau tanpa unique constraint pada `key`.
 */
export async function upsertSetting(
  env,
  key,
  value
) {
  const patched = await supabase(
    env,
    `settings?key=eq.${encodeURIComponent(key)}`,
    "PATCH",
    {
      value: String(value),
      updated_at: new Date().toISOString(),
    },
    {
      Prefer: "return=representation",
    }
  );

  if (patched && patched.length > 0) {
    return patched;
  }

  return supabase(
    env,
    "settings",
    "POST",
    {
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
    },
    {
      Prefer: "return=representation",
    }
  );
}
