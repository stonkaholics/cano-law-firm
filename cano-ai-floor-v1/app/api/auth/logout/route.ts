import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  CANO_SESSION_COOKIE,
} from "../../../../lib/auth/session";

export async function POST(
  request: NextRequest
) {
  const response =
    NextResponse.redirect(
      new URL(
        "/login",
        request.url
      ),
      {
        status: 303,
      }
    );

  response.cookies.set(
    CANO_SESSION_COOKIE,
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    }
  );

  return response;
}
