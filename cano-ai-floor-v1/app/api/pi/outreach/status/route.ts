import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getTitanPublicStatus,
  verifyTitanMailConnection,
} from "../../../../../lib/email/titan-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest
) {
  const publicStatus =
    getTitanPublicStatus();

  const verify =
    request.nextUrl.searchParams.get(
      "verify"
    ) === "1";

  if (!verify) {
    return NextResponse.json({
      ok: true,
      ...publicStatus,
    });
  }

  if (
    !publicStatus.configured
  ) {
    return NextResponse.json(
      {
        ok: false,
        ...publicStatus,
        error:
          "Titan Mail is not configured. Add TITAN_SMTP_PASSWORD in Vercel Environment Variables and redeploy.",
      },
      {
        status: 503,
      }
    );
  }

  const connection =
    await verifyTitanMailConnection();

  return NextResponse.json(
    {
      ...publicStatus,
      ...connection,
    },
    {
      status:
        connection.ok
          ? 200
          : 502,
    }
  );
}
