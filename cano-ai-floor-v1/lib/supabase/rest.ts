type QueryValue = string | number | boolean | null | undefined;

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY");

  return { url, secret };
}

function authHeaders(secret: string) {
  /*
  |--------------------------------------------------------------------------
  | SUPPORT BOTH SUPABASE KEY GENERATIONS CORRECTLY
  |--------------------------------------------------------------------------
  |
  | New secret keys look like:
  |   sb_secret_...
  |
  | Those are opaque API keys, NOT JWTs. They belong in `apikey` only.
  |
  | Legacy service_role keys look like JWTs:
  |   eyJ...
  |
  | Those can be used as both `apikey` and `Authorization: Bearer ...`.
  |
  | The previous patch sent `Authorization: Bearer sb_secret_...`, which is
  | invalid for the new key format and can break PostgREST authentication.
  |--------------------------------------------------------------------------
  */

  const result: Record<string, string> = {
    apikey: secret,
  };

  const looksLikeJwt =
    secret.startsWith("eyJ") &&
    secret.split(".").length === 3;

  if (looksLikeJwt) {
    result.Authorization = `Bearer ${secret}`;
  }

  return result;
}

function headers(extra?: Record<string, string>) {
  const { secret } = getConfig();

  return {
    ...authHeaders(secret),
    "Content-Type": "application/json",
    ...extra,
  };
}

function buildQuery(params?: Record<string, QueryValue>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function isTransientDatabaseError(status: number, body: string) {
  if (status < 500) return false;

  const value = String(body || "").toLowerCase();

  return (
    value.includes("current transaction is aborted") ||
    value.includes("commands ignored until end of transaction block") ||
    value.includes("connection") ||
    value.includes("timeout") ||
    value.includes("temporarily unavailable") ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestSupabase(
  url: string,
  init: RequestInit,
  context?: string
) {
  const delays = [0, 180, 500];

  let lastResponse: Response | null = null;
  let lastText = "";

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) {
      await wait(delays[attempt]);
    }

    const response = await fetch(url, {
      ...init,
      cache: "no-store",
    });

    const text = await response.text();

    lastResponse = response;
    lastText = text;

    if (response.ok) {
      if (!text) return null;

      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    if (
      attempt < delays.length - 1 &&
      isTransientDatabaseError(response.status, text)
    ) {
      continue;
    }

    let detail = text || response.statusText;

    try {
      const parsed = JSON.parse(text);
      detail =
        parsed?.message ||
        parsed?.details ||
        parsed?.hint ||
        parsed?.code ||
        detail;
    } catch {}

    throw new Error(
      `Supabase ${context ? `${context} ` : ""}${response.status}: ${detail}`
    );
  }

  throw new Error(
    `Supabase ${context ? `${context} ` : ""}${
      lastResponse?.status || 500
    }: ${lastText || "Unknown database error"}`
  );
}

export async function supabaseSelect<T = any>(
  table: string,
  params?: Record<string, QueryValue>
): Promise<T[]> {
  const { url } = getConfig();

  const data = await requestSupabase(
    `${url}/rest/v1/${table}${buildQuery(params)}`,
    {
      method: "GET",
      headers: headers(),
    },
    `select ${table}`
  );

  return Array.isArray(data) ? data : [];
}

export async function supabaseInsert<T = any>(
  table: string,
  payload: Record<string, any> | Record<string, any>[]
): Promise<T[]> {
  const { url } = getConfig();

  const data = await requestSupabase(
    `${url}/rest/v1/${table}`,
    {
      method: "POST",
      headers: headers({
        Prefer: "return=representation",
      }),
      body: JSON.stringify(payload),
    },
    `insert ${table}`
  );

  return Array.isArray(data) ? data : [];
}

export async function supabaseUpsert<T = any>(
  table: string,
  payload: Record<string, any> | Record<string, any>[],
  onConflict: string
): Promise<T[]> {
  const { url } = getConfig();

  const data = await requestSupabase(
    `${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: "POST",
      headers: headers({
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(payload),
    },
    `upsert ${table}`
  );

  return Array.isArray(data) ? data : [];
}

export async function supabaseUpdate<T = any>(
  table: string,
  filters: Record<string, string>,
  payload: Record<string, any>
): Promise<T[]> {
  const { url } = getConfig();

  const search = new URLSearchParams();

  for (const [column, expression] of Object.entries(filters)) {
    search.set(column, expression);
  }

  const data = await requestSupabase(
    `${url}/rest/v1/${table}?${search.toString()}`,
    {
      method: "PATCH",
      headers: headers({
        Prefer: "return=representation",
      }),
      body: JSON.stringify(payload),
    },
    `update ${table}`
  );

  return Array.isArray(data) ? data : [];
}

export async function supabaseDelete<T = any>(
  table: string,
  filters: Record<string, string>
): Promise<T[]> {
  const { url } = getConfig();

  const search = new URLSearchParams();

  for (const [column, expression] of Object.entries(filters)) {
    search.set(column, expression);
  }

  const data = await requestSupabase(
    `${url}/rest/v1/${table}?${search.toString()}`,
    {
      method: "DELETE",
      headers: headers({
        Prefer: "return=representation",
      }),
    },
    `delete ${table}`
  );

  return Array.isArray(data) ? data : [];
}
