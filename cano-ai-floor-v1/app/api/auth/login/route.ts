import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  CANO_SESSION_COOKIE,
  CANO_SESSION_MAX_AGE,
  createCanoSessionToken,
} from "../../../../lib/auth/session";

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  if (!anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return {
    url: url.replace(/\/$/, ""),
    anonKey,
  };
}

function safeNextPath(
  value: string
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  return value;
}

async function verifyWithSupabase(
  email: string,
  password: string
) {
  const {
    url,
    anonKey,
  } =
    getSupabaseConfig();

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      25000
    );

  try {
    const response =
      await fetch(
        `${url}/auth/v1/token?grant_type=password`,
        {
          method: "POST",

          headers: {
            apikey:
              anonKey,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              email,
              password,
            }),

          signal:
            controller.signal,

          cache:
            "no-store",
        }
      );

    const text =
      await response.text();

    let data: any = null;

    try {
      data =
        text
          ? JSON.parse(text)
          : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.msg ||
          data?.message ||
          data?.error_description ||
          "Invalid email or password."
      );
    }

    if (
      !data?.user?.id ||
      !data?.user?.email
    ) {
      throw new Error(
        "Supabase verified the request but did not return a valid user."
      );
    }

    return {
      id:
        String(
          data.user.id
        ),

      email:
        String(
          data.user.email
        ),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      throw new Error(
        "Supabase Auth took too long to respond. Please try again."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const email =
      String(
        body?.email || ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        body?.password || ""
      );

    const next =
      safeNextPath(
        String(
          body?.next || "/"
        )
      );

    if (
      !email ||
      !password
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Email and password are required.",
        },
        {
          status: 400,
        }
      );
    }

    const user =
      await verifyWithSupabase(
        email,
        password
      );

    const token =
      await createCanoSessionToken({
        sub:
          user.id,

        email:
          user.email,
      });

    const response =
      NextResponse.json({
        ok: true,
        next,
        email:
          user.email,
      });

    response.cookies.set(
      CANO_SESSION_COOKIE,
      token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          CANO_SESSION_MAX_AGE,
      }
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to sign in.",
      },
      {
        status: 401,
      }
    );
  }
}
