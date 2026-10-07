import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  CANO_SESSION_COOKIE,
  verifyCanoSessionToken,
} from "./lib/auth/session";

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

export async function middleware(
  request: NextRequest
) {
  const pathname =
    request.nextUrl.pathname;

  const token =
    request.cookies.get(
      CANO_SESSION_COOKIE
    )?.value || null;

  const session =
    await verifyCanoSessionToken(
      token
    );

  if (!session) {
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

    const response =
      NextResponse.redirect(
        loginUrl
      );

    if (token) {
      response.cookies.delete(
        CANO_SESSION_COOKIE
      );
    }

    return response;
  }

  const requestHeaders =
    new Headers(
      request.headers
    );

  requestHeaders.set(
    "x-cano-user-email",
    session.email
  );

  requestHeaders.set(
    "x-cano-user-id",
    session.sub
  );

  return NextResponse.next({
    request: {
      headers:
        requestHeaders,
    },
  });
}

/*
|--------------------------------------------------------------------------
| FAST LOCAL PAGE AUTH
|--------------------------------------------------------------------------
|
| This middleware does ZERO Supabase/network calls.
|
| Login credentials are verified against Supabase Auth once at sign-in.
| After successful login, Cano issues its own short signed HttpOnly session
| cookie and middleware validates that signature locally using HMAC SHA-256.
|
| /api stays excluded so existing n8n -> Cano callbacks keep working.
|--------------------------------------------------------------------------
*/

export const config = {
  matcher: [
    "/((?!api|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
