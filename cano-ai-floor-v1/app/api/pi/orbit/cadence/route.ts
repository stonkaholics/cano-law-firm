import {
  NextResponse,
} from "next/server";

import {
  getOrbitCadenceDashboard,
} from "../../../../../lib/pi/orbit-cadence";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    const dashboard =
      await getOrbitCadenceDashboard();

    return NextResponse.json({
      ok:
        true,

      ...dashboard,
    });
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unable to load Orbit cadence.",
      },
      {
        status:
          500,
      }
    );
  }
}
