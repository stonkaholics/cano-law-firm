import {
  NextResponse,
} from "next/server";

import {
  syncTitanReferralInbox,
} from "../../../../../../lib/pi/orbit-followup";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST() {
  try {
    const result =
      await syncTitanReferralInbox();

    return NextResponse.json(
      result
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok:
          false,
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to sync Titan referral replies.",
      },
      {
        status:
          500,
      }
    );
  }
}

/*
| GET exists so this endpoint can also be used by Vercel Cron.
*/
export async function GET() {
  return POST();
}
