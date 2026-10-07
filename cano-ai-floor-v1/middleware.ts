import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

function getSupabaseConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return {
    url: url.replace(/\/$/, ""),
    anonKey,
  };
}

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

type CookieToSet = {
  name: string;
  value: string;
  options?: any;
};

function applyCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[]
) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

export async function middleware(request: NextRequest) {
  const config = getSupabaseConfig();

  if (!config) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "error",
      "Cano AI login is not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
    );
    return NextResponse.redirect(loginUrl);
  }

  const refreshedCookies: CookieToSet[] = [];

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          refreshedCookies.push(...cookiesToSet);

          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
        },
      },
    }
  );

  /*
  |--------------------------------------------------------------------------
  | FAST AUTH FIRST, SECURE FALLBACK SECOND
  |--------------------------------------------------------------------------
  |
  | Modern Supabase projects can validate JWT claims locally through
  | getClaims(), which is much faster than a full Auth-server getUser() call.
  |
  | IMPORTANT: if getClaims() is unavailable OR returns an error (legacy
  | signing setup, stale JWKS, client-version mismatch, etc.), we immediately
  | fall back to getUser(). That prevents the "fast" path from locking users
  | out.
  |--------------------------------------------------------------------------
  */

  let authenticated = false;
  let userEmail = "";

  try {
    const authAny = supabase.auth as any;

    if (typeof authAny.getClaims === "function") {
      const { data, error } = await authAny.getClaims();

      const claims = data?.claims || null;

      if (!error && claims?.sub) {
        authenticated = true;
        userEmail = String(claims.email || "");
      }
    }
  } catch {
    // Fall through to getUser().
  }

  if (!authenticated) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        authenticated = true;
        userEmail = user.email || "";
      }
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "next",
      safeNextPath(
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      )
    );

    return applyCookies(
      NextResponse.redirect(loginUrl),
      refreshedCookies
    );
  }

  const requestHeaders = new Headers(request.headers);

  if (userEmail) {
    requestHeaders.set("x-cano-user-email", userEmail);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return applyCookies(response, refreshedCookies);
}

export const config = {
  matcher: [
    "/((?!api|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
