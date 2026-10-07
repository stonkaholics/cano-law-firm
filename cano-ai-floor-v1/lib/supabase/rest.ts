import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined;

let adminClient:
  SupabaseClient | null = null;

function decodeJwtRole(
  token: string
) {
  try {
    const parts =
      token.split(".");

    if (
      parts.length !== 3
    ) {
      return null;
    }

    const payload =
      parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const padded =
      payload +
      "=".repeat(
        (4 -
          (payload.length %
            4)) %
          4
      );

    const parsed =
      JSON.parse(
        Buffer.from(
          padded,
          "base64"
        ).toString("utf8")
      );

    return typeof parsed?.role ===
      "string"
      ? parsed.role
      : null;
  } catch {
    return null;
  }
}

export function getSupabaseServerKeyInfo() {
  const secret =
    process.env
      .SUPABASE_SECRET_KEY ||
    process.env
      .SUPABASE_SERVICE_ROLE_KEY ||
    "";

  let type =
    "unknown";

  let role:
    string | null = null;

  if (
    secret.startsWith(
      "sb_secret_"
    )
  ) {
    type =
      "secret";
    role =
      "service_role";
  } else if (
    secret.startsWith(
      "sb_publishable_"
    )
  ) {
    type =
      "publishable";
    role =
      "anon";
  } else if (
    secret.startsWith(
      "eyJ"
    )
  ) {
    type =
      "legacy_jwt";
    role =
      decodeJwtRole(
        secret
      );
  }

  return {
    configured:
      Boolean(secret),
    type,
    role,
  };
}

function getConfig() {
  const url =
    (
      process.env
        .SUPABASE_URL ||
      process.env
        .NEXT_PUBLIC_SUPABASE_URL ||
      ""
    ).replace(
      /\/$/,
      ""
    );

  const secret =
    process.env
      .SUPABASE_SECRET_KEY ||
    process.env
      .SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL."
    );
  }

  if (!secret) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const info =
    getSupabaseServerKeyInfo();

  /*
  |--------------------------------------------------------------------------
  | FAIL LOUDLY ON A PUBLIC KEY
  |--------------------------------------------------------------------------
  |
  | A publishable/anon key can legitimately return [] when RLS blocks access.
  | That looks exactly like "0 shared matters" even though the table contains
  | data. Do not silently allow that on the trusted Cano server layer.
  |--------------------------------------------------------------------------
  */
  if (
    info.type ===
      "publishable" ||
    info.role ===
      "anon" ||
    info.role ===
      "authenticated"
  ) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not an elevated server key. Use the project's sb_secret_... key or legacy service_role key."
    );
  }

  return {
    url,
    secret,
  };
}

function getClient() {
  if (
    adminClient
  ) {
    return adminClient;
  }

  const {
    url,
    secret,
  } =
    getConfig();

  /*
  |--------------------------------------------------------------------------
  | USE THE OFFICIAL SUPABASE CLIENT
  |--------------------------------------------------------------------------
  |
  | This avoids hand-rolling API-key header behavior across old service_role
  | JWTs and the newer sb_secret_* keys.
  |--------------------------------------------------------------------------
  */
  adminClient =
    createClient(
      url,
      secret,
      {
        auth: {
          persistSession:
            false,
          autoRefreshToken:
            false,
          detectSessionInUrl:
            false,
        },
        global: {
          headers: {
            "X-Client-Info":
              "cano-ai-floor-server",
          },
        },
      }
    );

  return adminClient;
}

function parseOrder(
  value: string
) {
  const [
    column,
    direction,
  ] =
    String(
      value || ""
    ).split(".");

  return {
    column,
    ascending:
      direction !==
      "desc",
  };
}

function parseInValue(
  raw: string
) {
  const inner =
    raw
      .replace(
        /^in\.\(/,
        ""
      )
      .replace(
        /\)$/,
        ""
      );

  if (!inner) {
    return [];
  }

  return inner
    .split(",")
    .map(
      (item) =>
        item
          .trim()
          .replace(
            /^"(.*)"$/,
            "$1"
          )
    )
    .filter(Boolean);
}

function applyFilter(
  query: any,
  column: string,
  expression: QueryValue
) {
  if (
    expression ===
      undefined ||
    expression ===
      null ||
    expression ===
      ""
  ) {
    return query;
  }

  if (
    typeof expression !==
      "string"
  ) {
    return query.eq(
      column,
      expression
    );
  }

  const operators = [
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "ilike",
    "is",
  ];

  for (
    const op of operators
  ) {
    const prefix =
      `${op}.`;

    if (
      expression.startsWith(
        prefix
      )
    ) {
      const value =
        expression.slice(
          prefix.length
        );

      if (
        op === "eq"
      ) {
        return query.eq(
          column,
          value
        );
      }

      if (
        op === "neq"
      ) {
        return query.neq(
          column,
          value
        );
      }

      if (
        op === "gt"
      ) {
        return query.gt(
          column,
          value
        );
      }

      if (
        op === "gte"
      ) {
        return query.gte(
          column,
          value
        );
      }

      if (
        op === "lt"
      ) {
        return query.lt(
          column,
          value
        );
      }

      if (
        op === "lte"
      ) {
        return query.lte(
          column,
          value
        );
      }

      if (
        op === "like"
      ) {
        return query.like(
          column,
          value
        );
      }

      if (
        op === "ilike"
      ) {
        return query.ilike(
          column,
          value
        );
      }

      if (
        op === "is"
      ) {
        const normalized =
          value ===
          "null"
            ? null
            : value ===
              "true"
            ? true
            : value ===
              "false"
            ? false
            : value;

        return query.is(
          column,
          normalized
        );
      }
    }
  }

  if (
    expression.startsWith(
      "in.("
    )
  ) {
    return query.in(
      column,
      parseInValue(
        expression
      )
    );
  }

  /*
  | Safe fallback for any PostgREST operator expression not explicitly mapped.
  */
  const dot =
    expression.indexOf(
      "."
    );

  if (
    dot > 0
  ) {
    return query.filter(
      column,
      expression.slice(
        0,
        dot
      ),
      expression.slice(
        dot + 1
      )
    );
  }

  return query.eq(
    column,
    expression
  );
}

function throwSupabaseError(
  context: string,
  error: any
): never {
  const detail =
    error?.message ||
    error?.details ||
    error?.hint ||
    error?.code ||
    "Unknown Supabase error.";

  throw new Error(
    `Supabase ${context}: ${detail}`
  );
}

export async function supabaseSelect<
  T = any
>(
  table: string,
  params?: Record<
    string,
    QueryValue
  >
): Promise<T[]> {
  const client =
    getClient();

  const select =
    String(
      params?.select ||
      "*"
    );

  let query: any =
    client
      .from(table)
      .select(select);

  for (
    const [
      key,
      value,
    ] of Object.entries(
      params || {}
    )
  ) {
    if (
      key ===
        "select" ||
      key ===
        "order" ||
      key ===
        "limit"
    ) {
      continue;
    }

    if (
      key === "or" &&
      typeof value ===
        "string"
    ) {
      query =
        query.or(
          value
        );

      continue;
    }

    query =
      applyFilter(
        query,
        key,
        value
      );
  }

  if (
    params?.order
  ) {
    const order =
      parseOrder(
        String(
          params.order
        )
      );

    if (
      order.column
    ) {
      query =
        query.order(
          order.column,
          {
            ascending:
              order.ascending,
          }
        );
    }
  }

  if (
    params?.limit !==
      undefined &&
    params?.limit !==
      null
  ) {
    query =
      query.limit(
        Number(
          params.limit
        )
      );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    throwSupabaseError(
      `select ${table}`,
      error
    );
  }

  return Array.isArray(
    data
  )
    ? (data as T[])
    : [];
}

export async function supabaseInsert<
  T = any
>(
  table: string,
  payload:
    | Record<
        string,
        any
      >
    | Record<
        string,
        any
      >[]
): Promise<T[]> {
  const client =
    getClient();

  const {
    data,
    error,
  } =
    await client
      .from(table)
      .insert(payload)
      .select();

  if (error) {
    throwSupabaseError(
      `insert ${table}`,
      error
    );
  }

  return Array.isArray(
    data
  )
    ? (data as T[])
    : [];
}

export async function supabaseUpsert<
  T = any
>(
  table: string,
  payload:
    | Record<
        string,
        any
      >
    | Record<
        string,
        any
      >[],
  onConflict: string
): Promise<T[]> {
  const client =
    getClient();

  const {
    data,
    error,
  } =
    await client
      .from(table)
      .upsert(
        payload,
        {
          onConflict,
        }
      )
      .select();

  if (error) {
    throwSupabaseError(
      `upsert ${table}`,
      error
    );
  }

  return Array.isArray(
    data
  )
    ? (data as T[])
    : [];
}

export async function supabaseUpdate<
  T = any
>(
  table: string,
  filters: Record<
    string,
    string
  >,
  payload: Record<
    string,
    any
  >
): Promise<T[]> {
  const client =
    getClient();

  let query: any =
    client
      .from(table)
      .update(payload);

  for (
    const [
      column,
      expression,
    ] of Object.entries(
      filters
    )
  ) {
    query =
      applyFilter(
        query,
        column,
        expression
      );
  }

  const {
    data,
    error,
  } =
    await query.select();

  if (error) {
    throwSupabaseError(
      `update ${table}`,
      error
    );
  }

  return Array.isArray(
    data
  )
    ? (data as T[])
    : [];
}

export async function supabaseDelete<
  T = any
>(
  table: string,
  filters: Record<
    string,
    string
  >
): Promise<T[]> {
  const client =
    getClient();

  let query: any =
    client
      .from(table)
      .delete();

  for (
    const [
      column,
      expression,
    ] of Object.entries(
      filters
    )
  ) {
    query =
      applyFilter(
        query,
        column,
        expression
      );
  }

  const {
    data,
    error,
  } =
    await query.select();

  if (error) {
    throwSupabaseError(
      `delete ${table}`,
      error
    );
  }

  return Array.isArray(
    data
  )
    ? (data as T[])
    : [];
}


export async function supabaseRpc<T = any>(
  functionName: string,
  args: Record<string, any> = {}
): Promise<T[]> {
  const client = getClient();

  const {
    data,
    error,
  } = await client.rpc(
    functionName,
    args
  );

  if (error) {
    throwSupabaseError(
      `rpc ${functionName}`,
      error
    );
  }

  return Array.isArray(data)
    ? (data as T[])
    : [];
}
