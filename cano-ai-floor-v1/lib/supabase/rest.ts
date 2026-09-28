type QueryValue = string | number | boolean | null | undefined;

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY");

  return { url, secret };
}

function headers(extra?: Record<string, string>) {
  const { secret } = getConfig();

  return {
    apikey: secret,
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

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase ${response.status}: ${text || response.statusText}`
    );
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function supabaseSelect<T = any>(
  table: string,
  params?: Record<string, QueryValue>
): Promise<T[]> {
  const { url } = getConfig();

  const response = await fetch(
    `${url}/rest/v1/${table}${buildQuery(params)}`,
    {
      method: "GET",
      headers: headers(),
      cache: "no-store",
    }
  );

  const data = await parseResponse(response);
  return Array.isArray(data) ? data : [];
}

export async function supabaseInsert<T = any>(
  table: string,
  payload: Record<string, any> | Record<string, any>[]
): Promise<T[]> {
  const { url } = getConfig();

  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: headers({
      Prefer: "return=representation",
    }),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await parseResponse(response);
  return Array.isArray(data) ? data : [];
}

export async function supabaseUpsert<T = any>(
  table: string,
  payload: Record<string, any> | Record<string, any>[],
  onConflict: string
): Promise<T[]> {
  const { url } = getConfig();

  const response = await fetch(
    `${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: "POST",
      headers: headers({
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  const data = await parseResponse(response);
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

  const response = await fetch(
    `${url}/rest/v1/${table}?${search.toString()}`,
    {
      method: "PATCH",
      headers: headers({
        Prefer: "return=representation",
      }),
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  const data = await parseResponse(response);
  return Array.isArray(data) ? data : [];
}
