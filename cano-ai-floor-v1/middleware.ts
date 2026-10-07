import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

function getSupabaseConfig() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL ||
    process.env
      .SUPABASE_URL;

  const anonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return {
    url:
      url.replace(/\/$/, ""),
    anonKey,
  };
}

function safeNextPath(
  value: string | null
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

type CookieToSet = {
  name: string;
  value: string;
  options?: any;
};

function applyCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[]
) {
  cookiesToSet.forEach(
    ({
      name,
      value,
      options,
    }) => {
      response.cookies.set(
        name,
        value,
        options
      );
    }
  );

  return response;
}

export async function middleware(
  request: NextRequest
) {
  const config =
    getSupabaseConfig();

  const pathname =
    request.nextUrl.pathname;

  const isLoginPage =
    pathname === "/login";

  /*
  |--------------------------------------------------------------------------
  | FAIL CLOSED IF AUTH IS NOT CONFIGURED
  |--------------------------------------------------------------------------
  */
  if (!config) {
    if (isLoginPage) {
      return NextResponse.next();
    }

    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      "/login";

    loginUrl.searchParams.set(
      "error",
      "Cano AI login is not configured yet. Add NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  /*
  |--------------------------------------------------------------------------
  | VALIDATE SESSION ONCE
  |--------------------------------------------------------------------------
  |
  | This is the only server-side getUser() call needed for a page request.
  | The old layout performed a second getUser() call after middleware, which
  | added another Supabase network round-trip to every protected page load.
  |--------------------------------------------------------------------------
  */

  const refreshedCookies:
    CookieToSet[] = [];

  const supabase =
    createServerClient(
      config.url,
      config.anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet
          ) {
            refreshedCookies.push(
              ...cookiesToSet
            );

            /*
            | Keep request cookies synchronized while Supabase refreshes a
            | session. We apply the same cookies to the outgoing response below.
            */
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value
                );
              }
            );
          },
        },
      }
    );

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  /*
  |--------------------------------------------------------------------------
  | LOGGED OUT
  |--------------------------------------------------------------------------
  */
  if (
    !user &&
    !isLoginPage
  ) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      "/login";

    loginUrl.searchParams.set(
      "next",
      safeNextPath(
        `${pathname}${request.nextUrl.search}`
      )
    );

    return applyCookies(
      NextResponse.redirect(
        loginUrl
      ),
      refreshedCookies
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ALREADY LOGGED IN
  |--------------------------------------------------------------------------
  */
  if (
    user &&
    isLoginPage
  ) {
    const next =
      safeNextPath(
        request.nextUrl.searchParams.get(
          "next"
        )
      );

    return applyCookies(
      NextResponse.redirect(
        new URL(
          next,
          request.url
        )
      ),
      refreshedCookies
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PASS VERIFIED USER TO THE SERVER LAYOUT
  |--------------------------------------------------------------------------
  |
  | The layout reads this internal request header instead of making a second
  | Supabase auth request just to display the user's email.
  |--------------------------------------------------------------------------
  */

  const requestHeaders =
    new Headers(
      request.headers
    );

  if (user?.email) {
    requestHeaders.set(
      "x-cano-user-email",
      user.email
    );
  } else {
    requestHeaders.delete(
      "x-cano-user-email"
    );
  }

  const response =
    NextResponse.next({
      request: {
        headers:
          requestHeaders,
      },
    });

  return applyCookies(
    response,
    refreshedCookies
  );
}

/*
|--------------------------------------------------------------------------
| PAGE AUTH ONLY
|--------------------------------------------------------------------------
|
| /api remains excluded because the existing Cano AI workflows include
| trusted n8n -> Vercel server-to-server callbacks. Those API routes should be
| hardened separately to accept either a user session or N8N_SHARED_SECRET.
|--------------------------------------------------------------------------
*/

export const config = {
  matcher: [
    "/((?!api|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
